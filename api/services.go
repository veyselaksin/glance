package api

import (
	"context"
	"errors"
	"fmt"
	"time"

	"dev-stats-widget/internal/bridge"
	"dev-stats-widget/internal/config"
	"dev-stats-widget/internal/docker"
	"dev-stats-widget/internal/github"
	"dev-stats-widget/internal/netcheck"
	"dev-stats-widget/internal/poller"
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

// SettingsService reads and writes the persisted configuration.
type SettingsService struct{ app *App }

// GetConfig returns the current configuration (server passwords stripped).
func (s *SettingsService) GetConfig() config.Config {
	c := s.app.Config.Get()
	for i := range c.Servers {
		c.Servers[i].Password = ""
	}
	return c
}

// SaveConfig persists cfg and refreshes. Empty GitHub credentials are kept,
// and the server list is always kept: it is managed by ServerService, and the
// frontend's copy may be stale or have passwords stripped.
func (s *SettingsService) SaveConfig(cfg config.Config) error {
	next, err := s.app.Config.Update(func(c *config.Config) {
		if cfg.GitHubToken == "" {
			cfg.GitHubToken = c.GitHubToken
		}
		if cfg.GitHubUsername == "" {
			cfg.GitHubUsername = c.GitHubUsername
		}
		cfg.Servers = c.Servers
		*c = cfg
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
		if _, err := a.Config.Update(func(c *config.Config) {
			c.GitHubToken = token
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

// SignOut clears the GitHub credentials.
func (s *GitHubService) SignOut() error {
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

func targetFor(srv config.ServerConfig) sshx.Target {
	t := sshx.Target{Host: srv.IP, Port: srv.Port, User: srv.Username}
	if srv.AuthMethod == "private_key" {
		t.KeyPath = srv.PrivateKeyPath
	} else {
		t.Password = srv.Password
	}
	return t
}

func (s *ServerService) target(id string) (config.ServerConfig, sshx.Target, error) {
	srv, ok := s.app.Config.FindServer(id)
	if !ok {
		return srv, sshx.Target{}, fmt.Errorf("server not found: %s", id)
	}
	return srv, targetFor(srv), nil
}

// GetServers returns saved servers without passwords.
func (s *ServerService) GetServers() []config.ServerConfig {
	out := s.app.Config.Get().Servers
	for i := range out {
		out[i].Password = ""
	}
	if out == nil {
		out = []config.ServerConfig{}
	}
	return out
}

// SaveServer upserts a server and returns its ID. Empty credentials on update
// keep the existing ones.
func (s *ServerService) SaveServer(srv config.ServerConfig) (string, error) {
	if srv.Name == "" || srv.IP == "" {
		return "", errors.New("name and ip are required")
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
	_, err := s.app.Config.Update(func(c *config.Config) {
		for i, existing := range c.Servers {
			if existing.ID != srv.ID {
				continue
			}
			if srv.AuthMethod == "password" && srv.Password == "" {
				srv.Password = existing.Password
			}
			if srv.AuthMethod == "private_key" && srv.PrivateKeyPath == "" {
				srv.PrivateKeyPath = existing.PrivateKeyPath
			}
			c.Servers[i] = srv
			return
		}
		c.Servers = append(c.Servers, srv)
	})
	return srv.ID, err
}

// DeleteServer removes a server and its stored key.
func (s *ServerService) DeleteServer(id string) error {
	s.app.Keys.Delete(id)
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
