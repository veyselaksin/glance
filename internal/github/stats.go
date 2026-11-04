package github

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"time"
)

// Stats fetches today's contribution and commit counts.
//
// Two independent sources are used:
//  1. GraphQL contributionCalendar → "contributions" (GitHub's graph number,
//     which can lag by minutes to hours).
//  2. REST /user/repos + /repos/{repo}/commits → the user's commits pushed
//     today on any branch (immediate, includes private repos with the `repo`
//     scope).
//
// Without a token, or if the token is rejected, the public contributions page
// is scraped instead and commits are reported as 0.
func (c *Client) Stats(ctx context.Context, username, token string) Stats {
	if username == "" {
		return Stats{Error: "username not configured"}
	}
	if token == "" {
		return c.scrape(ctx, username)
	}

	contributions, errC := c.contributionsToday(ctx, username, token)
	commits, errM := c.commitsToday(ctx, username, token)
	var unauth errUnauthorized
	if errors.As(errC, &unauth) || errors.As(errM, &unauth) {
		slog.Warn("github: token unauthorized, falling back to scraper")
		return c.scrape(ctx, username)
	}
	if errC != nil {
		slog.Warn("github: contributions", "err", errC)
	}
	if errM != nil {
		slog.Warn("github: commits", "err", errM)
	}
	slog.Debug("github: stats", "user", username, "contributions", contributions, "commits", commits)
	st := Stats{Username: username, Contributions: contributions, Commits: commits}
	if errors.Is(errM, errNoRepoAccess) {
		st.Warning = WarnNoRepoAccess
	}
	return st
}

// Day is one entry in the contribution calendar.
type Day struct {
	Date  string `json:"date"`
	Count int    `json:"contributionCount"`
}

const calendarQuery = `query($username: String!) {
  user(login: $username) {
    contributionsCollection {
      contributionCalendar {
        weeks { contributionDays { contributionCount date } }
      }
    }
  }
}`

// Calendar returns the user's contribution calendar (about one year, oldest first).
func (c *Client) Calendar(ctx context.Context, username, token string) ([]Day, error) {
	body, err := json.Marshal(map[string]any{
		"query":     calendarQuery,
		"variables": map[string]string{"username": username},
	})
	if err != nil {
		return nil, err
	}
	req, err := c.newRequest(ctx, http.MethodPost, c.APIBase+"/graphql", token, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	var res struct {
		Data struct {
			User struct {
				ContributionsCollection struct {
					ContributionCalendar struct {
						Weeks []struct {
							ContributionDays []Day `json:"contributionDays"`
						} `json:"weeks"`
					} `json:"contributionCalendar"`
				} `json:"contributionsCollection"`
			} `json:"user"`
		} `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := c.doJSON(req, &res); err != nil {
		return nil, err
	}
	if len(res.Errors) > 0 {
		return nil, fmt.Errorf("graphql: %s", res.Errors[0].Message)
	}
	var days []Day
	for _, w := range res.Data.User.ContributionsCollection.ContributionCalendar.Weeks {
		days = append(days, w.ContributionDays...)
	}
	return days, nil
}

func (c *Client) contributionsToday(ctx context.Context, username, token string) (int, error) {
	days, err := c.Calendar(ctx, username, token)
	if err != nil {
		return 0, err
	}
	return PickToday(days, c.Now()), nil
}

// PickToday chooses today's count from the calendar. GitHub buckets days in
// the user's *profile* timezone, which may differ from this machine, so both
// local and UTC dates are tried, then yesterday (processing delay), then the
// last entry.
func PickToday(days []Day, now time.Time) int {
	if len(days) == 0 {
		return 0
	}
	match := func(dates ...string) (int, bool) {
		for i := len(days) - 1; i >= 0; i-- {
			for _, d := range dates {
				if days[i].Date == d {
					return days[i].Count, true
				}
			}
		}
		return 0, false
	}
	const layout = "2006-01-02"
	if n, ok := match(now.Format(layout), now.UTC().Format(layout)); ok {
		return n
	}
	y := now.AddDate(0, 0, -1)
	if n, ok := match(y.Format(layout), y.UTC().Format(layout)); ok {
		return n
	}
	return days[len(days)-1].Count
}

// startOfToday returns local midnight.
func startOfToday(now time.Time) time.Time {
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
}

// commitsToday counts the user's distinct commits pushed since local midnight
// on any branch. See collectCommits.
func (c *Client) commitsToday(ctx context.Context, username, token string) (int, error) {
	commits, _, err := c.collectCommits(ctx, username, token, startOfToday(c.Now()))
	return len(commits), err
}

var errNoRepoAccess = errors.New("token can list no repositories")

// Repo is the subset of /user/repos used here.
type Repo struct {
	FullName      string `json:"full_name"`
	PushedAt      string `json:"pushed_at"`
	DefaultBranch string `json:"default_branch"`
}

// PushedSince returns the names of repos pushed at or after since.
func PushedSince(repos []Repo, since time.Time) []string {
	var out []string
	for _, r := range repos {
		t, err := time.Parse(time.RFC3339, r.PushedAt)
		if err != nil {
			continue
		}
		if !t.Before(since) {
			out = append(out, r.FullName)
		}
	}
	return out
}

// scrape reads today's count from the public contributions page.
func (c *Client) scrape(ctx context.Context, username string) Stats {
	req, err := c.newRequest(ctx, http.MethodGet, c.WebBase+"/users/"+url.PathEscape(username)+"/contributions", "", nil)
	if err != nil {
		return Stats{Username: username, Error: err.Error()}
	}
	// This endpoint serves HTML; GitHub answers 406 to Accept: application/json.
	req.Header.Set("Accept", "text/html")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return Stats{Username: username, Error: err.Error()}
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return Stats{Username: username, Error: fmt.Sprintf("HTTP %d", resp.StatusCode)}
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return Stats{Username: username, Error: err.Error()}
	}
	return Stats{Username: username, Contributions: ParseContributionsPage(body, c.Now())}
}

// ParseContributionsPage extracts today's count from the contributions HTML.
// Several patterns are tried because GitHub's markup changes over time.
func ParseContributionsPage(body []byte, now time.Time) int {
	local := regexp.QuoteMeta(now.Format("2006-01-02"))
	utc := regexp.QuoteMeta(now.UTC().Format("2006-01-02"))
	patterns := []string{
		`data-date="` + local + `"[^>]*data-count="(\d+)"`,
		`data-date="` + utc + `"[^>]*data-count="(\d+)"`,
		`data-count="(\d+)"[^>]*data-date="(?:` + local + `|` + utc + `)"`,
		`aria-label="(\d+) contributions? on ` + regexp.QuoteMeta(now.Format("January 2, 2006")) + `"`,
	}
	for _, p := range patterns {
		if m := regexp.MustCompile(p).FindSubmatch(body); m != nil {
			n, _ := strconv.Atoi(string(m[1]))
			return n
		}
	}
	return 0
}
