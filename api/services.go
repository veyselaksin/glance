package api

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"dev-stats-widget/internal/bridge"
	"dev-stats-widget/internal/config"
	"dev-stats-widget/internal/docker"
	"dev-stats-widget/internal/github"
	"dev-stats-widget/internal/netcheck"
	"dev-stats-widget/internal/poller"
	"dev-stats-widget/internal/secrets"
	"dev-stats-widget/internal/sshx"
)

// ─── System ───────────────────────────────────────────────────────────────────

// SystemService exposes app-level info and the overview snapshot.
type SystemService struct {
	app     *App
	version string
}

// AppVersion returns the version from wails.json.
func (s *SystemService) AppVersion() string { return s.version }

// SetAppTheme applies the native window appearance ("dark" or "light").
func (s *SystemService) SetAppTheme(mode string) { s.app.Bridge.SetWindowTheme(mode) }

// GetLastData returns the most recent overview snapshot.
func (s *SystemService) GetLastData() poller.Snapshot { return s.app.Poller.Last() }

// RefreshNow triggers an immediate overview refresh.
func (s *SystemService) RefreshNow() { s.app.Poller.Refresh() }

// ─── Settings ─────────────────────────────────────────────────────────────────

// SettingsService reads and writes user preferences.
type SettingsService struct{ app *App }

// Settings is the frontend view of the config. It never carries secrets;
// servers are managed through ServerService.
type Settings struct {
	GitHubUsername  string `json:"github_username"`
	GitHubConnected bool   `json:"github_connected"`
	ClientID        string `json:"client_id"`
	ServerHost      string `json:"server_host"`
	DockerSocket    string `json:"docker_socket"`
	Theme           string `json:"theme"`
}

// GetConfig returns the current settings.
func (s *SettingsService) GetConfig() Settings {
	c := s.app.Config.Get()
	return Settings{
		GitHubUsername:  c.GitHubUsername,
		GitHubConnected: s.app.githubToken() != "",
		ClientID:        c.ClientID,
		ServerHost:      c.ServerHost,
		DockerSocket:    c.DockerSocket,
		Theme:           c.Theme,
	}
}

// SaveConfig persists the user-editable preferences and refreshes. The
// GitHub identity is owned by the sign-in flow and is not changed here.
func (s *SettingsService) SaveConfig(in Settings) error {
	next, err := s.app.Config.Update(func(c *config.Config) {
		c.ClientID = in.ClientID
		c.ServerHost = in.ServerHost
		c.DockerSocket = in.DockerSocket
		c.Theme = in.Theme
	})
	s.app.Docker.SetSocket(next.DockerSocket)
	s.app.Poller.Refresh()
	return err
}

// ─── GitHub ───────────────────────────────────────────────────────────────────

// GitHubService runs GitHub sign-in / sign-out.
type GitHubService struct{ app *App }

// StartDeviceFlow requests a device code, opens the browser and emits
// device_code; it then polls in the background and emits oauth_success or
// oauth_error. No client secret is needed.
func (s *GitHubService) StartDeviceFlow() error {
	a := s.app
	clientID := a.Config.Get().ClientID
	if clientID == "" {
		clientID = github.DefaultClientID
	}

	ctx, cancel := context.WithTimeout(a.Bridge.Context(), 10*time.Second)
	dc, err := a.GitHub.RequestDeviceCode(ctx, clientID)
	cancel()
	if err != nil {
		return err
	}
	a.Bridge.OpenURL(dc.AuthURL())
	a.Bridge.Emit(bridge.EventDeviceCode, map[string]string{
		"user_code":        dc.UserCode,
		"verification_uri": dc.VerificationURI,
	})

	go func() {
		ctx := a.Bridge.Context()
		token, err := a.GitHub.PollToken(ctx, clientID, dc)
		if err != nil {
			if !errors.Is(err, context.Canceled) {
				a.Bridge.Emit(bridge.EventOAuthError, err.Error())
			}
			return
		}
		pctx, cancel := context.WithTimeout(ctx, 10*time.Second)
		username, err := a.GitHub.FetchUsername(pctx, token)
		cancel()
		if err != nil {
			a.Bridge.Emit(bridge.EventOAuthError, "Failed to fetch GitHub profile: "+err.Error())
			return
		}
		if err := a.Secrets.Set(secrets.GitHubToken, token); err != nil {
			a.Bridge.Emit(bridge.EventOAuthError, "Failed to store token in Keychain: "+err.Error())
			return
		}
		if _, err := a.Config.Update(func(c *config.Config) {
			c.GitHubToken = ""
			c.GitHubUsername = username
		}); err != nil {
			a.Bridge.Emit(bridge.EventOAuthError, "Failed to save credentials: "+err.Error())
			return
		}
		a.Bridge.Emit(bridge.EventOAuthSuccess, username)
		a.Poller.Refresh()
	}()
	return nil
}

