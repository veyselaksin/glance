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
	"dev-stats-widget/internal/secrets"
	"dev-stats-widget/internal/sshx"
)

// App wires the domain packages together and exposes the bound services.
type App struct {
	Bridge  *bridge.Bridge
	Config  *config.Store
	Secrets secrets.Store
	GitHub  *github.Client
	Docker  *docker.Client
	SSH     *sshx.Manager
	Keys    *sshx.KeyStore
	Poller  *poller.Poller

	bindings []any
}

// New builds the application from the data directory (normally ~/.glance),
// storing credentials in sec.
func New(dataDir, version string, sec secrets.Store) (*App, error) {
	keys, err := sshx.NewKeyStore(dataDir)
	if err != nil {
		return nil, err
	}
	a := &App{
		Bridge:  bridge.New(),
		Config:  config.Open(dataDir),
		Secrets: sec,
		GitHub:  github.New(),
		SSH:     sshx.NewManager(),
		Keys:    keys,
	}
	if err := a.Config.MigrateSecrets(sec); err != nil {
		// Non-fatal: secrets stay in config.json and migration retries next launch.
		slog.Error("config: migrating secrets to keychain", "err", err)
	}
	a.Docker = docker.New(a.Config.Get().DockerSocket)
	a.Poller = &poller.Poller{
		Interval: 30 * time.Second,
		GitHub:   a.GitHub,
		Docker:   a.Docker,
		Bridge:   a.Bridge,
		Sources: func() poller.Sources {
			c := a.Config.Get()
			return poller.Sources{GitHubUsername: c.GitHubUsername, GitHubToken: a.githubToken(), ServerHost: c.ServerHost}
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

// githubToken reads the token from the keychain, falling back to a legacy
// plain-text token that has not been migrated yet.
func (a *App) githubToken() string {
	tok, err := a.Secrets.Get(secrets.GitHubToken)
	if err != nil {
		slog.Warn("keychain: read github token", "err", err)
	}
	if tok == "" {
		tok = a.Config.Get().GitHubToken
	}
	return tok
}
