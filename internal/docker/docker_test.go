package docker

import (
	"bytes"
	"math"
	"testing"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/pkg/stdcopy"
)

func cpuStats(total, system uint64, online uint32) container.CPUStats {
	return container.CPUStats{CPUUsage: container.CPUUsage{TotalUsage: total}, SystemUsage: system, OnlineCPUs: online}
}

func TestCPUPercent(t *testing.T) {
	// 100 of 1000 system ticks on 4 CPUs → 40%.
	if got := CPUPercent(100, 1000, cpuStats(200, 2000, 4)); math.Abs(got-40) > 1e-9 {
		t.Fatalf("got %v", got)
	}
	// Falls back to len(PercpuUsage) when OnlineCPUs is 0.
	s := cpuStats(200, 2000, 0)
	s.CPUUsage.PercpuUsage = []uint64{1, 2}
	if got := CPUPercent(100, 1000, s); math.Abs(got-20) > 1e-9 {
		t.Fatalf("percpu fallback: got %v", got)
	}
	// No delta (first sample, or counters reset) → 0, never negative/overflow.
	if got := CPUPercent(0, 0, cpuStats(0, 0, 1)); got != 0 {
		t.Fatalf("zero delta: got %v", got)
	}
	if got := CPUPercent(500, 1000, cpuStats(100, 2000, 1)); got != 0 {
		t.Fatalf("counter reset: got %v", got)
	}
}

func TestApplyStats(t *testing.T) {
	var sr container.StatsResponse
	sr.MemoryStats.Usage = 50
	sr.MemoryStats.Limit = 200
	sr.PidsStats.Current = 7
	sr.Networks = map[string]container.NetworkStats{"eth0": {RxBytes: 10, TxBytes: 20}, "eth1": {RxBytes: 1, TxBytes: 2}}
	sr.BlkioStats.IoServiceBytesRecursive = []container.BlkioStatEntry{{Op: "read", Value: 5}, {Op: "write", Value: 6}, {Op: "Total", Value: 99}}

	var c Container
	applyStats(&c, sr)
	if c.MemUsage != 50 || c.MemPercent != 25 || c.PIDCount != 7 || c.NetworkRX != 11 || c.NetworkTX != 22 || c.IORead != 5 || c.IOWrite != 6 {
		t.Fatalf("got %+v", c)
	}
}

func TestDemux(t *testing.T) {
	var mux bytes.Buffer
	_, _ = stdcopy.NewStdWriter(&mux, stdcopy.Stdout).Write([]byte("out\n"))
	_, _ = stdcopy.NewStdWriter(&mux, stdcopy.Stderr).Write([]byte("err\n"))
	if got := demux(mux.Bytes()); got != "out\nerr\n" {
		t.Fatalf("multiplexed: %q", got)
	}
	if got := demux([]byte("plain tty output\n")); got != "plain tty output\n" {
		t.Fatalf("tty: %q", got)
	}
}

func TestSetSocketDefault(t *testing.T) {
	c := New("")
	if c.socket != DefaultSocket {
		t.Fatalf("socket = %q", c.socket)
	}
}

func TestDetectRuntime(t *testing.T) {
	orig := fileExists
	t.Cleanup(func() { fileExists = orig })

	present := map[string]bool{}
	fileExists = func(p string) bool { return present[p] }

	if _, err := DetectRuntime(); err != ErrNoRuntime {
		t.Fatalf("expected ErrNoRuntime, got %v", err)
	}

	present["/opt/homebrew/bin/colima"] = true
	if rt, _ := DetectRuntime(); rt.Name != "Colima" || rt.Cmd[1] != "start" {
		t.Fatalf("got %+v", rt)
	}

	present["/Applications/Docker.app"] = true
	rt, err := DetectRuntime()
	if err != nil || rt.Name != "Docker Desktop" || rt.Cmd[0] != "open" || rt.Cmd[2] != "/Applications/Docker.app" {
		t.Fatalf("got %+v, %v", rt, err)
	}
}
