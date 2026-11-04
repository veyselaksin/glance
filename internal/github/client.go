// Package github fetches today's GitHub activity and runs the OAuth Device Flow.
package github

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// DefaultClientID is the GitHub OAuth App Client ID used by the Device Flow.
//
// The Client ID is a PUBLIC identifier, not a secret, and is safe to embed in
// an open-source binary. The Device Flow does not use a client secret. Forks
// can change this constant or override it per user in Settings → Advanced.
const DefaultClientID = "Ov23liVNutIp7uReJTyq"

const userAgent = "Glance/1.0"

// Client talks to github.com and api.github.com.
type Client struct {
	HTTP    *http.Client
	APIBase string           // https://api.github.com
	WebBase string           // https://github.com
	Now     func() time.Time // injectable clock for tests
}

// New returns a Client pointed at the real GitHub endpoints.
func New() *Client {
	return &Client{
		HTTP:    &http.Client{Timeout: 15 * time.Second},
		APIBase: "https://api.github.com",
		WebBase: "https://github.com",
		Now:     time.Now,
	}
}

// Stats holds today's contribution data.
type Stats struct {
	Username      string `json:"username"`
	Contributions int    `json:"contributions"`
	Commits       int    `json:"commits"`
	Error         string `json:"error,omitempty"`
	// Warning is a non-fatal problem: the counts are shown but may be incomplete.
	Warning string `json:"warning,omitempty"`
}

// errUnauthorized marks a 401 so Stats can fall back to the public scraper.
type errUnauthorized struct{}

func (errUnauthorized) Error() string { return "unauthorized" }

// WarnNoRepoAccess is reported when the token can list no repositories, which
// is what a GitHub App token looks like when the app is not installed.
const WarnNoRepoAccess = "This token can't see any of your repositories, so commits can't be counted. Sign in with an OAuth App that has the repo scope."

func (c *Client) newRequest(ctx context.Context, method, url, token string, body io.Reader) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	return req, nil
}

// getJSON performs a request and decodes a 200 JSON response into out.
func (c *Client) doJSON(req *http.Request, out any) error {
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusUnauthorized {
		return errUnauthorized{}
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// FetchUsername returns the login of the token's owner.
func (c *Client) FetchUsername(ctx context.Context, token string) (string, error) {
	req, err := c.newRequest(ctx, http.MethodGet, c.APIBase+"/user", token, nil)
	if err != nil {
		return "", err
	}
	var user struct {
		Login string `json:"login"`
	}
	if err := c.doJSON(req, &user); err != nil {
		return "", err
	}
	return user.Login, nil
}
