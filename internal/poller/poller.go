// Package poller periodically gathers the overview snapshot (GitHub, Docker,
// primary server) and pushes it to the frontend.
package poller

import (
	"context"
	"fmt"
	"sync"
	"time"

	"dev-stats-widget/internal/bridge"
	"dev-stats-widget/internal/docker"
	"dev-stats-widget/internal/github"
	"dev-stats-widget/internal/netcheck"
)

// Snapshot is the overview payload sent as data_updated.
type Snapshot struct {
	UpdatedAt string          `json:"updated_at"`
	GitHub    github.Stats    `json:"github"`
	Docker    docker.Summary  `json:"docker"`
	Server    netcheck.Status `json:"server"`
}

// Sources are the inputs for one refresh, read fresh each time.
type Sources struct {
	GitHubUsername string
	GitHubToken    string
	ServerHost     string
}

// Poller refreshes on an interval and on demand. Concurrent refresh requests
// coalesce into a single pending run.
type Poller struct {
	Interval time.Duration
	Sources  func() Sources
	GitHub   *github.Client
	Docker   *docker.Client
	Bridge   *bridge.Bridge

	mu      sync.RWMutex
	last    Snapshot
	trigger chan struct{}
	once    sync.Once
}

func (p *Poller) init() {
	p.once.Do(func() { p.trigger = make(chan struct{}, 1) })
}

// Last returns the most recent snapshot (zero value before the first run).
func (p *Poller) Last() Snapshot {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.last
}

// Refresh requests an immediate refresh without blocking.
func (p *Poller) Refresh() {
	p.init()
	select {
	case p.trigger <- struct{}{}:
	default: // one already pending
	}
}

// Run refreshes immediately, then on every tick or Refresh, until ctx ends.
func (p *Poller) Run(ctx context.Context) {
	p.init()
	interval := p.Interval
	if interval <= 0 {
		interval = 30 * time.Second
	}
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		p.refresh(ctx)
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		case <-p.trigger:
			t.Reset(interval)
		}
	}
}

func (p *Poller) refresh(ctx context.Context) {
	src := p.Sources()
	p.Bridge.Log("SYS", "Refreshing tracked metrics...")

	// The three sources are independent; fetch them in parallel.
	var (
		wg   sync.WaitGroup
		snap Snapshot
	)
	wg.Add(3)
	go func() {
		defer wg.Done()
		c, cancel := context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
		snap.GitHub = p.GitHub.Stats(c, src.GitHubUsername, src.GitHubToken)
	}()
	go func() {
		defer wg.Done()
		c, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		snap.Docker = p.Docker.Summary(c)
	}()
	go func() {
		defer wg.Done()
		snap.Server = netcheck.Ping(ctx, src.ServerHost)
	}()
	wg.Wait()
	snap.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	if e := snap.GitHub.Error; e != "" {
		p.Bridge.Log("GIT", "GitHub Error: "+e)
	} else {
		p.Bridge.Log("GIT", fmt.Sprintf("Synced: %d contributions, %d commits today", snap.GitHub.Contributions, snap.GitHub.Commits))
	}
	if e := snap.Docker.Error; e != "" {
		p.Bridge.Log("DOCK", "Docker Error: "+e)
	} else {
		p.Bridge.Log("DOCK", fmt.Sprintf("Synced container status: %d running, %d stopped", snap.Docker.Running, snap.Docker.Stopped))
	}
	if e := snap.Server.Error; e != "" {
		p.Bridge.Log("NET", "Server Ping Error: "+e)
	} else {
		p.Bridge.Log("NET", fmt.Sprintf("Pinged server: %s (%.1f ms)", snap.Server.Host, snap.Server.Latency))
	}

	p.mu.Lock()
	p.last = snap
	p.mu.Unlock()

	p.Bridge.Log("SYS", "Metrics refreshed")
	p.Bridge.Emit(bridge.EventDataUpdated, snap)
}
