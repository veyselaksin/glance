// Package api holds the thin, Wails-bound services the frontend calls.
// Business logic lives in internal/*; these types only adapt it.
package api

import (
	"context"
	"log/slog"
	"time"

	"dev-stats-widget/internal/bridge"
	"dev-stats-widget/internal/config"
	"dev-stats-widget/internal/docker"
	"dev-stats-widget/internal/github"
	"dev-stats-widget/internal/poller"
	"dev-stats-widget/internal/sshx"
)

// App wires the domain packages together and exposes the bound services.
type App struct {
	Bridge *bridge.Bridge
	Config *config.Store
	GitHub *github.Client
	Docker *docker.Client
	SSH    *sshx.Manager
	Keys   *sshx.KeyStore
	Poller *poller.Poller

	bindings []any
}

// New builds the application from the data directory (normally ~/.glance).
func New(dataDir, version string) (*App, error) {
	keys, err := sshx.NewKeyStore(dataDir)
	if err != nil {
		return nil, err
	}
	a := &App{
		Bridge: bridge.New(),
		Config: config.Open(dataDir),
		GitHub: github.New(),
		SSH:    sshx.NewManager(),
		Keys:   keys,
	}
	a.Docker = docker.New(a.Config.Get().DockerSocket)
	a.Poller = &poller.Poller{
		Interval: 30 * time.Second,
		GitHub:   a.GitHub,
		Docker:   a.Docker,
		Bridge:   a.Bridge,
		Sources: func() poller.Sources {
			c := a.Config.Get()
			return poller.Sources{GitHubUsername: c.GitHubUsername, GitHubToken: c.GitHubToken, ServerHost: c.ServerHost}
		},
	}
	a.SSH.OnOutput = func(id, data string) {
		a.Bridge.Emit(bridge.EventSSHOutput, map[string]string{"session_id": id, "data": data})
	}
	a.SSH.OnClosed = func(id, reason string) {
		a.Bridge.Emit(bridge.EventSSHClosed, map[string]string{"session_id": id, "reason": reason})
	}

	a.bindings = []any{
		&SystemService{app: a, version: version},
		&SettingsService{app: a},
		&GitHubService{app: a},
		&DockerService{app: a},
		&ServerService{app: a},
	}
	return a, nil
}

// Bindings returns the structs Wails should expose to the frontend.
func (a *App) Bindings() []any {
	return a.bindings
}

// Startup is the Wails OnStartup hook.
func (a *App) Startup(ctx context.Context) {
	a.Bridge.SetContext(ctx)
	slog.Info("glance: started")
	go a.Poller.Run(ctx)
}

// Shutdown is the Wails OnShutdown hook.
func (a *App) Shutdown(context.Context) {
	a.SSH.CloseAll()
	a.Docker.Close()
}
