package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ─── Data types ───────────────────────────────────────────────────────────────

// Config holds user-configurable tracking targets, persisted in config.json.
type Config struct {
	GitHubUsername string `json:"github_username"`
	GitHubToken    string `json:"github_token"`
	ClientID       string `json:"client_id"`
	ClientSecret   string `json:"client_secret"`
	ServerHost     string `json:"server_host"`
}

// GitHubStats holds today's contribution data.
type GitHubStats struct {
	Username      string `json:"username"`
	Contributions int    `json:"contributions"`
	Commits       int    `json:"commits"`
	Error         string `json:"error,omitempty"`
}

// DockerStats holds running/stopped container counts.
type DockerStats struct {
	Running int    `json:"running"`
	Stopped int    `json:"stopped"`
	Total   int    `json:"total"`
	Version string `json:"version"`
	Error   string `json:"error,omitempty"`
}

// ContainerInfo holds per-container metadata and live resource metrics.
type ContainerInfo struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Image    string  `json:"image"`
	State    string  `json:"state"`
	Status   string  `json:"status"`
	CPUUsage float64 `json:"cpu_usage"` // percentage
	MemUsage uint64  `json:"mem_usage"` // bytes
}

// ServerStatus holds TCP reachability and latency for a remote host.
type ServerStatus struct {
	Host    string  `json:"host"`
	Online  bool    `json:"online"`
	Latency float64 `json:"latency"` // milliseconds
	Error   string  `json:"error,omitempty"`
}

// WidgetData is the root document written to widget_data.json
// and consumed by the native Swift WidgetKit extension.
type WidgetData struct {
	UpdatedAt string       `json:"updated_at"`
	GitHub    GitHubStats  `json:"github"`
	Docker    DockerStats  `json:"docker"`
	Server    ServerStatus `json:"server"`
}

// ─── App ──────────────────────────────────────────────────────────────────────

// App is the Wails application struct bound to the frontend.
type App struct {
	ctx  context.Context
	mu   sync.RWMutex
	cfg  Config
	last WidgetData
}

// NewApp creates a new App.
func NewApp() *App {
	return &App{}
}

// startup is called by Wails when the app starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	registerWidgetHostApp()
	a.cfg = a.loadConfig()
	go a.tickerLoop(ctx)
}

// ─── Background ticker ────────────────────────────────────────────────────────

func (a *App) tickerLoop(ctx context.Context) {
	a.refresh() // immediate first fetch on start
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			a.refresh()
		case <-ctx.Done():
			return
		}
	}
}

func (a *App) refresh() {
	a.mu.RLock()
	cfg := a.cfg
	a.mu.RUnlock()

	runtime.EventsEmit(a.ctx, "agent_log", map[string]string{"tag": "SYS", "msg": "Refreshing tracked metrics..."})

	gh := a.GetGitHubStats(cfg.GitHubUsername)
	if gh.Error != "" {
		runtime.EventsEmit(a.ctx, "agent_log", map[string]string{"tag": "GIT", "msg": "GitHub Error: " + gh.Error})
	} else {
		runtime.EventsEmit(a.ctx, "agent_log", map[string]string{"tag": "GIT", "msg": fmt.Sprintf("Synced: %d contributions, %d commits today", gh.Contributions, gh.Commits)})
	}

	dk := a.GetDockerStats()
	if dk.Error != "" {
		runtime.EventsEmit(a.ctx, "agent_log", map[string]string{"tag": "DOCK", "msg": "Docker Error: " + dk.Error})
	} else {
		runtime.EventsEmit(a.ctx, "agent_log", map[string]string{"tag": "DOCK", "msg": fmt.Sprintf("Synced container status: %d running, %d stopped", dk.Running, dk.Stopped)})
	}

	sv := a.GetServerPing(cfg.ServerHost)
	if sv.Error != "" {
		runtime.EventsEmit(a.ctx, "agent_log", map[string]string{"tag": "NET", "msg": "Server Ping Error: " + sv.Error})
	} else {
		runtime.EventsEmit(a.ctx, "agent_log", map[string]string{"tag": "NET", "msg": fmt.Sprintf("Pinged server: %s (%.1f ms)", sv.Host, sv.Latency)})
	}

	data := WidgetData{
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
		GitHub:    gh,
		Docker:    dk,
		Server:    sv,
	}

	a.mu.Lock()
	a.last = data
	a.mu.Unlock()

	_ = a.writeWidgetData(data)
	runtime.EventsEmit(a.ctx, "agent_log", map[string]string{"tag": "SYS", "msg": "Metrics written to widget_data.json"})
}

