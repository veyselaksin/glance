package github

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

var fixedNow = time.Date(2026, 7, 1, 10, 0, 0, 0, time.UTC)

func testClient(t *testing.T, h http.Handler) *Client {
	t.Helper()
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	return &Client{HTTP: srv.Client(), APIBase: srv.URL, WebBase: srv.URL, Now: func() time.Time { return fixedNow }}
}

func TestPickToday(t *testing.T) {
	days := []Day{{"2026-06-29", 1}, {"2026-06-30", 2}, {"2026-07-01", 7}}
	if got := PickToday(days, fixedNow); got != 7 {
		t.Fatalf("today: got %d", got)
	}
	if got := PickToday(days[:2], fixedNow); got != 2 {
		t.Fatalf("yesterday fallback: got %d", got)
	}
	if got := PickToday(days[:1], fixedNow); got != 1 {
		t.Fatalf("last-day fallback: got %d", got)
	}
	if got := PickToday(nil, fixedNow); got != 0 {
		t.Fatalf("empty: got %d", got)
	}
}

func TestPushedSince(t *testing.T) {
	since := startOfToday(fixedNow)
	repos := []Repo{
		{"me/new", "2026-07-01T08:00:00Z"},
		{"me/edge", since.Format(time.RFC3339)},
		{"me/old", "2026-06-30T23:00:00Z"},
		{"me/bad", ""},
	}
	got := PushedSince(repos, since)
	if strings.Join(got, ",") != "me/new,me/edge" {
		t.Fatalf("got %v", got)
	}
}

func TestParseContributionsPage(t *testing.T) {
	cases := map[string]string{
		"date-then-count": `<td data-date="2026-07-01" data-level="2" data-count="5">`,
		"count-then-date": `<rect data-count="5" data-date="2026-07-01"/>`,
		"aria-label":      `<td aria-label="5 contributions on July 1, 2026">`,
	}
	for name, html := range cases {
		if got := ParseContributionsPage([]byte(html), fixedNow); got != 5 {
			t.Errorf("%s: got %d", name, got)
		}
	}
	if got := ParseContributionsPage([]byte("nothing"), fixedNow); got != 0 {
		t.Errorf("no match: got %d", got)
	}
}

func TestStatsWithToken(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/graphql", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer tok" {
			t.Errorf("missing auth header")
		}
		fmt.Fprint(w, `{"data":{"user":{"contributionsCollection":{"contributionCalendar":{"weeks":[{"contributionDays":[{"date":"2026-07-01","contributionCount":4}]}]}}}}}`)
	})
	mux.HandleFunc("/user/repos", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode([]Repo{{"me/a", "2026-07-01T09:00:00Z"}, {"me/old", "2026-01-01T00:00:00Z"}})
	})
	mux.HandleFunc("/repos/me/a/commits", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `[{"sha":"1"},{"sha":"2"},{"sha":"3"}]`)
	})
	mux.HandleFunc("/repos/me/old/commits", func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("old repo should not be queried")
	})

	got := testClient(t, mux).Stats(context.Background(), "me", "tok")
	if got != (Stats{Username: "me", Contributions: 4, Commits: 3}) {
		t.Fatalf("got %+v", got)
	}
}

func TestStatsUnauthorizedFallsBackToScraper(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/graphql", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusUnauthorized) })
	mux.HandleFunc("/user/repos", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusUnauthorized) })
	mux.HandleFunc("/users/me/contributions", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `<td data-date="2026-07-01" data-count="9">`)
	})
	got := testClient(t, mux).Stats(context.Background(), "me", "expired")
	if got.Contributions != 9 || got.Error != "" {
		t.Fatalf("got %+v", got)
	}
}

func TestStatsNoUsername(t *testing.T) {
	if got := New().Stats(context.Background(), "", ""); got.Error == "" {
		t.Fatal("expected error")
	}
}

func TestRequestDeviceCode(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/login/device/code", func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		if r.Form.Get("client_id") != "cid" {
			t.Errorf("client_id = %q", r.Form.Get("client_id"))
		}
		fmt.Fprint(w, `{"device_code":"dc","user_code":"AB-CD","verification_uri":"https://github.com/login/device","expires_in":900,"interval":5}`)
	})
	dc, err := testClient(t, mux).RequestDeviceCode(context.Background(), "cid")
	if err != nil {
		t.Fatal(err)
	}
	if dc.UserCode != "AB-CD" || dc.AuthURL() != "https://github.com/login/device?user_code=AB-CD" {
		t.Fatalf("got %+v / %s", dc, dc.AuthURL())
	}
}
