package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestOpenMissingFileYieldsEmpty(t *testing.T) {
	s := Open(t.TempDir())
	if got := s.Get(); got.GitHubUsername != "" || len(got.Servers) != 0 {
		t.Fatalf("expected empty config, got %+v", got)
	}
}

func TestUpdatePersistsWithOwnerOnlyPerms(t *testing.T) {
	dir := t.TempDir()
	s := Open(dir)
	if _, err := s.Update(func(c *Config) {
		c.GitHubUsername = "octocat"
		c.Servers = append(c.Servers, ServerConfig{ID: "a", Name: "box"})
	}); err != nil {
		t.Fatal(err)
	}

	info, err := os.Stat(filepath.Join(dir, "config.json"))
	if err != nil {
		t.Fatal(err)
	}
	if perm := info.Mode().Perm(); perm != 0o600 {
		t.Fatalf("perm = %o, want 600", perm)
	}

	reloaded := Open(dir).Get()
	if reloaded.GitHubUsername != "octocat" || len(reloaded.Servers) != 1 {
		t.Fatalf("reloaded = %+v", reloaded)
	}
	if srv, ok := Open(dir).FindServer("a"); !ok || srv.Name != "box" {
		t.Fatalf("FindServer = %+v, %v", srv, ok)
	}
}

func TestGetReturnsCopy(t *testing.T) {
	s := Open(t.TempDir())
	_, _ = s.Update(func(c *Config) { c.Servers = []ServerConfig{{ID: "a"}} })
	got := s.Get()
	got.Servers[0].ID = "mutated"
	if s.Get().Servers[0].ID != "a" {
		t.Fatal("Get leaked internal slice")
	}
}

func TestCorruptFileYieldsEmpty(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "config.json"), []byte("{not json"), 0o600); err != nil {
		t.Fatal(err)
	}
	if got := Open(dir).Get(); got.GitHubUsername != "" {
		t.Fatalf("got %+v", got)
	}
}
