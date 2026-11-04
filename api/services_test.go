package api

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"dev-stats-widget/internal/secrets"
)

func newTestApp(t *testing.T) (*App, secrets.Memory, string) {
	t.Helper()
	dir := t.TempDir()
	sec := secrets.Memory{}
	a, err := New(dir, "test", sec)
	if err != nil {
		t.Fatal(err)
	}
	return a, sec, dir
}

func readConfig(t *testing.T, dir string) string {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(dir, "config.json"))
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func TestServerPasswordGoesToKeychainOnly(t *testing.T) {
	a, sec, dir := newTestApp(t)
	svc := &ServerService{app: a}

	id, err := svc.SaveServer(Server{Name: "box", IP: "10.0.0.1", Password: "hunter2"})
	if err != nil {
		t.Fatal(err)
	}
	if sec[secrets.SSHPassword(id)] != "hunter2" {
		t.Fatalf("keychain = %v", sec)
	}
	if strings.Contains(readConfig(t, dir), "hunter2") {
		t.Fatal("password written to config.json")
	}

	list := svc.GetServers()
	if len(list) != 1 || !list[0].HasPassword || list[0].Password != "" {
		t.Fatalf("GetServers = %+v", list)
	}
	if _, tgt, _ := svc.target(id); tgt.Password != "hunter2" || tgt.Port != 22 || tgt.User != "root" {
		t.Fatalf("target = %+v", tgt)
	}

	// Updating without a password keeps the stored one.
	if _, err := svc.SaveServer(Server{ID: id, Name: "box2", IP: "10.0.0.1"}); err != nil {
		t.Fatal(err)
	}
	if sec[secrets.SSHPassword(id)] != "hunter2" || svc.GetServers()[0].Name != "box2" {
		t.Fatal("update lost password or name")
	}

	// Switching to key auth drops the password.
	if _, err := svc.SaveServer(Server{ID: id, Name: "box2", IP: "10.0.0.1", AuthMethod: "private_key", PrivateKeyPath: "/k"}); err != nil {
		t.Fatal(err)
	}
	if _, ok := sec[secrets.SSHPassword(id)]; ok {
		t.Fatal("password kept after switching to key auth")
	}

	if err := svc.DeleteServer(id); err != nil || len(svc.GetServers()) != 0 {
		t.Fatalf("delete: %v / %+v", err, svc.GetServers())
	}
}

func TestSettingsNeverExposeToken(t *testing.T) {
	a, sec, _ := newTestApp(t)
	settings := &SettingsService{app: a}
	if settings.GetConfig().GitHubConnected {
		t.Fatal("connected without token")
	}
	sec[secrets.GitHubToken] = "ghp_x"
	if !settings.GetConfig().GitHubConnected {
		t.Fatal("not connected with token")
	}

	if err := settings.SaveConfig(Settings{ServerHost: "example.com", Theme: "light", GitHubUsername: "spoofed"}); err != nil {
		t.Fatal(err)
	}
	got := a.Config.Get()
	if got.ServerHost != "example.com" || got.Theme != "light" || got.GitHubUsername != "" {
		t.Fatalf("config = %+v", got)
	}

	if err := (&GitHubService{app: a}).SignOut(); err != nil {
		t.Fatal(err)
	}
	if _, ok := sec[secrets.GitHubToken]; ok || settings.GetConfig().GitHubConnected {
		t.Fatal("token survived sign-out")
	}
}

func TestNewMigratesLegacySecrets(t *testing.T) {
	dir := t.TempDir()
	legacy := `{"github_username":"me","github_token":"ghp_legacy","servers":[{"id":"s1","name":"n","ip":"1.2.3.4","auth_method":"password","password":"pw"}]}`
	if err := os.WriteFile(filepath.Join(dir, "config.json"), []byte(legacy), 0o600); err != nil {
		t.Fatal(err)
	}
	sec := secrets.Memory{}
	a, err := New(dir, "test", sec)
	if err != nil {
		t.Fatal(err)
	}
	if a.githubToken() != "ghp_legacy" || sec[secrets.SSHPassword("s1")] != "pw" {
		t.Fatalf("keychain = %v", sec)
	}
	if s := readConfig(t, dir); strings.Contains(s, "ghp_legacy") || strings.Contains(s, `"pw"`) {
		t.Fatalf("secrets left on disk: %s", s)
	}
}
