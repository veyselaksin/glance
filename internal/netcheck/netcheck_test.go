package netcheck

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestParsePingOutput(t *testing.T) {
	cases := []struct {
		out  string
		want float64
		ok   bool
	}{
		{"64 bytes from 1.1.1.1: icmp_seq=0 ttl=57 time=12.345 ms", 12.345, true},
		{"round-trip min/avg/max/stddev = 10.0/11.5/13.0/1.0 ms", 11.5, true},
		{"Request timeout for icmp_seq 0", 0, false},
	}
	for _, c := range cases {
		got, ok := ParsePingOutput([]byte(c.out))
		if got != c.want || ok != c.ok {
			t.Errorf("%q: got (%v,%v) want (%v,%v)", c.out, got, ok, c.want, c.ok)
		}
	}
}

func TestPingEmptyHost(t *testing.T) {
	if got := Ping(context.Background(), ""); got.Error == "" || got.Online {
		t.Fatalf("got %+v", got)
	}
}

func TestHTTPPing(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/elsewhere", http.StatusFound) // redirects are not followed
	}))
	defer srv.Close()
	ms, err := httpPing(context.Background(), srv.URL)
	if err != nil || ms < 0 {
		t.Fatalf("got (%v, %v)", ms, err)
	}
}
