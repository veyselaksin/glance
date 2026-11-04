package sshx

import (
	"fmt"
	"strconv"
	"strings"
)

// Metrics is a quick resource snapshot fetched over SSH.
type Metrics struct {
	CPUUsage  float64 `json:"cpu_usage"`  // percentage 0-100
	MemTotal  uint64  `json:"mem_total"`  // bytes
	MemUsed   uint64  `json:"mem_used"`   // bytes
	DiskTotal uint64  `json:"disk_total"` // bytes
	DiskUsed  uint64  `json:"disk_used"`  // bytes
	Uptime    float64 `json:"uptime"`     // seconds
	LoadAvg   string  `json:"load_avg"`   // e.g. "0.42, 0.58, 0.50"
	Error     string  `json:"error,omitempty"`
}

// metricsScript prints one machine-parseable value per line between markers.
const metricsScript = `echo "=METRICS_START="
cat /proc/uptime 2>/dev/null | awk '{print $1}'
free -b 2>/dev/null | awk '/Mem:/ {print $2" "$3}'
df -B1 / 2>/dev/null | awk 'NR==2 {print $2" "$3}'
top -bn1 2>/dev/null | awk '/Cpu\(s\)/ {gsub(",",""); print $2+$4}'
cat /proc/loadavg 2>/dev/null | awk '{print $1" "$2" "$3}'
echo "=METRICS_END="`

// FetchMetrics connects, runs metricsScript and disconnects.
func FetchMetrics(t Target) Metrics {
	client, err := Dial(t)
	if err != nil {
		return Metrics{Error: err.Error()}
	}
	defer client.Close()
	sess, err := client.NewSession()
	if err != nil {
		return Metrics{Error: err.Error()}
	}
	defer sess.Close()
	out, err := sess.CombinedOutput(metricsScript)
	if err != nil {
		return Metrics{Error: fmt.Sprintf("exec: %v", err)}
	}
	return ParseMetrics(string(out))
}

// ParseMetrics parses metricsScript output.
func ParseMetrics(raw string) Metrics {
	var lines []string
	started := false
	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "=METRICS_END=" {
			break
		}
		if line == "=METRICS_START=" {
			started = true
		} else if started && line != "" {
			lines = append(lines, line)
		}
	}
	if len(lines) < 5 {
		return Metrics{Error: "incomplete metrics output"}
	}

	var m Metrics
	m.Uptime, _ = strconv.ParseFloat(lines[0], 64)
	if p := strings.Fields(lines[1]); len(p) >= 2 {
		m.MemTotal, _ = strconv.ParseUint(p[0], 10, 64)
		m.MemUsed, _ = strconv.ParseUint(p[1], 10, 64)
	}
	if p := strings.Fields(lines[2]); len(p) >= 2 {
		m.DiskTotal, _ = strconv.ParseUint(p[0], 10, 64)
		m.DiskUsed, _ = strconv.ParseUint(p[1], 10, 64)
	}
	m.CPUUsage, _ = strconv.ParseFloat(lines[3], 64)
	if p := strings.Fields(lines[4]); len(p) >= 3 {
		m.LoadAvg = strings.Join(p[:3], ", ")
	}
	return m
}
