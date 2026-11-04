package sshx

import (
	"fmt"
	"io"
	"net"
	"os"
	"strconv"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"
)

// Target is everything needed to dial a server.
type Target struct {
	Host     string
	Port     int
	User     string
	Password string // used when KeyPath is empty
	KeyPath  string
}

// Dial opens an SSH client connection to t.
//
// Host keys are not verified yet (InsecureIgnoreHostKey), matching the
// previous behaviour; known_hosts support is tracked separately.
func Dial(t Target) (*ssh.Client, error) {
	if t.Port == 0 {
		t.Port = 22
	}
	if t.User == "" {
		t.User = "root"
	}
	var auth ssh.AuthMethod
	if t.KeyPath != "" {
		keyBytes, err := os.ReadFile(t.KeyPath)
		if err != nil {
			return nil, fmt.Errorf("read private key: %w", err)
		}
		signer, err := ssh.ParsePrivateKey(keyBytes)
		if err != nil {
			return nil, fmt.Errorf("parse private key: %w", err)
		}
		auth = ssh.PublicKeys(signer)
	} else {
		auth = ssh.Password(t.Password)
	}
	addr := net.JoinHostPort(t.Host, strconv.Itoa(t.Port))
	client, err := ssh.Dial("tcp", addr, &ssh.ClientConfig{
		User:            t.User,
		Auth:            []ssh.AuthMethod{auth},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), //nolint:gosec // see doc comment
		Timeout:         10 * time.Second,
	})
	if err != nil {
		return nil, fmt.Errorf("dial %s: %w", addr, err)
	}
	return client, nil
}

type session struct {
	client  *ssh.Client
	session *ssh.Session
	stdin   io.WriteCloser
}

// Manager tracks interactive PTY sessions.
type Manager struct {
	// OnOutput receives terminal output; OnClosed fires once when a session
	// ends on its own (not via Close).
	OnOutput func(id, data string)
	OnClosed func(id, reason string)

	mu       sync.Mutex
	sessions map[string]*session
}

// NewManager returns an empty Manager.
func NewManager() *Manager { return &Manager{sessions: map[string]*session{}} }

// Open dials t, starts an xterm-256color shell and streams its output.
func (m *Manager) Open(t Target) (string, error) {
	client, err := Dial(t)
	if err != nil {
		return "", err
	}
	fail := func(step string, err error) (string, error) {
		client.Close()
		return "", fmt.Errorf("%s: %w", step, err)
	}
	sess, err := client.NewSession()
	if err != nil {
		return fail("new session", err)
	}
	modes := ssh.TerminalModes{ssh.ECHO: 1, ssh.TTY_OP_ISPEED: 14400, ssh.TTY_OP_OSPEED: 14400}
	if err := sess.RequestPty("xterm-256color", 40, 120, modes); err != nil {
		return fail("request pty", err)
	}
	stdin, err := sess.StdinPipe()
	if err != nil {
		return fail("stdin pipe", err)
	}
	stdout, err := sess.StdoutPipe()
	if err != nil {
		return fail("stdout pipe", err)
	}
	if err := sess.Shell(); err != nil {
		return fail("start shell", err)
	}

	id := NewID()
	m.mu.Lock()
	m.sessions[id] = &session{client: client, session: sess, stdin: stdin}
	m.mu.Unlock()

	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := stdout.Read(buf)
			if n > 0 && m.OnOutput != nil {
				m.OnOutput(id, string(buf[:n]))
			}
			if err != nil {
				// Only report sessions that ended remotely; Close() already
				// removed locally-closed ones.
				if m.remove(id) && m.OnClosed != nil {
					m.OnClosed(id, err.Error())
				}
				return
			}
		}
	}()
	return id, nil
}

func (m *Manager) lookup(id string) (*session, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.sessions[id]
	if !ok {
		return nil, fmt.Errorf("no active session: %s", id)
	}
	return s, nil
}

// Write sends keystrokes to the remote shell.
func (m *Manager) Write(id, data string) error {
	s, err := m.lookup(id)
	if err != nil {
		return err
	}
	_, err = s.stdin.Write([]byte(data))
	return err
}

// Resize updates the remote PTY size.
func (m *Manager) Resize(id string, cols, rows int) error {
	s, err := m.lookup(id)
	if err != nil {
		return err
	}
	return s.session.WindowChange(rows, cols)
}

// Close ends a session. Closing an unknown session is a no-op.
func (m *Manager) Close(id string) { m.remove(id) }

// CloseAll ends every session (app shutdown).
func (m *Manager) CloseAll() {
	m.mu.Lock()
	ids := make([]string, 0, len(m.sessions))
	for id := range m.sessions {
		ids = append(ids, id)
	}
	m.mu.Unlock()
	for _, id := range ids {
		m.remove(id)
	}
}

// remove closes and forgets a session, reporting whether it existed.
func (m *Manager) remove(id string) bool {
	m.mu.Lock()
	s, ok := m.sessions[id]
	delete(m.sessions, id)
	m.mu.Unlock()
	if ok {
		_ = s.stdin.Close()
		_ = s.session.Close()
		_ = s.client.Close()
	}
	return ok
}