// ─── Data directory & persistence ─────────────────────────────────────────────

// dataDir returns (and creates) ~/Library/Application Support/Glance.
func (a *App) dataDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, "Library", "Application Support", "Glance")
	return dir, os.MkdirAll(dir, 0o755)
}

func (a *App) loadConfig() Config {
	dir, err := a.dataDir()
	if err != nil {
		return Config{}
	}
	b, err := os.ReadFile(filepath.Join(dir, "config.json"))
	if err != nil {
		return Config{}
	}
	var cfg Config
	if err := json.Unmarshal(b, &cfg); err != nil {
		return Config{}
	}
	return cfg
}

// SaveConfig persists the config and triggers an immediate refresh.
// Exposed to the Wails frontend.
func (a *App) SaveConfig(cfg Config) error {
	a.mu.Lock()
	// Retain existing token/username if not provided in new config
	if cfg.GitHubToken == "" && a.cfg.GitHubToken != "" {
		cfg.GitHubToken = a.cfg.GitHubToken
	}
	if cfg.GitHubUsername == "" && a.cfg.GitHubUsername != "" {
		cfg.GitHubUsername = a.cfg.GitHubUsername
	}
	a.cfg = cfg
	a.mu.Unlock()

	err := a.saveConfigInternal(cfg)
	go a.refresh() // apply new settings immediately
	return err
}

func (a *App) saveConfigInternal(cfg Config) error {
	dir, err := a.dataDir()
	if err != nil {
		return err
	}
	b, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	// Restrict to owner read-write only (0600) for security
	return os.WriteFile(filepath.Join(dir, "config.json"), b, 0o600)
}

// GetConfig returns the current configuration to the frontend.
func (a *App) GetConfig() Config {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.cfg
}

// GetLastData returns the most recently fetched snapshot to the frontend.
func (a *App) GetLastData() WidgetData {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.last
}

// writeWidgetData atomically writes data to widget_data.json via temp-rename.
func (a *App) writeWidgetData(data WidgetData) error {
	dir, err := a.dataDir()
	if err != nil {
		return err
	}
	b, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	tmp := filepath.Join(dir, "widget_data.tmp")
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(dir, "widget_data.json"))
}

