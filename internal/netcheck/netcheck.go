// Package netcheck checks host reachability via ICMP (system ping) with an
// HTTP/HTTPS fallback.
package netcheck

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/url"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Status is the reachability result for a host.
type Status struct {
	Host    string  `json:"host"`
	Online  bool    `json:"online"`
	Latency float64 `json:"latency"` // milliseconds
	Error   string  `json:"error,omitempty"`
}

const timeout = 3 * time.Second

// Ping checks host (optionally host:port or a URL) and reports latency.
func Ping(ctx context.Context, host string) Status {
	if host == "" {
		return Status{Error: "host not configured"}
	}
	bare := host
	if h, _, err := net.SplitHostPort(host); err == nil {
		bare = h
	}
	ms, icmpErr := icmpPing(ctx, bare)
	if icmpErr == nil {
		return Status{Host: host, Online: true, Latency: ms}
	}
	ms, httpErr := httpPing(ctx, host)
	if httpErr == nil {
		return Status{Host: host, Online: true, Latency: ms}
	}
	return Status{Host: host, Error: "unreachable; ICMP: " + icmpErr.Error() + "; HTTP: " + httpErr.Error()}
}

func icmpPing(ctx context.Context, host string) (float64, error) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	out, err := exec.CommandContext(ctx, "ping", "-c", "1", "-t", "2", host).Output()
	if err != nil {
		return 0, err
	}
	if ms, ok := ParsePingOutput(out); ok {
		return ms, nil
	}
	return 0, errors.New("failed to parse ping output")
}

var (
	reTime  = regexp.MustCompile(`time=([0-9.]+)\s*ms`)
	reStats = regexp.MustCompile(`round-trip\s+min/avg/max/stddev\s*=\s*[0-9.]+/([0-9.]+)/[0-9.]+/[0-9.]+`)
)

// ParsePingOutput extracts the round-trip time in ms from macOS/BSD ping output.
func ParsePingOutput(out []byte) (float64, bool) {
	for _, re := range []*regexp.Regexp{reTime, reStats} {
		if m := re.FindSubmatch(out); m != nil {
			if v, err := strconv.ParseFloat(string(m[1]), 64); err == nil {
				return v, true
			}
		}
	}
	return 0, false
}

var httpClient = &http.Client{
	Timeout:       timeout,
	CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
}

// httpPing tries http:// (then https://) unless a scheme is given.
func httpPing(ctx context.Context, host string) (float64, error) {
	targets := []string{host}
	if !strings.HasPrefix(host, "http://") && !strings.HasPrefix(host, "https://") {
		targets = []string{"http://" + host, "https://" + host}
	}
	var lastErr error
	for _, t := range targets {
		u, err := url.Parse(t)
		if err != nil {
			return 0, err
		}
		ms, err := timedGet(ctx, u.String())
		if err == nil {
			return ms, nil
		}
		lastErr = err
	}
	return 0, lastErr
}

func timedGet(ctx context.Context, u string) (float64, error) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("User-Agent", "Glance/1.0")
	start := time.Now()
	resp, err := httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	resp.Body.Close()
	return float64(time.Since(start).Microseconds()) / 1000, nil
}
