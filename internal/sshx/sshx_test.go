package sshx

import (
	"os"
	"strings"
	"testing"
)

func TestParseMetrics(t *testing.T) {
	raw := "Welcome banner\n=METRICS_START=\n12345.67\n8000 2000\n100000 25000\n12.5\n0.42 0.58 0.50\n=METRICS_END=\nignored\n"
	got := ParseMetrics(raw)
	want := Metrics{CPUUsage: 12.5, MemTotal: 8000, MemUsed: 2000, DiskTotal: 100000, DiskUsed: 25000, Uptime: 12345.67, LoadAvg: "0.42, 0.58, 0.50"}
	if got != want {
		t.Fatalf("got %+v\nwant %+v", got, want)
	}
}

func TestParseMetricsIncomplete(t *testing.T) {
	if got := ParseMetrics("=METRICS_START=\n1\n2 3\n=METRICS_END="); got.Error == "" {
		t.Fatal("expected error")
	}
}

func TestSanitizeID(t *testing.T) {
	cases := map[string]string{
		"abc-123":    "abc-123",
		"My Server!": "my-server",
		"../../etc":  "etc",
		"":           "default",
		"///":        "default",
	}
	for in, want := range cases {
		if got := SanitizeID(in); got != want {
			t.Errorf("SanitizeID(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestKeyStoreSaveAndDelete(t *testing.T) {
	ks, err := NewKeyStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	p, err := ks.Save("srv1", "  -----BEGIN KEY-----\nabc\n-----END KEY-----  ")
	if err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(p)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("perm = %o", info.Mode().Perm())
	}
	b, _ := os.ReadFile(p)
	if !strings.HasPrefix(string(b), "-----BEGIN") || !strings.HasSuffix(string(b), "-----\n") {
		t.Fatalf("content = %q", b)
	}
	ks.Delete("srv1")
	if _, err := os.Stat(p); !os.IsNotExist(err) {
		t.Fatal("key not deleted")
	}
	if _, err := ks.Save("", "x"); err == nil {
		t.Fatal("expected error for empty id")
	}
	if _, err := ks.Save("a", "   "); err == nil {
		t.Fatal("expected error for empty content")
	}
}
