package github

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// DeviceCode is GitHub's response to a device-code request.
type DeviceCode struct {
	DeviceCode      string `json:"device_code"`
	UserCode        string `json:"user_code"`
	VerificationURI string `json:"verification_uri"`
	ExpiresIn       int    `json:"expires_in"`
	Interval        int    `json:"interval"`
}

// AuthURL is the verification URL with the user code pre-filled.
func (d DeviceCode) AuthURL() string {
	if strings.Contains(d.VerificationURI, "?") {
		return d.VerificationURI
	}
	return d.VerificationURI + "?user_code=" + url.QueryEscape(d.UserCode)
}

type oauthError struct {
	Error     string `json:"error"`
	ErrorDesc string `json:"error_description"`
}

func (c *Client) postForm(ctx context.Context, path string, form url.Values, out any) error {
	req, err := c.newRequest(ctx, http.MethodPost, c.WebBase+path, "", strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return json.NewDecoder(resp.Body).Decode(out)
}

// RequestDeviceCode starts the Device Flow.
// See https://docs.github.com/en/apps/oauth-building-oauth-apps/authorizing-oauth-apps#device-flow
func (c *Client) RequestDeviceCode(ctx context.Context, clientID string) (DeviceCode, error) {
	var res struct {
		DeviceCode
		oauthError
	}
	form := url.Values{"client_id": {clientID}, "scope": {"read:user repo"}}
	if err := c.postForm(ctx, "/login/device/code", form, &res); err != nil {
		return DeviceCode{}, fmt.Errorf("device code request failed: %w", err)
	}
	if res.Error != "" {
		return DeviceCode{}, fmt.Errorf("%s: %s", res.Error, res.ErrorDesc)
	}
	if res.DeviceCode.DeviceCode == "" {
		return DeviceCode{}, errors.New("GitHub returned no device code")
	}
	return res.DeviceCode, nil
}

// ErrExpired and ErrDenied are terminal Device Flow outcomes.
var (
	ErrExpired = errors.New("Device code expired. Please try again.")
	ErrDenied  = errors.New("Authorization was denied.")
)

// PollToken blocks until the user authorizes the device (returning the access
// token), the code expires, or ctx is cancelled.
func (c *Client) PollToken(ctx context.Context, clientID string, dc DeviceCode) (string, error) {
	interval := time.Duration(dc.Interval) * time.Second
	if interval <= 0 {
		interval = 5 * time.Second
	}
	deadline := c.Now().Add(time.Duration(dc.ExpiresIn) * time.Second)
	form := url.Values{
		"client_id":   {clientID},
		"device_code": {dc.DeviceCode},
		"grant_type":  {"urn:ietf:params:oauth:grant-type:device_code"},
	}

	for c.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-time.After(interval):
		}

		var res struct {
			AccessToken string `json:"access_token"`
			oauthError
		}
		reqCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		err := c.postForm(reqCtx, "/login/oauth/access_token", form, &res)
		cancel()
		if err != nil {
			continue // transient network error: keep polling
		}

		switch res.Error {
		case "authorization_pending":
		case "slow_down":
			interval += 5 * time.Second
		case "expired_token":
			return "", ErrExpired
		case "access_denied":
			return "", ErrDenied
		case "":
			if res.AccessToken == "" {
				return "", errors.New("No access token returned.")
			}
			return res.AccessToken, nil
		default:
			return "", fmt.Errorf("%s: %s", res.Error, res.ErrorDesc)
		}
	}
	return "", ErrExpired
}