// StartOAuthFlow starts a local server on port 57321, opens the browser to sign in,
// receives the code, exchanges it, and stores the token.
func (a *App) StartOAuthFlow(customClientID, customClientSecret string) error {
	if customClientID == "" || customClientSecret == "" {
		return fmt.Errorf("GitHub Client ID and Client Secret are required")
	}

	a.mu.Lock()
	clientID := customClientID
	clientSecret := customClientSecret
	a.mu.Unlock()

	b := make([]byte, 16)
	_, _ = rand.Read(b)
	state := hex.EncodeToString(b)

	listener, err := net.Listen("tcp", "127.0.0.1:57321")
	if err != nil {
		return fmt.Errorf("port 57321 is already in use: %w", err)
	}

	mux := http.NewServeMux()
	server := &http.Server{
		Handler: mux,
	}

	mux.HandleFunc("/oauth/callback", func(w http.ResponseWriter, r *http.Request) {
		callbackState := r.URL.Query().Get("state")
		if callbackState != state {
			http.Error(w, "State mismatch (CSRF check failed)", http.StatusBadRequest)
			runtime.EventsEmit(a.ctx, "oauth_error", "State mismatch")
			return
		}

		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(w, "Authorization code not found", http.StatusBadRequest)
			runtime.EventsEmit(a.ctx, "oauth_error", "No code returned")
			return
		}

		token, err := a.exchangeCodeForToken(clientID, clientSecret, code)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to get token: %v", err), http.StatusInternalServerError)
			runtime.EventsEmit(a.ctx, "oauth_error", err.Error())
			return
		}

		username, err := a.fetchGitHubUsername(token)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to fetch profile: %v", err), http.StatusInternalServerError)
			runtime.EventsEmit(a.ctx, "oauth_error", err.Error())
			return
		}

		a.mu.Lock()
		a.cfg.GitHubToken = token
		a.cfg.GitHubUsername = username
		if customClientID != "" {
			a.cfg.ClientID = customClientID
			a.cfg.ClientSecret = customClientSecret
		}
		a.mu.Unlock()

		_ = a.saveConfigInternal(a.cfg)

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprintf(w, `
			<!DOCTYPE html>
			<html>
			<head>
				<title>Glance Authorized</title>
				<style>
					body {
						font-family: -apple-system, BlinkMacSystemFont, sans-serif;
						background-color: #1E1E1E;
						color: #FFFFFF;
						display: flex;
						flex-direction: column;
						align-items: center;
						justify-content: center;
						height: 100vh;
						margin: 0;
					}
					.container {
						background: #2C2C2E;
						padding: 40px;
						border-radius: 12px;
						box-shadow: 0 4px 12px rgba(0,0,0,0.5);
						text-align: center;
					}
					h1 { color: #0A84FF; font-size: 24px; margin-top: 0; }
					p { color: #EBEBF5; opacity: 0.6; font-size: 14px; }
				</style>
			</head>
			<body>
				<div class="container">
					<h1>Glance Connected!</h1>
					<p>Successfully signed in with GitHub as <strong>%s</strong>. You can close this window now.</p>
				</div>
			</body>
			</html>
		`, username)

		runtime.EventsEmit(a.ctx, "oauth_success", username)
		go a.refresh()

		go func() {
			time.Sleep(1 * time.Second)
			_ = server.Shutdown(context.Background())
		}()
	})

	go func() {
		_ = server.Serve(listener)
	}()

	authURL := fmt.Sprintf("https://github.com/login/oauth/authorize?client_id=%s&redirect_uri=http://localhost:57321/oauth/callback&state=%s&scope=read:user,repo", clientID, state)
	runtime.BrowserOpenURL(a.ctx, authURL)
	return nil
}

func (a *App) exchangeCodeForToken(clientID, clientSecret, code string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	val := url.Values{}
	val.Set("client_id", clientID)
	val.Set("client_secret", clientSecret)
	val.Set("code", code)
	val.Set("redirect_uri", "http://localhost:57321/oauth/callback")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://github.com/login/oauth/access_token", strings.NewReader(val.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Glance-Widget/1.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var res struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", err
	}

	if res.Error != "" {
		return "", fmt.Errorf("%s: %s", res.Error, res.ErrorDesc)
	}
	return res.AccessToken, nil
}

