package main

import (
	"bytes"
	"context"
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

// DefaultClientID is the GitHub OAuth App Client ID used by the Device Flow.
//
// The Client ID is a PUBLIC identifier — it is not a secret and is safe to
// embed in an open-source binary. (Only the Client Secret must stay private,
// and the Device Flow does not use one.)
//
// Project maintainers: create ONE OAuth App at
// https://github.com/settings/applications/new (any name/homepage, callback URL
// = urn:ietf:wg:oauth:2.0:oob, then enable "Device Flow" in the app settings)
// and paste its Client ID here. Every user who runs this build will see that
// app's name & icon on GitHub's authorization screen — no setup on their end.
//
// Forks that want their own branding can either change this constant or
// override it per-user via the "Advanced" section in GitHub Settings.
const DefaultClientID = "Iv23liUdlgD2PfwfmoAO"

// Config holds user-configurable tracking targets, persisted in config.json.
type Config struct {
	GitHubUsername string         `json:"github_username"`
	GitHubToken    string         `json:"github_token"`
	ClientID       string         `json:"client_id"` // optional override; defaults to DefaultClientID
	ServerHost     string         `json:"server_host"`
	Servers        []ServerConfig `json:"servers"`
	DockerSocket   string         `json:"docker_socket"`
}

// ServerConfig describes a saved SSH-reachable VPS or server.
type ServerConfig struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	IP             string `json:"ip"`
	Port           int    `json:"port"`
	Username       string `json:"username"`
	AuthMethod     string `json:"auth_method"` // "password" or "private_key"
	Password       string `json:"password,omitempty"`
	PrivateKeyPath string `json:"private_key_path,omitempty"`
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

type AppData struct {
	UpdatedAt string       `json:"updated_at"`
	GitHub    GitHubStats  `json:"github"`
	Docker    DockerStats  `json:"docker"`
	Server    ServerStatus `json:"server"`
}

// ─── App ──────────────────────────────────────────────────────────────────────

// App is the Wails application struct bound to the frontend.
type App struct {
	ctx      context.Context
	mu       sync.RWMutex
	cfg      Config
	last     AppData
	sshMu    sync.Mutex
	sessions map[string]*sshSession
}

// NewApp creates a new App.
func NewApp() *App {
	return &App{sessions: make(map[string]*sshSession)}
}

// startup is called by Wails when the app starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.cfg = a.loadConfig()
	// Ensure the SSH key storage directory exists at ~/.glance/ssh_keys/
	if _, err := sshKeyDir(); err != nil {
		fmt.Printf("[SSH] warning: could not create key dir: %v\n", err)
	}
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

	data := AppData{
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
		GitHub:    gh,
		Docker:    dk,
		Server:    sv,
	}

	a.mu.Lock()
	a.last = data
	a.mu.Unlock()

	runtime.EventsEmit(a.ctx, "agent_log", map[string]string{"tag": "SYS", "msg": "Metrics refreshed"})
	runtime.EventsEmit(a.ctx, "data_updated", data)
}

// ─── Data directory & persistence ─────────────────────────────────────────────

// dataDir returns (and creates) the local data directory at ~/.glance/.
func (a *App) dataDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".glance")
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
func (a *App) GetLastData() AppData {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.last
}

