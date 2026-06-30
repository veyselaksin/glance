package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/crypto/ssh"
)

// ─── SSH key storage ──────────────────────────────────────────────────────────

// sshKeyDir returns the path to ~/.glance/ssh_keys/, creating it with 0700
// permissions if it doesn't exist. This directory holds per-server private
// key files, kept outside of the main config.json so secrets never end up
// in a world-readable JSON file.
func sshKeyDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve home dir: %w", err)
	}
	dir := filepath.Join(home, ".glance", "ssh_keys")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", fmt.Errorf("create key dir %s: %w", dir, err)
	}
	return dir, nil
}

// sanitizeID converts a server ID into a safe filename component. Only
// lowercase alphanumerics and dashes survive; everything else is replaced
// with a dash. An empty result falls back to "default".
func sanitizeID(id string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(id) {
		switch {
		case (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-':
			b.WriteRune(r)
		default:
			b.WriteRune('-')
		}
	}
	s := strings.Trim(b.String(), "-")
	if s == "" {
		s = "default"
	}
	return s
}

// SaveSSHKey writes the given private key content to
// ~/.glance/ssh_keys/id_rsa_[sanitized_serverId] with strict 0600
// permissions (owner read/write only). It returns the absolute path so it
// can be stored in the server config as PrivateKeyPath.
//
// The file is created with O_CREATE|O_TRUNC so existing keys are replaced
// atomically. A final explicit chmod guarantees 0600 even if the file
// pre-existed with looser permissions — the Go SSH client (and the
// underlying crypto/ssh.ParsePrivateKey) will reject keys that are
// group/world-readable.
func (a *App) SaveSSHKey(serverID string, keyContent string) (string, error) {
	if serverID == "" {
		return "", fmt.Errorf("serverID is required")
	}
	if strings.TrimSpace(keyContent) == "" {
		return "", fmt.Errorf("key content is empty")
	}

	dir, err := sshKeyDir()
	if err != nil {
		return "", err
	}

	keyPath := filepath.Join(dir, "id_rsa_"+sanitizeID(serverID))

	// Trim surrounding whitespace and ensure a trailing newline so the
	// key parser doesn't choke on a missing final line break.
	content := strings.TrimSpace(keyContent)
	if !strings.HasSuffix(content, "\n") {
		content += "\n"
	}

	// Create / truncate the file with 0600 from the outset. Using
	// os.OpenFile instead of os.WriteFile ensures the file is never
	// created with default umask permissions (which could be 0644 on
	// some systems), even briefly.
	f, err := os.OpenFile(keyPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return "", fmt.Errorf("create key file: %w", err)
	}

	if _, err := f.WriteString(content); err != nil {
		f.Close()
		return "", fmt.Errorf("write key file: %w", err)
	}
	if err := f.Close(); err != nil {
		return "", fmt.Errorf("close key file: %w", err)
	}

	// Belt-and-suspenders: explicitly chmod to 0600 in case the file
	// already existed with different permissions (OpenFile preserves the
	// existing mode when O_CREAT finds the file, subject to umask).
	if err := os.Chmod(keyPath, 0o600); err != nil {
		return "", fmt.Errorf("chmod key file: %w", err)
	}

	runtime.EventsEmit(a.ctx, "agent_log", map[string]string{
		"tag": "SSH",
		"msg": fmt.Sprintf("Saved private key to %s (0600)", keyPath),
	})

	return keyPath, nil
}

// deleteSSHKey removes the key file for the given server ID, if it exists.
// Called during DeleteServer to avoid orphaned key files.
func deleteSSHKey(serverID string) {
	dir, err := sshKeyDir()
	if err != nil {
		return
	}
	path := filepath.Join(dir, "id_rsa_"+sanitizeID(serverID))
	_ = os.Remove(path)
}

// ─── Types ────────────────────────────────────────────────────────────────────

// ServerMetrics holds a quick resource snapshot fetched via SSH.
type ServerMetrics struct {
	CPUUsage  float64 `json:"cpu_usage"`   // percentage 0-100
	MemTotal  uint64  `json:"mem_total"`   // bytes
	MemUsed   uint64  `json:"mem_used"`    // bytes
	DiskTotal uint64  `json:"disk_total"`  // bytes
	DiskUsed  uint64  `json:"disk_used"`   // bytes
	Uptime    float64 `json:"uptime"`      // seconds
	LoadAvg   string  `json:"load_avg"`    // e.g. "0.42, 0.58, 0.50"
	Error     string  `json:"error,omitempty"`
}

// sshSession wraps an active SSH connection + PTY session.
type sshSession struct {
	client  *ssh.Client
	session *ssh.Session
	stdin   io.WriteCloser
	cancel  context.CancelFunc
}

// ─── SSH client construction ──────────────────────────────────────────────────

// sshClientFor builds an *ssh.Client for the given ServerConfig.
func sshClientFor(srv ServerConfig) (*ssh.Client, error) {
	if srv.Port == 0 {
		srv.Port = 22
	}
	if srv.Username == "" {
		srv.Username = "root"
	}

	var authMethod ssh.AuthMethod
	switch srv.AuthMethod {
	case "private_key":
		keyBytes, err := os.ReadFile(srv.PrivateKeyPath)
		if err != nil {
			return nil, fmt.Errorf("read private key: %w", err)
		}
		signer, err := ssh.ParsePrivateKey(keyBytes)
		if err != nil {
			return nil, fmt.Errorf("parse private key: %w", err)
		}
		authMethod = ssh.PublicKeys(signer)
	default: // "password"
		authMethod = ssh.Password(srv.Password)
	}

	config := &ssh.ClientConfig{
		User:            srv.Username,
		Auth:            []ssh.AuthMethod{authMethod},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	addr := net.JoinHostPort(srv.IP, strconv.Itoa(srv.Port))
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		return nil, fmt.Errorf("dial %s: %w", addr, err)
	}
	return client, nil
}

// findServer looks up a server by ID under the config lock.
func (a *App) findServer(id string) (ServerConfig, bool) {
	a.mu.RLock()
	defer a.mu.RUnlock()
	for _, s := range a.cfg.Servers {
		if s.ID == id {
			return s, true
		}
	}
	return ServerConfig{}, false
}

// ─── Wails-exposed: Server CRUD ──────────────────────────────────────────────

// GetServers returns all saved server configurations.
func (a *App) GetServers() []ServerConfig {
	a.mu.RLock()
	defer a.mu.RUnlock()
	out := make([]ServerConfig, len(a.cfg.Servers))
	copy(out, a.cfg.Servers)
	// Strip passwords for the frontend
	for i := range out {
		if out[i].AuthMethod == "password" {
			out[i].Password = ""
		}
	}
	return out
}

// SaveServer adds or updates a server (upsert by ID). If ID is empty a new
// one is generated. Returns the final ID.
func (a *App) SaveServer(srv ServerConfig) (string, error) {
	if srv.Name == "" || srv.IP == "" {
		return "", fmt.Errorf("name and ip are required")
	}
	if srv.ID == "" {
		b := make([]byte, 8)
		_, _ = rand.Read(b)
		srv.ID = hex.EncodeToString(b)
	}
	if srv.Port == 0 {
		srv.Port = 22
	}
	if srv.Username == "" {
		srv.Username = "root"
	}
	if srv.AuthMethod == "" {
		srv.AuthMethod = "password"
	}

	a.mu.Lock()
	// Upsert: if password is empty on update, keep the existing one.
	found := false
	for i, existing := range a.cfg.Servers {
		if existing.ID == srv.ID {
			if srv.AuthMethod == "password" && srv.Password == "" {
				srv.Password = existing.Password
			}
			if srv.AuthMethod == "private_key" && srv.PrivateKeyPath == "" {
				srv.PrivateKeyPath = existing.PrivateKeyPath
			}
			a.cfg.Servers[i] = srv
			found = true
			break
		}
	}
	if !found {
		a.cfg.Servers = append(a.cfg.Servers, srv)
	}
	cfg := a.cfg
	a.mu.Unlock()

	err := a.saveConfigInternal(cfg)
	return srv.ID, err
}

// DeleteServer removes a server by ID.
func (a *App) DeleteServer(id string) error {
	// Clean up the SSH key file for this server, if one exists.
	deleteSSHKey(id)

	a.mu.Lock()
	filtered := a.cfg.Servers[:0]
	for _, s := range a.cfg.Servers {
		if s.ID != id {
			filtered = append(filtered, s)
		}
	}
	a.cfg.Servers = filtered
	cfg := a.cfg
	a.mu.Unlock()

	return a.saveConfigInternal(cfg)
}

// ─── Wails-exposed: SSH Terminal streaming ────────────────────────────────────

// ConnectSSH opens an interactive PTY session to the given server and streams
// output back to the frontend via the "ssh_output" Wails event. The returned
// sessionID is used by the frontend for SSHWrite / DisconnectSSH calls.
func (a *App) ConnectSSH(serverID string) (string, error) {
	srv, ok := a.findServer(serverID)
	if !ok {
		return "", fmt.Errorf("server not found: %s", serverID)
	}

	client, err := sshClientFor(srv)
	if err != nil {
		return "", err
	}

	session, err := client.NewSession()
	if err != nil {
		client.Close()
		return "", fmt.Errorf("new session: %w", err)
	}

	// Request a PTY so we get proper terminal behavior.
	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := session.RequestPty("xterm-256color", 40, 120, modes); err != nil {
		client.Close()
		return "", fmt.Errorf("request pty: %w", err)
	}

	stdin, err := session.StdinPipe()
	if err != nil {
		client.Close()
		return "", fmt.Errorf("stdin pipe: %w", err)
	}
	stdout, err := session.StdoutPipe()
	if err != nil {
		client.Close()
		return "", fmt.Errorf("stdout pipe: %w", err)
	}

	if err := session.Shell(); err != nil {
		client.Close()
		return "", fmt.Errorf("start shell: %w", err)
	}

	// Generate a session ID
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	sessionID := hex.EncodeToString(b)

	ctx, cancel := context.WithCancel(a.ctx)

	ss := &sshSession{
		client:  client,
		session: session,
		stdin:   stdin,
		cancel:  cancel,
	}

	a.sshMu.Lock()
	a.sessions[sessionID] = ss
	a.sshMu.Unlock()

	// Stream output to the frontend via Wails events
	go func() {
		buf := make([]byte, 4096)
		for {
			select {
			case <-ctx.Done():
				return
			default:
			}
			n, err := stdout.Read(buf)
			if n > 0 {
				runtime.EventsEmit(a.ctx, "ssh_output", map[string]string{
					"session_id": sessionID,
					"data":       string(buf[:n]),
				})
			}
			if err != nil {
				runtime.EventsEmit(a.ctx, "ssh_closed", map[string]string{
					"session_id": sessionID,
					"reason":     err.Error(),
				})
				a.cleanupSession(sessionID)
				return
			}
		}
	}()

	runtime.EventsEmit(a.ctx, "agent_log", map[string]string{
		"tag": "SSH",
		"msg": fmt.Sprintf("Connected to %s@%s", srv.Username, srv.IP),
	})

	return sessionID, nil
}

// SSHWrite sends user keystrokes from the frontend xterm instance to the
// remote shell's stdin.
func (a *App) SSHWrite(sessionID string, data string) error {
	a.sshMu.Lock()
	ss, ok := a.sessions[sessionID]
	a.sshMu.Unlock()
	if !ok {
		return fmt.Errorf("no active session: %s", sessionID)
	}
	_, err := ss.stdin.Write([]byte(data))
	return err
}

// SSHResize informs the remote PTY of a new window size when the xterm
// viewport is resized.
func (a *App) SSHResize(sessionID string, cols, rows int) error {
	a.sshMu.Lock()
	ss, ok := a.sessions[sessionID]
	a.sshMu.Unlock()
	if !ok {
		return fmt.Errorf("no active session: %s", sessionID)
	}
	return ss.session.WindowChange(rows, cols)
}

// DisconnectSSH closes an active SSH session and client.
func (a *App) DisconnectSSH(sessionID string) error {
	a.cleanupSession(sessionID)
	runtime.EventsEmit(a.ctx, "agent_log", map[string]string{
		"tag": "SSH",
		"msg": fmt.Sprintf("Disconnected session %s", sessionID),
	})
	return nil
}

func (a *App) cleanupSession(sessionID string) {
	a.sshMu.Lock()
	ss, ok := a.sessions[sessionID]
	if ok {
		delete(a.sessions, sessionID)
	}
	a.sshMu.Unlock()
	if !ok {
		return
	}
	if ss.cancel != nil {
		ss.cancel()
	}
	_ = ss.stdin.Close()
	_ = ss.session.Close()
	_ = ss.client.Close()
}

// ─── Wails-exposed: Quick server metrics ──────────────────────────────────────

// GetServerMetrics connects to the server, runs a set of quick read-only
// commands, and returns a parsed ServerMetrics snapshot. The connection is
// closed immediately after — no persistent session.
func (a *App) GetServerMetrics(serverID string) ServerMetrics {
	srv, ok := a.findServer(serverID)
	if !ok {
		return ServerMetrics{Error: "server not found"}
	}

	client, err := sshClientFor(srv)
	if err != nil {
		return ServerMetrics{Error: err.Error()}
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return ServerMetrics{Error: err.Error()}
	}
	defer session.Close()

	// Run a single combined command that outputs machine-parseable lines.
	script := `echo "=METRICS_START="
cat /proc/uptime 2>/dev/null | awk '{print $1}'
free -b 2>/dev/null | awk '/Mem:/ {print $2" "$3}'
df -B1 / 2>/dev/null | awk 'NR==2 {print $2" "$3}'
top -bn1 2>/dev/null | awk '/Cpu\(s\)/ {gsub(",",""); print $2+$4}'
cat /proc/loadavg 2>/dev/null | awk '{print $1" "$2" "$3}'
echo "=METRICS_END="`

	out, err := session.CombinedOutput(script)
	if err != nil {
		return ServerMetrics{Error: fmt.Sprintf("exec: %v", err)}
	}

	return parseMetrics(string(out))
}

func parseMetrics(raw string) ServerMetrics {
	m := ServerMetrics{}
	lines := strings.Split(raw, "\n")
	started := false
	var metricLines []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "=METRICS_START=" {
			started = true
			continue
		}
		if line == "=METRICS_END=" {
			break
		}
		if started && line != "" {
			metricLines = append(metricLines, line)
		}
	}
	if len(metricLines) < 5 {
		return ServerMetrics{Error: "incomplete metrics output"}
	}

	// Line 0: uptime seconds
	if v, err := strconv.ParseFloat(metricLines[0], 64); err == nil {
		m.Uptime = v
	}

	// Line 1: "total used" memory bytes
	parts := strings.Fields(metricLines[1])
	if len(parts) >= 2 {
		m.MemTotal, _ = strconv.ParseUint(parts[0], 10, 64)
		m.MemUsed, _ = strconv.ParseUint(parts[1], 10, 64)
	}

	// Line 2: "total used" disk bytes
	parts = strings.Fields(metricLines[2])
	if len(parts) >= 2 {
		m.DiskTotal, _ = strconv.ParseUint(parts[0], 10, 64)
		m.DiskUsed, _ = strconv.ParseUint(parts[1], 10, 64)
	}

	// Line 3: CPU usage percentage
	if v, err := strconv.ParseFloat(strings.TrimSpace(metricLines[3]), 64); err == nil {
		m.CPUUsage = v
	}

	// Line 4: load average "1 5 15"
	parts = strings.Fields(metricLines[4])
	if len(parts) >= 3 {
		m.LoadAvg = fmt.Sprintf("%s, %s, %s", parts[0], parts[1], parts[2])
	}

	return m
}