func (a *App) fetchGitHubUsername(token string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/user", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Glance-Widget/1.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var user struct {
		Login string `json:"login"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return "", err
	}
	return user.Login, nil
}

// SignOut clears authentication and user details.
func (a *App) SignOut() error {
	a.mu.Lock()
	a.cfg.GitHubToken = ""
	a.cfg.GitHubUsername = ""
	cfg := a.cfg
	a.mu.Unlock()

	err := a.saveConfigInternal(cfg)
	go a.refresh()
	return err
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

// GetGitHubStats fetches today's GitHub contribution count (using token or scraper).
func (a *App) GetGitHubStats(username string) GitHubStats {
	a.mu.RLock()
	token := a.cfg.GitHubToken
	a.mu.RUnlock()

	if username == "" {
		return GitHubStats{Error: "username not configured"}
	}

	if token == "" {
		return a.getGitHubStatsScraper(username)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	query := map[string]interface{}{
		"query": `query($username: String!) {
			user(login: $username) {
				contributionsCollection {
					contributionCalendar {
						weeks {
							contributionDays {
								contributionCount
								date
							}
						}
					}
				}
			}
		}`,
		"variables": map[string]string{
			"username": username,
		},
	}

	reqBytes, err := json.Marshal(query)
	if err != nil {
		return GitHubStats{Username: username, Error: err.Error()}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.github.com/graphql", strings.NewReader(string(reqBytes)))
	if err != nil {
		return GitHubStats{Username: username, Error: err.Error()}
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Glance-Widget/1.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return GitHubStats{Username: username, Error: err.Error()}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return GitHubStats{Username: username, Error: fmt.Sprintf("GraphQL HTTP %d", resp.StatusCode)}
	}

	var res struct {
		Data struct {
			User struct {
				ContributionsCollection struct {
					ContributionCalendar struct {
						Weeks []struct {
							ContributionDays []struct {
								ContributionCount int    `json:"contributionCount"`
								Date              string `json:"date"`
							} `json:"contributionDays"`
						} `json:"weeks"`
					} `json:"contributionCalendar"`
				} `json:"contributionsCollection"`
			} `json:"user"`
		} `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return GitHubStats{Username: username, Error: err.Error()}
	}

	if len(res.Errors) > 0 {
		return GitHubStats{Username: username, Error: res.Errors[0].Message}
	}

	todayLocal := time.Now().Format("2006-01-02")
	todayUTC := time.Now().UTC().Format("2006-01-02")
	contributions := 0
	found := false

	// Scan calendar to find today's entry
	for i := len(res.Data.User.ContributionsCollection.ContributionCalendar.Weeks) - 1; i >= 0; i-- {
		week := res.Data.User.ContributionsCollection.ContributionCalendar.Weeks[i]
		for j := len(week.ContributionDays) - 1; j >= 0; j-- {
			day := week.ContributionDays[j]
			if day.Date == todayLocal || day.Date == todayUTC {
				contributions = day.ContributionCount
				found = true
				break
			}
		}
		if found {
			break
		}
	}

	// Fallback to the latest day in grid
	if !found {
		weeks := res.Data.User.ContributionsCollection.ContributionCalendar.Weeks
		if len(weeks) > 0 {
			days := weeks[len(weeks)-1].ContributionDays
			if len(days) > 0 {
				contributions = days[len(days)-1].ContributionCount
			}
		}
	}

	commits := a.getGitHubCommitsToday(username, token)

	return GitHubStats{Username: username, Contributions: contributions, Commits: commits}
}

