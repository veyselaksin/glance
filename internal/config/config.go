// Package config owns the persisted user configuration (~/.glance/config.json).
package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// DefaultDockerSocket is used when no socket path is configured.
const DefaultDockerSocket = "/var/run/docker.sock"

// Config holds user-configurable tracking targets, persisted in config.json.
type Config struct {
	Version        int            `json:"config_version,omitempty"`
	GitHubUsername string         `json:"github_username"`
	GitHubToken    string         `json:"github_token,omitempty"` // legacy (v1): migrated to the keychain
	ClientID       string         `json:"client_id"` // optional override of the GitHub OAuth client ID
	ServerHost     string         `json:"server_host"`
	Servers        []ServerConfig `json:"servers"`
	DockerSocket   string         `json:"docker_socket"`
	Theme          string         `json:"theme"` // "dark" | "light" | "system"
}

// ServerConfig describes a saved SSH-reachable VPS or server.
type ServerConfig struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	IP             string `json:"ip"`
	Port           int    `json:"port"`
	Username       string `json:"username"`
	AuthMethod     string `json:"auth_method"` // "password" or "private_key"
	Password       string `json:"password,omitempty"` // legacy (v1): migrated to the keychain
	PrivateKeyPath string `json:"private_key_path,omitempty"`
}

// clone returns a deep copy so callers can't mutate shared state.
func (c Config) clone() Config {
	c.Servers = append([]ServerConfig(nil), c.Servers...)
	return c
}

// DefaultDir returns (and creates) ~/.glance.
func DefaultDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".glance")
	return dir, os.MkdirAll(dir, 0o755)
}

// Store is a concurrency-safe, file-backed Config.
type Store struct {
	mu   sync.RWMutex
	path string
	cfg  Config
}

// Open loads config.json from dir. A missing or corrupt file yields an
// empty config (matching the previous behaviour) rather than an error.
func Open(dir string) *Store {
	s := &Store{path: filepath.Join(dir, "config.json")}
	if b, err := os.ReadFile(s.path); err == nil {
		if json.Unmarshal(b, &s.cfg) != nil {
			s.cfg = Config{}
		}
	}
	return s
}

// Get returns a copy of the current config.
func (s *Store) Get() Config {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.cfg.clone()
}

// Update applies fn to the config under lock and persists the result.
// The in-memory config is updated even if writing to disk fails.
func (s *Store) Update(fn func(*Config)) (Config, error) {
	s.mu.Lock()
	next := s.cfg.clone()
	fn(&next)
	s.cfg = next
	out := next.clone()
	s.mu.Unlock()
	return out, s.write(out)
}

func (s *Store) write(cfg Config) error {
	b, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return err
	}
	// Owner read/write only.
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

// FindServer looks up a saved server by ID.
func (s *Store) FindServer(id string) (ServerConfig, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, srv := range s.cfg.Servers {
		if srv.ID == id {
			return srv, true
		}
	}
	return ServerConfig{}, false
}
