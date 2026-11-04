// Package docker wraps the local Docker daemon.
package docker

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"strconv"
	"strings"
	"sync"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
)

// DefaultSocket is used when no socket path is configured.
const DefaultSocket = "/var/run/docker.sock"

// statsConcurrency bounds parallel per-container stats requests.
const statsConcurrency = 8

// Summary holds running/stopped container counts.
type Summary struct {
	Running int    `json:"running"`
	Stopped int    `json:"stopped"`
	Total   int    `json:"total"`
	Version string `json:"version"`
	Error   string `json:"error,omitempty"`
}

// Container holds per-container metadata and live resource metrics.
type Container struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Image      string  `json:"image"`
	State      string  `json:"state"`
	Status     string  `json:"status"`
	CPUUsage   float64 `json:"cpu_usage"`   // percentage
	MemUsage   uint64  `json:"mem_usage"`   // bytes
	MemPercent float64 `json:"mem_percent"` // percentage of limit
	NetworkRX  uint64  `json:"network_rx"`  // cumulative bytes received
	NetworkTX  uint64  `json:"network_tx"`  // cumulative bytes sent
	IORead     uint64  `json:"io_read"`     // cumulative bytes read from disk
	IOWrite    uint64  `json:"io_write"`    // cumulative bytes written to disk
	PIDCount   uint32  `json:"pid_count"`   // current number of PIDs
}

// Client is a long-lived, lazily-connected Docker client whose socket can be
// changed at runtime. It is safe for concurrent use.
type Client struct {
	mu     sync.Mutex
	socket string
	cli    *client.Client
}

// New returns a Client for socket (DefaultSocket if empty).
func New(socket string) *Client {
	c := &Client{}
	c.SetSocket(socket)
	return c
}

// SetSocket switches the daemon socket, dropping any existing connection.
func (c *Client) SetSocket(socket string) {
	if socket == "" {
		socket = DefaultSocket
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if socket == c.socket {
		return
	}
	c.socket = socket
	if c.cli != nil {
		_ = c.cli.Close()
		c.cli = nil
	}
}

// Close releases the underlying connection.
func (c *Client) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.cli != nil {
		_ = c.cli.Close()
		c.cli = nil
	}
}

func (c *Client) get() (*client.Client, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.cli != nil {
		return c.cli, nil
	}
	cli, err := client.NewClientWithOpts(
		client.WithHost("unix://"+c.socket),
		client.WithAPIVersionNegotiation(),
	)
	if err != nil {
		return nil, err
	}
	c.cli = cli
	return cli, nil
}

// Summary returns container counts and the daemon version.
func (c *Client) Summary(ctx context.Context) Summary {
	cli, err := c.get()
	if err != nil {
		return Summary{Error: err.Error()}
	}
	list, err := cli.ContainerList(ctx, container.ListOptions{All: true})
	if err != nil {
		return Summary{Error: err.Error()}
	}
	s := Summary{Total: len(list)}
	for _, ct := range list {
		if ct.State == "running" {
			s.Running++
		} else {
			s.Stopped++
		}
	}
	if v, err := cli.ServerVersion(ctx); err == nil {
		s.Version = v.Version
	}
	return s
}

// List returns every container with a one-shot stats snapshot for running ones.
// Stats are fetched concurrently; a failed stats call leaves metrics at zero.
func (c *Client) List(ctx context.Context) ([]Container, error) {
	cli, err := c.get()
	if err != nil {
		return nil, err
	}
	list, err := cli.ContainerList(ctx, container.ListOptions{All: true})
	if err != nil {
		return nil, err
	}

	out := make([]Container, len(list))
	sem := make(chan struct{}, statsConcurrency)
	var wg sync.WaitGroup
	for i, ct := range list {
		name := ""
		if len(ct.Names) > 0 {
			name = strings.TrimPrefix(ct.Names[0], "/")
		}
		out[i] = Container{ID: ct.ID, Name: name, Image: ct.Image, State: string(ct.State), Status: ct.Status}
		if ct.State != "running" {
			continue
		}
		wg.Add(1)
		go func(info *Container) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			fillStats(ctx, cli, info)
		}(&out[i])
	}
	wg.Wait()
	return out, nil
}

