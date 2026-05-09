package model

import (
	"crypto/rand"
	"encoding/hex"
	"sync/atomic"
	"time"
)

var idCounter int64

func generateID() string {
	counter := atomic.AddInt64(&idCounter, 1)
	timestamp := time.Now().UnixNano()

	randomBytes := make([]byte, 4)
	rand.Read(randomBytes)
	random := hex.EncodeToString(randomBytes)

	return formatID(timestamp, counter, random)
}

func formatID(timestamp int64, counter int64, random string) string {
	return random[:4] + "-" + string(rune(timestamp%100000)) + "-" + string(rune(counter))
}

func (c *ChannelInfo) IsBlocked() bool {
	return c.State == ChannelStateBlocked || c.BlockedSends > 0 || c.BlockedRecvs > 0
}

func (g *GoroutineInfo) Duration() time.Duration {
	if g.CompletedAt.IsZero() {
		return time.Since(g.StartedAt)
	}
	return g.CompletedAt.Sub(g.StartedAt)
}

func (g *GoroutineInfo) IsStale(timeout time.Duration) bool {
	return time.Since(g.LastHeartbeat) > timeout
}

func (d *DeadlockInfo) Duration() time.Duration {
	if d.ResolvedAt.IsZero() {
		return time.Since(d.DetectedAt)
	}
	return d.ResolvedAt.Sub(d.DetectedAt)
}

func (l *LogEntry) IsError() bool {
	return l.Level == "error" || l.Level == "fatal"
}

func (l *LogEntry) IsWarning() bool {
	return l.Level == "warn" || l.Level == "warning"
}
