package github

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"
)

// Commit is one of the user's commits, on whichever branch it was found.
type Commit struct {
	SHA     string `json:"sha"`
	Message string `json:"message"` // first line only
	Repo    string `json:"repo"`
	Branch  string `json:"branch"`
	URL     string `json:"url"`
	Date    string `json:"date"` // RFC3339, author date
}

// RepoActivity is the number of commits in one repository.
type RepoActivity struct {
	Repo    string `json:"repo"`
	URL     string `json:"url"`
	Commits int    `json:"commits"`
}

// Activity is the user's commit history over a range of days.
type Activity struct {
	Days    int            `json:"days"`
	Since   string         `json:"since"`
	Total   int            `json:"total"`
	Repos   []RepoActivity `json:"repos"`   // most commits first
	Commits []Commit       `json:"commits"` // newest first
	// Partial is set when some branch hit the per-request page limit or a
	// repo could not be read, so the counts may be low.
	Partial bool `json:"partial"`
}

// maxActivityDays bounds how far back Activity looks.
const maxActivityDays = 90

// fetchWorkers limits concurrent GitHub requests while collecting commits.
const fetchWorkers = 6

// Activity returns the user's commits on every branch of every repo they can
// access, from local midnight (days-1) days ago until now. days=1 is today.
func (c *Client) Activity(ctx context.Context, username, token string, days int) (Activity, error) {
	if days < 1 {
		days = 1
	}
	if days > maxActivityDays {
		days = maxActivityDays
	}
	since := startOfToday(c.Now()).AddDate(0, 0, -(days - 1))
	commits, partial, err := c.collectCommits(ctx, username, token, since)
	if err != nil {
		return Activity{}, err
	}

	byRepo := map[string]int{}
	for _, cm := range commits {
		byRepo[cm.Repo]++
	}
	repos := make([]RepoActivity, 0, len(byRepo))
	for name, n := range byRepo {
		repos = append(repos, RepoActivity{Repo: name, URL: c.webURL(name), Commits: n})
	}
	sort.Slice(repos, func(i, j int) bool {
		if repos[i].Commits != repos[j].Commits {
			return repos[i].Commits > repos[j].Commits
		}
		return repos[i].Repo < repos[j].Repo
	})

	return Activity{
		Days:    days,
		Since:   since.Format(time.RFC3339),
		Total:   len(commits),
		Repos:   repos,
		Commits: commits,
		Partial: partial,
	}, nil
}

func (c *Client) webURL(repo string) string { return c.WebBase + "/" + repo }

// collectCommits returns the user's distinct commits since the given time on
// any branch of the 100 most recently pushed repos they can access (owned,
// collaborator and organization), newest first. GitHub's commits endpoint
// only lists the default branch unless one is given, so every branch of each
// repo pushed since then is queried. A commit on several branches is reported
// once, on the default branch when it is there.
func (c *Client) collectCommits(ctx context.Context, username, token string, since time.Time) ([]Commit, bool, error) {
	req, err := c.newRequest(ctx, http.MethodGet,
		c.APIBase+"/user/repos?sort=pushed&per_page=100&affiliation=owner,collaborator,organization_member", token, nil)
	if err != nil {
		return nil, false, err
	}
	var repos []Repo
	if err := c.doJSON(req, &repos); err != nil {
		return nil, false, err
	}
	if len(repos) == 0 {
		return nil, false, errNoRepoAccess
	}
	defaults := map[string]string{}
	for _, r := range repos {
		defaults[r.FullName] = r.DefaultBranch
	}

	type job struct{ repo, branch string }
	var (
		mu      sync.Mutex
		partial bool
		jobs    []job
	)
	markPartial := func() { mu.Lock(); partial = true; mu.Unlock() }

	// Pass 1: list branches of each recently pushed repo, default branch first.
	names := PushedSince(repos, since)
	branchLists := make([][]string, len(names))
	forEach(len(names), func(i int) {
		bs, err := c.repoBranches(ctx, token, names[i])
		if err != nil {
			slog.Warn("github: repo branches", "repo", names[i], "err", err)
			markPartial()
			return
		}
		def := defaults[names[i]]
		sort.SliceStable(bs, func(a, b int) bool { return bs[a] == def && bs[b] != def })
		branchLists[i] = bs
	})
	for i, bs := range branchLists {
		for _, b := range bs {
			jobs = append(jobs, job{names[i], b})
		}
	}

	// Pass 2: the user's commits on each branch.
	results := make([][]Commit, len(jobs))
	forEach(len(jobs), func(i int) {
		cs, full, err := c.repoCommits(ctx, token, jobs[i].repo, jobs[i].branch, username, since)
		if err != nil {
			slog.Warn("github: repo commits", "repo", jobs[i].repo, "branch", jobs[i].branch, "err", err)
			markPartial()
			return
		}
		if full {
			markPartial()
		}
		results[i] = cs
	})

	// Jobs are ordered default branch first per repo, so the first sighting
	// of a SHA carries the most useful branch name.
	seen := map[string]bool{}
	var out []Commit
	for _, cs := range results {
		for _, cm := range cs {
			if !seen[cm.SHA] {
				seen[cm.SHA] = true
				out = append(out, cm)
			}
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Date > out[j].Date })
	return out, partial, nil
}