// StartDeviceFlow initiates GitHub's OAuth Device Flow: requests a device code,
// opens the browser for the user to authorize, then polls GitHub until the user
// approves (or the code expires). On success, stores the token + username and
// emits the "oauth_success" event to the frontend. No Client Secret required.
//
// See: https://docs.github.com/en/apps/oauth-building-oauth-apps/authorizing-oauth-apps#device-flow
func (a *App) StartDeviceFlow() error {
	clientID := DefaultClientID
	a.mu.RLock()
	if a.cfg.ClientID != "" {
		clientID = a.cfg.ClientID
	}
	a.mu.RUnlock()

	// 1. Request a device code from GitHub.
	val := url.Values{}
	val.Set("client_id", clientID)
	val.Set("scope", "read:user repo")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://github.com/login/device/code", strings.NewReader(val.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Glance/1.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("device code request failed: %w", err)
	}
	defer resp.Body.Close()

	var dc struct {
		DeviceCode      string `json:"device_code"`
		UserCode        string `json:"user_code"`
		VerificationURI string `json:"verification_uri"`
		ExpiresIn       int    `json:"expires_in"`
		Interval        int    `json:"interval"`
		Error           string `json:"error"`
		ErrorDesc       string `json:"error_description"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&dc); err != nil {
		return fmt.Errorf("device code decode error: %w", err)
	}
	if dc.Error != "" {
		return fmt.Errorf("%s: %s", dc.Error, dc.ErrorDesc)
	}
	if dc.DeviceCode == "" {
		return fmt.Errorf("GitHub returned no device code")
	}

	// 2. Open the user's browser to the verification URI (with user_code pre-filled).
	authURL := dc.VerificationURI
	if !strings.Contains(authURL, "?") {
		authURL = authURL + "?user_code=" + url.QueryEscape(dc.UserCode)
	}
	runtime.BrowserOpenURL(a.ctx, authURL)

	// 3. Tell the frontend what code the user must enter, in case the browser
	//    did not auto-fill or the user needs to type it on another device.
	runtime.EventsEmit(a.ctx, "device_code", map[string]string{
		"user_code":        dc.UserCode,
		"verification_uri": dc.VerificationURI,
	})

	// 4. Poll the token endpoint until the user authorizes or the code expires.
	interval := dc.Interval
	if interval <= 0 {
		interval = 5
	}
	expiresAt := time.Now().Add(time.Duration(dc.ExpiresIn) * time.Second)

	go func() {
		for time.Now().Before(expiresAt) {
			time.Sleep(time.Duration(interval) * time.Second)

			tval := url.Values{}
			tval.Set("client_id", clientID)
			tval.Set("device_code", dc.DeviceCode)
			tval.Set("grant_type", "urn:ietf:params:oauth:grant-type:device_code")

			tctx, tcancel := context.WithTimeout(context.Background(), 10*time.Second)
			treq, err := http.NewRequestWithContext(tctx, http.MethodPost,
				"https://github.com/login/oauth/access_token", strings.NewReader(tval.Encode()))
			if err != nil {
				tcancel()
				continue
			}
			treq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			treq.Header.Set("Accept", "application/json")
			treq.Header.Set("User-Agent", "Glance/1.0")

			tresp, err := http.DefaultClient.Do(treq)
			if err != nil {
				tcancel()
				continue
			}
			var tr struct {
				AccessToken string `json:"access_token"`
				Error       string `json:"error"`
				ErrorDesc   string `json:"error_description"`
				Interval    int    `json:"interval"`
			}
			decodeErr := json.NewDecoder(tresp.Body).Decode(&tr)
			tresp.Body.Close()
			tcancel()

			if decodeErr != nil {
				continue
			}

			switch tr.Error {
			case "authorization_pending":
				continue
			case "slow_down":
				interval += 5
				continue
			case "expired_token":
				runtime.EventsEmit(a.ctx, "oauth_error", "Device code expired. Please try again.")
				return
			case "access_denied":
				runtime.EventsEmit(a.ctx, "oauth_error", "Authorization was denied.")
				return
			case "":
				// success
				if tr.AccessToken == "" {
					runtime.EventsEmit(a.ctx, "oauth_error", "No access token returned.")
					return
				}
				username, err := a.fetchGitHubUsername(tr.AccessToken)
				if err != nil {
					runtime.EventsEmit(a.ctx, "oauth_error", "Failed to fetch GitHub profile: "+err.Error())
					return
				}
				a.mu.Lock()
				a.cfg.GitHubToken = tr.AccessToken
				a.cfg.GitHubUsername = username
				a.mu.Unlock()
				_ = a.saveConfigInternal(a.cfg)
				runtime.EventsEmit(a.ctx, "oauth_success", username)
				go a.refresh()
				return
			default:
				runtime.EventsEmit(a.ctx, "oauth_error", tr.Error+": "+tr.ErrorDesc)
				return
			}
		}
		runtime.EventsEmit(a.ctx, "oauth_error", "Device code expired. Please try again.")
	}()

	return nil
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
	req.Header.Set("User-Agent", "Glance/1.0")

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

// GetGitHubStats fetches today's GitHub contribution and commit counts.
//
// Two independent data sources are used:
//  1. GraphQL contributionCalendar → "contributions" (the GitHub graph number).
//     This is GitHub's calibrated count but has a processing delay of minutes
//     to hours, so it may lag behind actual activity.
//  2. REST /user/repos + /repos/{owner}/{repo}/commits → "commits" (actual
//     pushed commits today). This is immediate and includes private repos
//     (token has `repo` scope).
//
// "Today" is defined as midnight in the user's *local* machine timezone,
// converted to UTC for the API `since` parameter. This ensures a commit at
// 22:00 UTC on June 30 counts as "today" for a UTC+3 user whose local date
// is already July 1.
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

	contributions := a.getContributionsToday(username, token)
	commits := a.getGitHubCommitsToday(username, token)

	fmt.Printf("[GITHUB] user=%s contributions=%d commits=%d\n", username, contributions, commits)

	return GitHubStats{
		Username:      username,
		Contributions: contributions,
		Commits:       commits,
	}
}

// getContributionsToday queries the GraphQL contributionCalendar and returns
// today's contribution count. GitHub's calendar is ordered chronologically;
// the last entry is today (in GitHub's configured timezone). We try matching
// against both local and UTC dates, then fall back to the last calendar day.
func (a *App) getContributionsToday(username, token string) int {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	query := map[string]interface{}{
		"query": `query($username: String!) {
			user(login: $username) {
				contributionsCollection {
					contributionCalendar {
						totalContributions
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
		"variables": map[string]string{"username": username},
	}

	reqBytes, err := json.Marshal(query)
	if err != nil {
		fmt.Printf("[GITHUB] GraphQL marshal error: %v\n", err)
		return 0
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.github.com/graphql", strings.NewReader(string(reqBytes)))
	if err != nil {
		return 0
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Glance/1.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("[GITHUB] GraphQL request error: %v\n", err)
		return 0
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("[GITHUB] GraphQL HTTP %d\n", resp.StatusCode)
		return 0
	}

	var res struct {
		Data struct {
			User struct {
				ContributionsCollection struct {
					ContributionCalendar struct {
						TotalContributions int `json:"totalContributions"`
						Weeks              []struct {
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
		fmt.Printf("[GITHUB] GraphQL decode error: %v\n", err)
		return 0
	}

	if len(res.Errors) > 0 {
		fmt.Printf("[GITHUB] GraphQL errors: %s\n", res.Errors[0].Message)
		return 0
	}

	// Collect all days from all weeks into a flat slice.
	weeks := res.Data.User.ContributionsCollection.ContributionCalendar.Weeks
	type dayEntry struct {
		ContributionCount int
		Date              string
	}
	var allDays []dayEntry
	for _, w := range weeks {
		for _, d := range w.ContributionDays {
			allDays = append(allDays, dayEntry{ContributionCount: d.ContributionCount, Date: d.Date})
		}
	}
	if len(allDays) == 0 {
		return 0
	}

	fmt.Printf("[GITHUB] calendar totalContributions=%d, lastDay=%s count=%d\n",
		res.Data.User.ContributionsCollection.ContributionCalendar.TotalContributions,
		allDays[len(allDays)-1].Date,
		allDays[len(allDays)-1].ContributionCount)

	// Try exact date match: today local, today UTC, and yesterday (both).
	// GitHub uses the user's *profile* timezone which may differ from the
	// machine, so we cast a wide net.
	now := time.Now()
	todayLocal := now.Format("2006-01-02")
	todayUTC := now.UTC().Format("2006-01-02")
	yesterdayLocal := now.AddDate(0, 0, -1).Format("2006-01-02")
	yesterdayUTC := now.UTC().AddDate(0, 0, -1).Format("2006-01-02")

	// Scan from the end (most recent first).
	for i := len(allDays) - 1; i >= 0; i-- {
		d := allDays[i]
		if d.Date == todayLocal || d.Date == todayUTC {
			return d.ContributionCount
		}
	}

	// Fallback: if today hasn't appeared in the calendar yet (GitHub
	// processing delay), check yesterday's count as a secondary fallback.
	for i := len(allDays) - 1; i >= 0; i-- {
		d := allDays[i]
		if d.Date == yesterdayLocal || d.Date == yesterdayUTC {
			return d.ContributionCount
		}
	}

	// Final fallback: return the last calendar day's count.
	return allDays[len(allDays)-1].ContributionCount
}

// getGitHubCommitsToday counts actual commits pushed today across all of the
// user's repos. It uses the REST API:
//  1. GET /user/repos?sort=pushed — list recently pushed repos
//  2. For each repo pushed after the start of today (local TZ → UTC):
//     GET /repos/{owner}/{repo}/commits?since={sinceUTC}
//
// This bypasses the contribution calendar's processing delay and includes
// private repos (token has `repo` scope).
func (a *App) getGitHubCommitsToday(username, token string) int {
	// Calculate the start of "today" in the user's local timezone, then
	// convert to UTC for the `since` parameter.
	now := time.Now()
	startOfTodayLocal := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	sinceUTC := startOfTodayLocal.UTC().Format(time.RFC3339)

	fmt.Printf("[GITHUB] commits: since=%s (local TZ %s)\n", sinceUTC, now.Location())

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// 1. List repos sorted by most recently pushed (owner affiliation only).
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://api.github.com/user/repos?sort=pushed&per_page=20&affiliation=owner", nil)
	if err != nil {
		return 0
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Glance/1.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("[GITHUB] repos list error: %v\n", err)
		return 0
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		fmt.Printf("[GITHUB] repos list HTTP %d\n", resp.StatusCode)
		return 0
	}

	var repos []struct {
		FullName string `json:"full_name"`
		PushedAt string `json:"pushed_at"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&repos); err != nil {
		fmt.Printf("[GITHUB] repos decode error: %v\n", err)
		return 0
	}

	// Filter: only check repos that were pushed after the start of today.
	sinceTime, _ := time.Parse(time.RFC3339, sinceUTC)
	var candidates []string
	for _, r := range repos {
		if r.PushedAt == "" {
			continue
		}
		pushTime, err := time.Parse(time.RFC3339, r.PushedAt)
		if err != nil {
			continue
		}
		if pushTime.After(sinceTime) || pushTime.Equal(sinceTime) {
			candidates = append(candidates, r.FullName)
		}
	}

	fmt.Printf("[GITHUB] repos pushed today: %d (%v)\n", len(candidates), candidates)

	if len(candidates) == 0 {
		return 0
	}

	// 2. For each candidate repo, count commits since start-of-today.
	totalCommits := 0
	for _, repo := range candidates {
		count, err := a.countRepoCommits(ctx, token, repo, sinceUTC)
		if err != nil {
			fmt.Printf("[GITHUB] commits fetch error for %s: %v\n", repo, err)
			continue
		}
		fmt.Printf("[GITHUB]   %s: %d commits\n", repo, count)
		totalCommits += count
	}

	return totalCommits
}

// countRepoCommits fetches commits for a single repo since the given UTC
// timestamp and returns the count.
func (a *App) countRepoCommits(ctx context.Context, token, repoName, sinceUTC string) (int, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/commits?since=%s&per_page=100", repoName, sinceUTC)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Glance/1.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	var commits []struct {
		SHA string `json:"sha"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&commits); err != nil {
		return 0, err
	}
	return len(commits), nil
}

func (a *App) getGitHubStatsScraper(username string) GitHubStats {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	url := fmt.Sprintf("https://github.com/users/%s/contributions", username)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return GitHubStats{Username: username, Error: err.Error()}
	}
	req.Header.Set("User-Agent", "Glance/1.0")

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

	todayLocal := time.Now().Format("2006-01-02")
	todayUTC := time.Now().UTC().Format("2006-01-02")
	commits := a.getGitHubCommitsToday(username, "")
	re1 := regexp.MustCompile(`data-date="` + regexp.QuoteMeta(todayLocal) + `"[^>]*data-count="(\d+)"`)
	if m := re1.FindSubmatch(body); m != nil {
		count, _ := strconv.Atoi(string(m[1]))
		return GitHubStats{Username: username, Contributions: count, Commits: commits}
	}
	re2 := regexp.MustCompile(`data-date="` + regexp.QuoteMeta(todayUTC) + `"[^>]*data-count="(\d+)"`)
	if m := re2.FindSubmatch(body); m != nil {
		count, _ := strconv.Atoi(string(m[1]))
		return GitHubStats{Username: username, Contributions: count, Commits: commits}
	}
	re3 := regexp.MustCompile(`data-count="(\d+)"[^>]*data-date="(?:` + regexp.QuoteMeta(todayLocal) + `|` + regexp.QuoteMeta(todayUTC) + `)"`)
	if m := re3.FindSubmatch(body); m != nil {
		count, _ := strconv.Atoi(string(m[1]))
		return GitHubStats{Username: username, Contributions: count, Commits: commits}
	}
	todayFormatted := time.Now().Format("January 2, 2006")
	re4 := regexp.MustCompile(`aria-label="(\d+) contributions? on ` + regexp.QuoteMeta(todayFormatted) + `"`)
	if m := re4.FindSubmatch(body); m != nil {
		count, _ := strconv.Atoi(string(m[1]))
		return GitHubStats{Username: username, Contributions: count, Commits: commits}
	}
	return GitHubStats{Username: username, Contributions: 0, Commits: commits}
}

// GetDockerStats returns running/stopped container counts from the local Docker daemon.
func (a *App) GetDockerStats() DockerStats {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	a.mu.RLock()
	socketPath := a.cfg.DockerSocket
	a.mu.RUnlock()

	cli, err := dockerClient(socketPath)
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

// dockerClient returns a Docker SDK client connected to the configured unix
// socket with API-version negotiation enabled. Falls back to /var/run/docker.sock
// when socketPath is empty.
func dockerClient(socketPath string) (*client.Client, error) {
	if socketPath == "" {
		socketPath = "/var/run/docker.sock"
	}
	return client.NewClientWithOpts(
		client.WithHost("unix://"+socketPath),
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

	a.mu.RLock()
	socketPath := a.cfg.DockerSocket
	a.mu.RUnlock()

	cli, err := dockerClient(socketPath)
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

	a.mu.RLock()
	socketPath := a.cfg.DockerSocket
	a.mu.RUnlock()

	cli, err := dockerClient(socketPath)
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

	a.mu.RLock()
	socketPath := a.cfg.DockerSocket
	a.mu.RUnlock()

	cli, err := dockerClient(socketPath)
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

	a.mu.RLock()
	socketPath := a.cfg.DockerSocket
	a.mu.RUnlock()

	cli, err := dockerClient(socketPath)
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

	a.mu.RLock()
	socketPath := a.cfg.DockerSocket
	a.mu.RUnlock()

	cli, err := dockerClient(socketPath)
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
	req.Header.Set("User-Agent", "Glance/1.0")

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
				req2.Header.Set("User-Agent", "Glance/1.0")
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
