// Package secrets stores credentials in the OS keychain (macOS Keychain).
package secrets

import (
	"errors"

	"github.com/zalando/go-keyring"
)

// Service is the keychain service name all Glance items are stored under.
const Service = "dev.glance"

// Keys used by Glance.
const GitHubToken = "github_token"

// SSHPassword returns the key for a server's SSH password.
func SSHPassword(serverID string) string { return "ssh_password:" + serverID }

// Store reads and writes secrets.
type Store interface {
	// Get returns "" (and no error) when the secret does not exist.
	Get(key string) (string, error)
	Set(key, value string) error
	// Delete is a no-op when the secret does not exist.
	Delete(key string) error
}

// Keychain is the OS-backed Store.
type Keychain struct{}

// Get implements Store.
func (Keychain) Get(key string) (string, error) {
	v, err := keyring.Get(Service, key)
	if errors.Is(err, keyring.ErrNotFound) {
		return "", nil
	}
	return v, err
}

// Set implements Store.
func (Keychain) Set(key, value string) error { return keyring.Set(Service, key, value) }

// Delete implements Store.
func (Keychain) Delete(key string) error {
	if err := keyring.Delete(Service, key); err != nil && !errors.Is(err, keyring.ErrNotFound) {
		return err
	}
	return nil
}

// Memory is an in-process Store for tests.
type Memory map[string]string

// Get implements Store.
func (m Memory) Get(key string) (string, error) { return m[key], nil }

// Set implements Store.
func (m Memory) Set(key, value string) error { m[key] = value; return nil }

// Delete implements Store.
func (m Memory) Delete(key string) error { delete(m, key); return nil }