// GetActivity returns the signed-in user's commits on every branch over the
// last days days (1 = today), with a per-repository breakdown.
func (s *GitHubService) GetActivity(days int) (github.Activity, error) {
	user, token := s.app.Config.Get().GitHubUsername, s.app.githubToken()
	if user == "" || token == "" {
		return github.Activity{}, errors.New("sign in to GitHub to see activity")
	}
	ctx, cancel := context.WithTimeout(s.app.Bridge.Context(), 60*time.Second)
	defer cancel()
	return s.app.GitHub.Activity(ctx, user, token, days)
}

// SignOut removes the stored token and clears the GitHub identity.
func (s *GitHubService) SignOut() error {
	if err := s.app.Secrets.Delete(secrets.GitHubToken); err != nil {
		return err
	}
	_, err := s.app.Config.Update(func(c *config.Config) {
		c.GitHubToken = ""
		c.GitHubUsername = ""
	})
	s.app.Poller.Refresh()
	return err
}

// ─── Docker ───────────────────────────────────────────────────────────────────

// DockerService manages local containers.
type DockerService struct{ app *App }

func timeout(d time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), d)
}

// GetContainers lists all containers with live stats for running ones.
func (s *DockerService) GetContainers() ([]docker.Container, error) {
	ctx, cancel := timeout(10 * time.Second)
	defer cancel()
	return s.app.Docker.List(ctx)
}

// StreamContainerLogs returns the last `lines` log lines of a container.
func (s *DockerService) StreamContainerLogs(id string, lines int) (string, error) {
	ctx, cancel := timeout(10 * time.Second)
	defer cancel()
	return s.app.Docker.Logs(ctx, id, lines)
}

func (s *DockerService) action(fn func(context.Context, string) error, id string) error {
	ctx, cancel := timeout(30 * time.Second)
	defer cancel()
	return fn(ctx, id)
}

// DockerRuntime returns the name of the installed runtime that StartDaemon
// would launch (e.g. "Docker Desktop"), or "" if none is installed.
func (s *DockerService) DockerRuntime() string {
	rt, err := docker.DetectRuntime()
	if err != nil {
		return ""
	}
	return rt.Name
}

// StartDaemon launches the local Docker runtime and waits (up to 2 minutes)
// until the daemon responds, then refreshes the overview. Returns the
// runtime's name.
func (s *DockerService) StartDaemon() (string, error) {
	rt, err := docker.DetectRuntime()
	if err != nil {
		return "", err
	}
	s.app.Bridge.Log("DOCK", "Starting "+rt.Name+"...")
	ctx, cancel := context.WithTimeout(s.app.Bridge.Context(), 2*time.Minute)
	defer cancel()
	if err := s.app.Docker.StartDaemon(ctx, rt); err != nil {
		s.app.Bridge.Log("DOCK", "Start failed: "+err.Error())
		return rt.Name, err
	}
	s.app.Bridge.Log("DOCK", rt.Name+" is running")
	s.app.Poller.Refresh()
	return rt.Name, nil
}

// StartContainer starts a container.
func (s *DockerService) StartContainer(id string) error { return s.action(s.app.Docker.Start, id) }

// StopContainer stops a container.
func (s *DockerService) StopContainer(id string) error { return s.action(s.app.Docker.Stop, id) }

// RestartContainer restarts a container.
func (s *DockerService) RestartContainer(id string) error { return s.action(s.app.Docker.Restart, id) }

// DeleteContainer force-removes a container.
func (s *DockerService) DeleteContainer(id string) error { return s.action(s.app.Docker.Remove, id) }

// ─── Servers / SSH ────────────────────────────────────────────────────────────

// ServerService manages saved servers, SSH sessions and metrics.
type ServerService struct{ app *App }

// Server is the frontend view of a saved server. Password is write-only:
// it is accepted by SaveServer and never returned.
type Server struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	IP             string `json:"ip"`
	Port           int    `json:"port"`
	Username       string `json:"username"`
	AuthMethod     string `json:"auth_method"` // "password" or "private_key"
	PrivateKeyPath string `json:"private_key_path,omitempty"`
	HasPassword    bool   `json:"has_password"`
	Password       string `json:"password,omitempty"`
}

func (s *ServerService) password(srv config.ServerConfig) string {
	pw, err := s.app.Secrets.Get(secrets.SSHPassword(srv.ID))
	if err != nil {
		slog.Warn("keychain: read ssh password", "server", srv.ID, "err", err)
	}
	if pw == "" {
		pw = srv.Password // not yet migrated
	}
	return pw
}

func (s *ServerService) target(id string) (config.ServerConfig, sshx.Target, error) {
	srv, ok := s.app.Config.FindServer(id)
	if !ok {
		return srv, sshx.Target{}, fmt.Errorf("server not found: %s", id)
	}
	t := sshx.Target{Host: srv.IP, Port: srv.Port, User: srv.Username}
	if srv.AuthMethod == "private_key" {
		t.KeyPath = srv.PrivateKeyPath
	} else {
		t.Password = s.password(srv)
	}
	return srv, t, nil
}