// forEach runs fn(0..n-1) on up to fetchWorkers goroutines.
func forEach(n int, fn func(i int)) {
	sem := make(chan struct{}, fetchWorkers)
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		sem <- struct{}{}
		go func(i int) {
			defer func() { <-sem; wg.Done() }()
			fn(i)
		}(i)
	}
	wg.Wait()
}

func (c *Client) repoBranches(ctx context.Context, token, repo string) ([]string, error) {
	req, err := c.newRequest(ctx, http.MethodGet,
		fmt.Sprintf("%s/repos/%s/branches?per_page=100", c.APIBase, repo), token, nil)
	if err != nil {
		return nil, err
	}
	var branches []struct {
		Name string `json:"name"`
	}
	if err := c.doJSON(req, &branches); err != nil {
		return nil, err
	}
	out := make([]string, len(branches))
	for i, b := range branches {
		out[i] = b.Name
	}
	return out, nil
}

// commitsPage is the page size for the commits endpoint (GitHub's maximum).
const commitsPage = 100

// repoCommits returns author's commits on branch since the given time. full
// reports that a whole page came back, so older commits may be missing.
func (c *Client) repoCommits(ctx context.Context, token, repo, branch, author string, since time.Time) (commits []Commit, full bool, err error) {
	q := url.Values{
		"sha":      {branch},
		"author":   {author},
		"since":    {since.UTC().Format(time.RFC3339)},
		"per_page": {fmt.Sprint(commitsPage)},
	}
	req, err := c.newRequest(ctx, http.MethodGet,
		fmt.Sprintf("%s/repos/%s/commits?%s", c.APIBase, repo, q.Encode()), token, nil)
	if err != nil {
		return nil, false, err
	}
	var raw []struct {
		SHA     string `json:"sha"`
		HTMLURL string `json:"html_url"`
		Commit  struct {
			Message string `json:"message"`
			Author  struct {
				Date string `json:"date"`
			} `json:"author"`
		} `json:"commit"`
	}
	if err := c.doJSON(req, &raw); err != nil {
		return nil, false, err
	}
	out := make([]Commit, len(raw))
	for i, r := range raw {
		msg, _, _ := strings.Cut(r.Commit.Message, "\n")
		u := r.HTMLURL
		if u == "" {
			u = c.webURL(repo) + "/commit/" + r.SHA
		}
		out[i] = Commit{SHA: r.SHA, Message: msg, Repo: repo, Branch: branch, URL: u, Date: r.Commit.Author.Date}
	}
	return out, len(raw) == commitsPage, nil
}