func fillStats(ctx context.Context, cli *client.Client, info *Container) {
	stats, err := cli.ContainerStatsOneShot(ctx, info.ID)
	if err != nil {
		return
	}
	defer stats.Body.Close()
	var sr container.StatsResponse
	if err := json.NewDecoder(stats.Body).Decode(&sr); err != nil {
		return
	}
	applyStats(info, sr)
}

// applyStats copies the interesting fields of a stats response onto info.
func applyStats(info *Container, sr container.StatsResponse) {
	info.CPUUsage = CPUPercent(sr.PreCPUStats.CPUUsage.TotalUsage, sr.PreCPUStats.SystemUsage, sr.CPUStats)
	if sr.MemoryStats.Usage > 0 {
		info.MemUsage = sr.MemoryStats.Usage
		if sr.MemoryStats.Limit > 0 {
			info.MemPercent = float64(sr.MemoryStats.Usage) / float64(sr.MemoryStats.Limit) * 100
		}
	}
	info.PIDCount = uint32(sr.PidsStats.Current)
	for _, n := range sr.Networks {
		info.NetworkRX += n.RxBytes
		info.NetworkTX += n.TxBytes
	}
	for _, e := range sr.BlkioStats.IoServiceBytesRecursive {
		switch e.Op {
		case "read":
			info.IORead += e.Value
		case "write":
			info.IOWrite += e.Value
		}
	}
}

// CPUPercent computes CPU utilisation from the current and previous samples
// using the Docker daemon's formula. Returns 0 if the delta is unavailable.
func CPUPercent(prevCPU, prevSystem uint64, cpu container.CPUStats) float64 {
	online := cpu.OnlineCPUs
	if online == 0 {
		online = uint32(len(cpu.CPUUsage.PercpuUsage))
	}
	if online == 0 {
		online = 1
	}
	if cpu.CPUUsage.TotalUsage <= prevCPU || cpu.SystemUsage <= prevSystem {
		return 0
	}
	cpuDelta := float64(cpu.CPUUsage.TotalUsage - prevCPU)
	sysDelta := float64(cpu.SystemUsage - prevSystem)
	return cpuDelta / sysDelta * float64(online) * 100
}

// Logs returns the last n lines of stdout+stderr as plain text.
func (c *Client) Logs(ctx context.Context, id string, n int) (string, error) {
	if n <= 0 {
		n = 100
	}
	cli, err := c.get()
	if err != nil {
		return "", err
	}
	rc, err := cli.ContainerLogs(ctx, id, container.LogsOptions{ShowStdout: true, ShowStderr: true, Tail: strconv.Itoa(n)})
	if err != nil {
		return "", err
	}
	defer rc.Close()
	// Buffer first so the TTY fallback keeps bytes stdcopy already consumed.
	raw, err := io.ReadAll(rc)
	if err != nil {
		return "", err
	}
	return demux(raw), nil
}

// demux strips Docker's multiplexed stream headers; TTY output is returned as is.
func demux(raw []byte) string {
	var buf bytes.Buffer
	if _, err := stdcopy.StdCopy(&buf, &buf, bytes.NewReader(raw)); err != nil {
		return string(raw)
	}
	return buf.String()
}

// Start starts a container.
func (c *Client) Start(ctx context.Context, id string) error {
	return c.with(func(cli *client.Client) error { return cli.ContainerStart(ctx, id, container.StartOptions{}) })
}

// Stop gracefully stops a container.
func (c *Client) Stop(ctx context.Context, id string) error {
	return c.with(func(cli *client.Client) error { return cli.ContainerStop(ctx, id, container.StopOptions{}) })
}

// Restart restarts a container.
func (c *Client) Restart(ctx context.Context, id string) error {
	return c.with(func(cli *client.Client) error { return cli.ContainerRestart(ctx, id, container.StopOptions{}) })
}

// Remove force-removes a container (running or not).
func (c *Client) Remove(ctx context.Context, id string) error {
	return c.with(func(cli *client.Client) error {
		return cli.ContainerRemove(ctx, id, container.RemoveOptions{Force: true})
	})
}

func (c *Client) with(fn func(*client.Client) error) error {
	cli, err := c.get()
	if err != nil {
		return err
	}
	return fn(cli)
}