// GetServers returns saved servers (without secrets).
func (s *ServerService) GetServers() []Server {
	list := s.app.Config.Get().Servers
	out := make([]Server, len(list))
	for i, srv := range list {
		out[i] = Server{
			ID: srv.ID, Name: srv.Name, IP: srv.IP, Port: srv.Port, Username: srv.Username,
			AuthMethod: srv.AuthMethod, PrivateKeyPath: srv.PrivateKeyPath,
			HasPassword: srv.AuthMethod != "private_key" && s.password(srv) != "",
		}
	}
	return out
}

// SaveServer upserts a server and returns its ID. An empty password or key
// path on update keeps the existing one; a new password goes to the keychain.
func (s *ServerService) SaveServer(in Server) (string, error) {
	if in.Name == "" || in.IP == "" {
		return "", errors.New("name and ip are required")
	}
	srv := config.ServerConfig{
		ID: in.ID, Name: in.Name, IP: in.IP, Port: in.Port, Username: in.Username,
		AuthMethod: in.AuthMethod, PrivateKeyPath: in.PrivateKeyPath,
	}
	if srv.ID == "" {
		srv.ID = sshx.NewID()
	}
	if srv.Port == 0 {
		srv.Port = 22
	}
	if srv.Username == "" {
		srv.Username = "root"
	}
	if srv.AuthMethod == "" {
		srv.AuthMethod = "password"
	}

	switch {
	case srv.AuthMethod == "private_key":
		if err := s.app.Secrets.Delete(secrets.SSHPassword(srv.ID)); err != nil {
			return "", err
		}
	case in.Password != "":
		if err := s.app.Secrets.Set(secrets.SSHPassword(srv.ID), in.Password); err != nil {
			return "", fmt.Errorf("store password in Keychain: %w", err)
		}
	}

	_, err := s.app.Config.Update(func(c *config.Config) {
		for i, existing := range c.Servers {
			if existing.ID != srv.ID {
				continue
			}
			if srv.AuthMethod == "private_key" && srv.PrivateKeyPath == "" {
				srv.PrivateKeyPath = existing.PrivateKeyPath
			}
			if srv.AuthMethod == "password" && in.Password == "" {
				srv.Password = existing.Password // keep an unmigrated legacy password
			}
			c.Servers[i] = srv
			return
		}
		c.Servers = append(c.Servers, srv)
	})
	return srv.ID, err
}

// DeleteServer removes a server, its stored key and its password.
func (s *ServerService) DeleteServer(id string) error {
	s.app.Keys.Delete(id)
	if err := s.app.Secrets.Delete(secrets.SSHPassword(id)); err != nil {
		slog.Warn("keychain: delete ssh password", "server", id, "err", err)
	}
	_, err := s.app.Config.Update(func(c *config.Config) {
		kept := c.Servers[:0]
		for _, srv := range c.Servers {
			if srv.ID != id {
				kept = append(kept, srv)
			}
		}
		c.Servers = kept
	})
	return err
}

// SaveSSHKey stores a private key for serverID and returns its path.
func (s *ServerService) SaveSSHKey(serverID, content string) (string, error) {
	p, err := s.app.Keys.Save(serverID, content)
	if err == nil {
		s.app.Bridge.Log("SSH", fmt.Sprintf("Saved private key to %s (0600)", p))
	}
	return p, err
}

// ConnectSSH opens an interactive shell; output arrives as ssh_output events.
func (s *ServerService) ConnectSSH(serverID string) (string, error) {
	srv, t, err := s.target(serverID)
	if err != nil {
		return "", err
	}
	id, err := s.app.SSH.Open(t)
	if err != nil {
		return "", err
	}
	s.app.Bridge.Log("SSH", fmt.Sprintf("Connected to %s@%s", srv.Username, srv.IP))
	return id, nil
}

// SSHWrite sends keystrokes to a session.
func (s *ServerService) SSHWrite(sessionID, data string) error {
	return s.app.SSH.Write(sessionID, data)
}

// SSHResize resizes a session's PTY.
func (s *ServerService) SSHResize(sessionID string, cols, rows int) error {
	return s.app.SSH.Resize(sessionID, cols, rows)
}

// DisconnectSSH closes a session.
func (s *ServerService) DisconnectSSH(sessionID string) error {
	s.app.SSH.Close(sessionID)
	s.app.Bridge.Log("SSH", "Disconnected session "+sessionID)
	return nil
}

// GetServerMetrics fetches a CPU/memory/disk snapshot over SSH.
func (s *ServerService) GetServerMetrics(serverID string) sshx.Metrics {
	_, t, err := s.target(serverID)
	if err != nil {
		return sshx.Metrics{Error: err.Error()}
	}
	return sshx.FetchMetrics(t)
}

// GetServerPing checks reachability of a host.
func (s *ServerService) GetServerPing(host string) netcheck.Status {
	return netcheck.Ping(context.Background(), host)
}