// getGitHubCommitsToday counts actual commits pushed today via the REST Events
// API. It filters PushEvents by today's date (checking created_at) and sums
// payload.size (the number of commits in each push).
func (a *App) getGitHubCommitsToday(username, token string) int {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		fmt.Sprintf("https://api.github.com/users/%s/events/public?per_page=100", username), nil)
	if err != nil {
		return 0
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Glance-Widget/1.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 0
	}

	var events []struct {
		Type      string `json:"type"`
		CreatedAt string `json:"created_at"`
		Payload   struct {
			Size int `json:"size"`
		} `json:"payload"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&events); err != nil {
		return 0
	}

	todayLocal := time.Now().Format("2006-01-02")
	todayUTC := time.Now().UTC().Format("2006-01-02")
	commits := 0
	for _, e := range events {
		if e.Type != "PushEvent" {
			continue
		}
		// GitHub event timestamps are ISO-8601 UTC (e.g. "2026-07-01T12:34:56Z").
		// Extract the date portion and compare against both local and UTC today.
		if len(e.CreatedAt) < 10 {
			continue
		}
		eventDate := e.CreatedAt[:10]
		if eventDate == todayLocal || eventDate == todayUTC {
			commits += e.Payload.Size
		}
	}
	return commits
}

func (a *App) getGitHubStatsScraper(username string) GitHubStats {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	url := fmt.Sprintf("https://github.com/users/%s/contributions", username)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return GitHubStats{Username: username, Error: err.Error()}
	}
	req.Header.Set("User-Agent", "Glance-Widget/1.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return GitHubStats{Username: username, Error: err.Error()}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return GitHubStats{Username: username, Error: fmt.Sprintf("HTTP %d", resp.StatusCode)}
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return GitHubStats{Username: username, Error: err.Error()}
	}

	today := time.Now().UTC().Format("2006-01-02")
	re1 := regexp.MustCompile(`data-date="` + regexp.QuoteMeta(today) + `"[^>]*data-count="(\d+)"`)
	if m := re1.FindSubmatch(body); m != nil {
		count, _ := strconv.Atoi(string(m[1]))
		return GitHubStats{Username: username, Contributions: count, Commits: a.getGitHubCommitsToday(username, "")}
	}
	re2 := regexp.MustCompile(`data-count="(\d+)"[^>]*data-date="` + regexp.QuoteMeta(today) + `"`)
	if m := re2.FindSubmatch(body); m != nil {
		count, _ := strconv.Atoi(string(m[1]))
		return GitHubStats{Username: username, Contributions: count, Commits: a.getGitHubCommitsToday(username, "")}
	}
	todayFormatted := time.Now().UTC().Format("January 2, 2006")
	re3 := regexp.MustCompile(`aria-label="(\d+) contributions? on ` + regexp.QuoteMeta(todayFormatted) + `"`)
	if m := re3.FindSubmatch(body); m != nil {
		count, _ := strconv.Atoi(string(m[1]))
		return GitHubStats{Username: username, Contributions: count, Commits: a.getGitHubCommitsToday(username, "")}
	}
	return GitHubStats{Username: username, Contributions: 0, Commits: a.getGitHubCommitsToday(username, "")}
}

// GetDockerStats returns running/stopped container counts from the local Docker daemon.
func (a *App) GetDockerStats() DockerStats {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return DockerStats{Error: err.Error()}
	}
	defer cli.Close()

	containers, err := cli.ContainerList(ctx, container.ListOptions{All: true})
	if err != nil {
		return DockerStats{Error: err.Error()}
	}

	running, stopped := 0, 0
	for _, c := range containers {
		if c.State == "running" {
			running++
		} else {
			stopped++
		}
	}

	version := ""
	if v, err := cli.ServerVersion(ctx); err == nil {
		version = v.Version
	}

	return DockerStats{Running: running, Stopped: stopped, Total: len(containers), Version: version}
}

// dockerClient returns a Docker SDK client connected to the local unix socket
// at /var/run/docker.sock with API-version negotiation enabled.
func dockerClient() (*client.Client, error) {
	return client.NewClientWithOpts(
		client.WithHost("unix:///var/run/docker.sock"),
		client.WithAPIVersionNegotiation(),
	)
}

// cpuPercent computes CPU utilisation as a percentage from two consecutive
// CPU stats samples (the current and the previous/pre-cpu stats), using the
// Docker daemon's formula. Returns 0 if the delta is unavailable.
func cpuPercent(previousCPU, previousSystem uint64, cpu container.CPUStats) float64 {
	onlineCPUs := cpu.OnlineCPUs
	if onlineCPUs == 0 && len(cpu.CPUUsage.PercpuUsage) > 0 {
		onlineCPUs = uint32(len(cpu.CPUUsage.PercpuUsage))
	}
	if onlineCPUs == 0 {
		onlineCPUs = 1
	}
	cpuDelta := float64(cpu.CPUUsage.TotalUsage - previousCPU)
	systemDelta := float64(cpu.SystemUsage - previousSystem)
	if systemDelta > 0 && cpuDelta > 0 {
		return (cpuDelta / systemDelta) * float64(onlineCPUs) * 100.0
	}
	return 0
}

// GetContainers lists every container (running or stopped) on the local Docker
// daemon and returns its metadata together with a one-shot CPU/Mem snapshot.
// Exposed to the Wails frontend.
func (a *App) GetContainers() ([]ContainerInfo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cli, err := dockerClient()
	if err != nil {
		return nil, err
	}
	defer cli.Close()

	containers, err := cli.ContainerList(ctx, container.ListOptions{All: true})
	if err != nil {
		return nil, err
	}

	result := make([]ContainerInfo, 0, len(containers))
	for _, c := range containers {
		name := ""
		if len(c.Names) > 0 {
			name = strings.TrimPrefix(c.Names[0], "/")
		}

		info := ContainerInfo{
			ID:     c.ID,
			Name:   name,
			Image:  c.Image,
			State:  string(c.State),
			Status: c.Status,
		}

		// Only fetch live stats for running containers; stopped containers
		// report zero metrics.
		if c.State == "running" {
			if stats, err := cli.ContainerStatsOneShot(ctx, c.ID); err == nil {
				var sr container.StatsResponse
				if err := json.NewDecoder(stats.Body).Decode(&sr); err == nil {
					info.CPUUsage = cpuPercent(
						sr.PreCPUStats.CPUUsage.TotalUsage,
						sr.PreCPUStats.SystemUsage,
						sr.CPUStats,
					)
					if sr.MemoryStats.Usage > 0 {
						info.MemUsage = sr.MemoryStats.Usage
					}
				}
				_ = stats.Body.Close()
			}
		}

		result = append(result, info)
	}

	return result, nil
}

// StreamContainerLogs fetches the last `lines` lines of logs for the given
// container and returns them as plain text. Both stdout and stderr are
// included; the multiplexed Docker stream header is stripped via stdcopy.
// Exposed to the Wails frontend.
func (a *App) StreamContainerLogs(containerID string, lines int) (string, error) {
	if lines <= 0 {
		lines = 100
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cli, err := dockerClient()
	if err != nil {
		return "", err
	}
	defer cli.Close()

	rc, err := cli.ContainerLogs(ctx, containerID, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Tail:       strconv.Itoa(lines),
	})
	if err != nil {
		return "", err
	}
	defer rc.Close()

	// Buffer the entire stream first so the stdcopy fallback doesn't lose
	// the initial bytes it consumed before failing on a non-multiplexed
	// (TTY) stream.
	raw, err := io.ReadAll(rc)
	if err != nil {
		return "", err
	}

	var buf strings.Builder
	if _, err := stdcopy.StdCopy(&buf, &buf, bytes.NewReader(raw)); err != nil {
		// Not multiplexed (TTY container) — return the raw bytes verbatim.
		return string(raw), nil
	}
	return buf.String(), nil
}

// StopContainer gracefully stops a container by ID.
// Exposed to the Wails frontend.
func (a *App) StopContainer(id string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cli, err := dockerClient()
	if err != nil {
		return err
	}
	defer cli.Close()

	return cli.ContainerStop(ctx, id, container.StopOptions{})
}

// StartContainer starts a (stopped) container by ID.
// Exposed to the Wails frontend.
func (a *App) StartContainer(id string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cli, err := dockerClient()
	if err != nil {
		return err
	}
	defer cli.Close()

	return cli.ContainerStart(ctx, id, container.StartOptions{})
}

// DeleteContainer force-removes a container by ID. Force is required so that
// running containers can be removed without a separate stop step.
// Exposed to the Wails frontend.
func (a *App) DeleteContainer(id string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cli, err := dockerClient()
	if err != nil {
		return err
	}
	defer cli.Close()

	return cli.ContainerRemove(ctx, id, container.RemoveOptions{Force: true})
}

// GetServerPing checks reachability and latency via ICMP ping (using the system ping command)
// and falls back to HTTP ping.
func (a *App) GetServerPing(ipOrDomain string) ServerStatus {
	if ipOrDomain == "" {
		return ServerStatus{Error: "host not configured"}
	}

	host := ipOrDomain
	if h, _, err := net.SplitHostPort(ipOrDomain); err == nil {
		host = h
	}

	// Try ICMP Ping
	icmpOnline, icmpLatency, icmpErr := a.icmpPing(host)
	if icmpOnline {
		return ServerStatus{Host: ipOrDomain, Online: true, Latency: icmpLatency}
	}

	// Try HTTP Ping as fallback
	httpOnline, httpLatency, httpErr := a.httpPing(ipOrDomain)
	if httpOnline {
		return ServerStatus{Host: ipOrDomain, Online: true, Latency: httpLatency}
	}

	errMsg := "unreachable"
	if icmpErr != nil {
		errMsg += "; ICMP: " + icmpErr.Error()
	}
	if httpErr != nil {
		errMsg += "; HTTP: " + httpErr.Error()
	}
	return ServerStatus{Host: ipOrDomain, Online: false, Error: errMsg}
}

func (a *App) icmpPing(host string) (bool, float64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "ping", "-c", "1", "-t", "2", host)
	out, err := cmd.Output()
	if err != nil {
		return false, 0, err
	}

	re := regexp.MustCompile(`time=([0-9.]+)\s*ms`)
	if matches := re.FindSubmatch(out); len(matches) > 1 {
		latency, err := strconv.ParseFloat(string(matches[1]), 64)
		if err == nil {
			return true, latency, nil
		}
	}

	reStats := regexp.MustCompile(`round-trip\s+min/avg/max/stddev\s*=\s*[0-9.]+/([0-9.]+)/[0-9.]+/[0-9.]+`)
	if matchesStats := reStats.FindSubmatch(out); len(matchesStats) > 1 {
		latency, err := strconv.ParseFloat(string(matchesStats[1]), 64)
		if err == nil {
			return true, latency, nil
		}
	}

	return false, 0, fmt.Errorf("failed to parse ping output")
}

func (a *App) httpPing(ipOrDomain string) (bool, float64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	target := ipOrDomain
	if !strings.HasPrefix(target, "http://") && !strings.HasPrefix(target, "https://") {
		target = "http://" + target
	}

	parsedURL, err := url.Parse(target)
	if err != nil {
		return false, 0, err
	}

	if parsedURL.Scheme == "" {
		parsedURL.Scheme = "http"
	}

	start := time.Now()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsedURL.String(), nil)
	if err != nil {
		return false, 0, err
	}
	req.Header.Set("User-Agent", "Glance-Widget/1.0")

	client := &http.Client{
		Timeout: 3 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	resp, err := client.Do(req)
	latency := float64(time.Since(start).Microseconds()) / 1000.0
	if err != nil {
		if parsedURL.Scheme == "http" {
			parsedURL.Scheme = "https"
			start = time.Now()
			req2, err2 := http.NewRequestWithContext(ctx, http.MethodGet, parsedURL.String(), nil)
			if err2 == nil {
				req2.Header.Set("User-Agent", "Glance-Widget/1.0")
				resp2, err3 := client.Do(req2)
				latency = float64(time.Since(start).Microseconds()) / 1000.0
				if err3 == nil {
					resp2.Body.Close()
					return true, latency, nil
				}
			}
		}
		return false, 0, err
	}
	resp.Body.Close()
	return true, latency, nil
}
