// Package sshx manages SSH connections, interactive PTY sessions, private
// key files and remote metric collection.
package sshx

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// NewID returns a random 16-hex-char identifier.
func NewID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// KeyStore stores per-server private keys as 0600 files in a 0700 directory,
// kept out of config.json.
type KeyStore struct{ Dir string }

// NewKeyStore returns a KeyStore rooted at baseDir/ssh_keys, creating it.
func NewKeyStore(baseDir string) (*KeyStore, error) {
	dir := filepath.Join(baseDir, "ssh_keys")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, fmt.Errorf("create key dir %s: %w", dir, err)
	}
	return &KeyStore{Dir: dir}, nil
}

// SanitizeID turns a server ID into a safe filename component: only
// lowercase alphanumerics and dashes survive, empty becomes "default".
func SanitizeID(id string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(id) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			b.WriteRune(r)
		} else {
			b.WriteRune('-')
		}
	}
	if s := strings.Trim(b.String(), "-"); s != "" {
		return s
	}
	return "default"
}

func (k *KeyStore) path(serverID string) string {
	return filepath.Join(k.Dir, "id_rsa_"+SanitizeID(serverID))
}

// Save writes the key with 0600 permissions and returns its absolute path.
// crypto/ssh rejects nothing based on mode, but the file must never be
// readable by other users, even briefly, so it is created 0600 and chmod'ed
// again in case it already existed with looser permissions.
func (k *KeyStore) Save(serverID, content string) (string, error) {
	if serverID == "" {
		return "", errors.New("serverID is required")
	}
	content = strings.TrimSpace(content)
	if content == "" {
		return "", errors.New("key content is empty")
	}
	p := k.path(serverID)
	f, err := os.OpenFile(p, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return "", fmt.Errorf("create key file: %w", err)
	}
	if _, err := f.WriteString(content + "\n"); err != nil {
		f.Close()
		return "", fmt.Errorf("write key file: %w", err)
	}
	if err := f.Close(); err != nil {
		return "", fmt.Errorf("close key file: %w", err)
	}
	if err := os.Chmod(p, 0o600); err != nil {
		return "", fmt.Errorf("chmod key file: %w", err)
	}
	return p, nil
}

// Delete removes the server's key file if present.
func (k *KeyStore) Delete(serverID string) {
	_ = os.Remove(k.path(serverID))
}
