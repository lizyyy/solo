package recovery

import (
	"sync"
	"time"

	"github.com/deadlock-detector/internal/logger"
	"github.com/deadlock-detector/internal/model"
)

type Manager struct {
	mu             sync.RWMutex
	logger         *logger.Manager
	processedMsgs  map[string]time.Time
	recoveryCount  int
	maxRetries     int
	retryInterval  time.Duration
}

func NewManager(logMgr *logger.Manager) *Manager {
	return &Manager{
		logger:        logMgr,
		processedMsgs: make(map[string]time.Time),
		maxRetries:    3,
		retryInterval: 1 * time.Second,
	}
}

func (m *Manager) HandleDeadlock(deadlock *model.DeadlockInfo) {
	if deadlock == nil {
		return
	}

	m.logger.Error("recovery", "开始处理死锁", map[string]interface{}{
		"deadlock_id":   deadlock.ID,
		"goroutine_count": len(deadlock.Goroutines),
		"reason":        deadlock.Reason,
	})

	for _, g := range deadlock.Goroutines {
		m.logger.Warn("recovery", "阻塞 goroutine 信息", map[string]interface{}{
			"goroutine_id":   g.ID,
			"goroutine_name": g.Name,
			"state":          string(g.State),
			"wait_channels":  g.WaitChannels,
			"hold_channels":  g.HoldChannels,
		})
	}

	strategy := m.chooseRecoveryStrategy(deadlock)
	m.executeStrategy(strategy, deadlock)

	m.recoveryCount++
	m.logger.Info("recovery", "死锁处理完成", map[string]interface{}{
		"deadlock_id":     deadlock.ID,
		"strategy_used":   strategy,
		"recovery_count":  m.recoveryCount,
	})
}

func (m *Manager) chooseRecoveryStrategy(deadlock *model.DeadlockInfo) string {
	if len(deadlock.Goroutines) == 1 {
		return "timeout_release"
	}

	hasCircular := len(deadlock.WaitGraph) > 0
	for _, neighbors := range deadlock.WaitGraph {
		if len(neighbors) > 0 {
			hasCircular = true
			break
		}
	}

	if hasCircular {
		return "force_termination"
	}

	return "graceful_shutdown"
}

func (m *Manager) executeStrategy(strategy string, deadlock *model.DeadlockInfo) {
	switch strategy {
	case "timeout_release":
		m.logger.Info("recovery", "使用超时释放策略", nil)
	case "force_termination":
		m.logger.Warn("recovery", "使用强制终止策略", map[string]interface{}{
			"deadlock_id": deadlock.ID,
		})
	case "graceful_shutdown":
		m.logger.Info("recovery", "使用优雅关闭策略", nil)
	default:
		m.logger.Info("recovery", "使用默认恢复策略", nil)
	}

	for _, g := range deadlock.Goroutines {
		g.UpdateState(model.GoroutineStateRunning)
	}
}

func (m *Manager) IsProcessed(msgID string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	_, exists := m.processedMsgs[msgID]
	return exists
}

func (m *Manager) MarkProcessed(msgID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.processedMsgs[msgID] = time.Now()
	m.logger.Debug("recovery", "消息标记为已处理", map[string]interface{}{
		"message_id": msgID,
	})
}

func (m *Manager) UnmarkProcessed(msgID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.processedMsgs, msgID)
	m.logger.Debug("recovery", "消息取消已处理标记", map[string]interface{}{
		"message_id": msgID,
	})
}

func (m *Manager) CleanupOldEntries(maxAge time.Duration) int {
	m.mu.Lock()
	defer m.mu.Unlock()

	cutoff := time.Now().Add(-maxAge)
	removed := 0

	for id, t := range m.processedMsgs {
		if t.Before(cutoff) {
			delete(m.processedMsgs, id)
			removed++
		}
	}

	if removed > 0 {
		m.logger.Info("recovery", "清理过期的幂等记录", map[string]interface{}{
			"removed_count": removed,
			"max_age":       maxAge.String(),
		})
	}

	return removed
}

func (m *Manager) GetProcessedCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.processedMsgs)
}

func (m *Manager) GetRecoveryCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.recoveryCount
}

func (m *Manager) WithRetry(operation func() error) error {
	var lastErr error

	for attempt := 1; attempt <= m.maxRetries; attempt++ {
		err := operation()
		if err == nil {
			return nil
		}

		lastErr = err
		m.logger.Warn("recovery", "操作失败，准备重试", map[string]interface{}{
			"attempt":    attempt,
			"max_retries": m.maxRetries,
			"error":      err.Error(),
		})

		if attempt < m.maxRetries {
			time.Sleep(m.retryInterval)
		}
	}

	m.logger.Error("recovery", "重试耗尽，操作最终失败", map[string]interface{}{
		"max_retries": m.maxRetries,
		"last_error":  lastErr.Error(),
	})

	return lastErr
}

func (m *Manager) GetStatistics() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return map[string]interface{}{
		"recovery_count":    m.recoveryCount,
		"processed_messages": len(m.processedMsgs),
		"max_retries":       m.maxRetries,
		"retry_interval_ms": m.retryInterval.Milliseconds(),
	}
}
