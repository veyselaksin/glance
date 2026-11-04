package docker

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

// Runtime is a locally installed Docker engine provider that can be launched.
type Runtime struct {
	Name string   // human-readable, e.g. "Docker Desktop"
	Cmd  []string // command that starts it
}

// ErrNoRuntime means no launchable Docker runtime was found.
var ErrNoRuntime = errors.New("no Docker runtime found (install Docker Desktop, OrbStack or Colima)")

// fileExists is swappable in tests.
var fileExists = func(p string) bool {
	_, err := os.Stat(p)
	return err == nil
}

// DetectRuntime finds a launchable runtime, preferring the GUI apps.
// GUI apps launched from Finder get a minimal PATH, so well-known
// locations are checked explicitly instead of relying on exec.LookPath.
func DetectRuntime() (Runtime, error) {
	home, _ := os.UserHomeDir()
	apps := []struct{ name, bundle string }{
		{"Docker Desktop", "Docker.app"},
		{"OrbStack", "OrbStack.app"},
	}
	for _, a := range apps {
		for _, dir := range []string{"/Applications", filepath.Join(home, "Applications")} {
			p := filepath.Join(dir, a.bundle)
			if fileExists(p) {
				return Runtime{Name: a.name, Cmd: []string{"open", "-a", p}}, nil
			}
		}
	}
	for _, p := range []string{"/opt/homebrew/bin/colima", "/usr/local/bin/colima"} {
		if fileExists(p) {
			return Runtime{Name: "Colima", Cmd: []string{p, "start"}}, nil
		}
	}
	return Runtime{}, ErrNoRuntime
}

// Ping reports whether the daemon is reachable.
func (c *Client) Ping(ctx context.Context) error {
	cli, err := c.get()
	if err != nil {
		return err
	}
	_, err = cli.Ping(ctx)
	return err
}

// StartDaemon launches rt (if the daemon is down) and blocks until the daemon
// answers a ping or ctx expires. Docker Desktop typically needs 10–60s.
func (c *Client) StartDaemon(ctx context.Context, rt Runtime) error {
	if c.Ping(ctx) == nil {
		return nil // already running
	}
	out, err := exec.CommandContext(ctx, rt.Cmd[0], rt.Cmd[1:]...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("launch %s: %v: %s", rt.Name, err, out)
	}
	t := time.NewTicker(2 * time.Second)
	defer t.Stop()
	for {
		pctx, cancel := context.WithTimeout(ctx, 2*time.Second)
		err := c.Ping(pctx)
		cancel()
		if err == nil {
			return nil
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("%s did not become ready in time: %w", rt.Name, err)
		case <-t.C:
		}
	}
}
