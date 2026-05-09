package detector

import (
	"sync"
	"time"

	"github.com/deadlock-detector/internal/logger"
	"github.com/deadlock-detector/internal/model"
)

type Detector struct {
	mu              sync.RWMutex
	logger          *logger.Manager
	deadlocks       []*model.DeadlockInfo
	lastDeadlock    *model.DeadlockInfo
	hasPotential    bool
	checkInterval   time.Duration
	timeoutThreshold time.Duration
}

func NewDetector(logMgr *logger.Manager) *Detector {
	return &Detector{
		logger:          logMgr,
		deadlocks:       make([]*model.DeadlockInfo, 0),
		checkInterval:   5 * time.Second,
		timeoutThreshold: 10 * time.Second,
	}
}

func (d *Detector) RecordPotentialDeadlock(goroutines []*model.GoroutineInfo, reason string) {
	d.mu.Lock()
	defer d.mu.Unlock()

	channels := make([]*model.ChannelInfo, 0)
	for _, g := range goroutines {
		if g.CurrentOp != nil {
			channels = append(channels, &model.ChannelInfo{
				ID: g.CurrentOp.ChannelID,
			})
		}
	}

	deadlock := model.NewDeadlockInfo(goroutines, channels, reason)
	d.deadlocks = append(d.deadlocks, deadlock)
	d.lastDeadlock = deadlock
	d.hasPotential = true

	d.logger.Error("detector", "检测到潜在死锁", map[string]interface{}{
		"deadlock_id":   deadlock.ID,
		"goroutine_count": len(goroutines),
		"reason":        reason,
		"detected_at":   deadlock.DetectedAt.String(),
	})
}

func (d *Detector) ConfirmDeadlock(deadlockID string) {
	d.mu.Lock()
	defer d.mu.Unlock()

	for _, dl := range d.deadlocks {
		if dl.ID == deadlockID {
			dl.Severity = "critical"
			d.logger.Fatal("detector", "确认死锁", map[string]interface{}{
				"deadlock_id": deadlockID,
				"duration":    dl.Duration().String(),
			})
			break
		}
	}
}

func (d *Detector) ResolveDeadlock(deadlockID string, resolutionType string) {
	d.mu.Lock()
	defer d.mu.Unlock()

	for _, dl := range d.deadlocks {
		if dl.ID == deadlockID {
			dl.MarkResolved(resolutionType)
			d.hasPotential = false
			d.logger.Info("detector", "死锁已解决", map[string]interface{}{
				"deadlock_id":      deadlockID,
				"resolution_type":  resolutionType,
				"duration":         dl.Duration().String(),
			})
			break
		}
	}
}

func (d *Detector) HasPotentialDeadlock() bool {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.hasPotential
}

func (d *Detector) GetLastDeadlockInfo() *model.DeadlockInfo {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.lastDeadlock
}

func (d *Detector) GetAllDeadlocks() []*model.DeadlockInfo {
	d.mu.RLock()
	defer d.mu.RUnlock()

	result := make([]*model.DeadlockInfo, len(d.deadlocks))
	copy(result, d.deadlocks)
	return result
}

func (d *Detector) GetUnresolvedDeadlocks() []*model.DeadlockInfo {
	d.mu.RLock()
	defer d.mu.RUnlock()

	unresolved := make([]*model.DeadlockInfo, 0)
	for _, dl := range d.deadlocks {
		if !dl.Resolved {
			unresolved = append(unresolved, dl)
		}
	}
	return unresolved
}

func (d *Detector) AnalyzeWaitGraph(deadlock *model.DeadlockInfo) map[string]interface{} {
	analysis := make(map[string]interface{})

	if len(deadlock.Goroutines) < 2 {
		analysis["is_circular"] = false
		return analysis
	}

	visited := make(map[string]bool)
	recStack := make(map[string]bool)

	hasCycle := false
	for _, g := range deadlock.Goroutines {
		if d.detectCycle(g.ID, deadlock.WaitGraph, visited, recStack) {
			hasCycle = true
			break
		}
	}

	analysis["is_circular"] = hasCycle
	analysis["goroutine_count"] = len(deadlock.Goroutines)
	analysis["channel_count"] = len(deadlock.Channels)
	analysis["duration"] = deadlock.Duration().String()

	return analysis
}

func (d *Detector) detectCycle(node string, graph map[string][]string, visited, recStack map[string]bool) bool {
	if recStack[node] {
		return true
	}
	if visited[node] {
		return false
	}

	visited[node] = true
	recStack[node] = true

	for _, neighbor := range graph[node] {
		if d.detectCycle(neighbor, graph, visited, recStack) {
			return true
		}
	}

	delete(recStack, node)
	return false
}

func (d *Detector) GetStatistics() map[string]interface{} {
	d.mu.RLock()
	defer d.mu.RUnlock()

	total := len(d.deadlocks)
	resolved := 0
	unresolved := 0
	totalDuration := time.Duration(0)

	for _, dl := range d.deadlocks {
		if dl.Resolved {
			resolved++
		} else {
			unresolved++
		}
		totalDuration += dl.Duration()
	}

	return map[string]interface{}{
		"total":           total,
		"resolved":        resolved,
		"unresolved":      unresolved,
		"has_potential":   d.hasPotential,
		"avg_duration_ms": totalDuration.Milliseconds() / int64(max(1, total)),
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
