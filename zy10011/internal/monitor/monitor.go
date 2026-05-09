package monitor

import (
	"context"
	"sync"
	"time"

	"github.com/deadlock-detector/internal/detector"
	"github.com/deadlock-detector/internal/logger"
	"github.com/deadlock-detector/internal/model"
)

type Monitor struct {
	mu            sync.RWMutex
	logger        *logger.Manager
	detector      *detector.Detector
	channels      map[string]*monitoredChannel
	goroutines    map[string]*model.GoroutineInfo
	operations    []*model.OperationInfo
	heartbeatTick time.Duration
}

func NewMonitor(logMgr *logger.Manager, det *detector.Detector) *Monitor {
	return &Monitor{
		logger:        logMgr,
		detector:      det,
		channels:      make(map[string]*monitoredChannel),
		goroutines:    make(map[string]*model.GoroutineInfo),
		operations:    make([]*model.OperationInfo, 0, 100),
		heartbeatTick: 1 * time.Second,
	}
}

func (m *Monitor) Start(ctx context.Context) {
	m.logger.Info("monitor", "监控系统启动", nil)

	ticker := time.NewTicker(m.heartbeatTick)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			m.logger.Info("monitor", "监控系统停止", nil)
			return
		case <-ticker.C:
			m.checkStatus()
			m.detectDeadlocks()
		}
	}
}

func (m *Monitor) checkStatus() {
	m.mu.RLock()
	defer m.mu.RUnlock()

	now := time.Now()
	timeout := 5 * time.Second

	for _, g := range m.goroutines {
		if now.Sub(g.LastHeartbeat) > timeout {
			if g.State == model.GoroutineStateRunning || g.State == model.GoroutineStateBlocked {
				m.logger.Warn("monitor", "检测到可能僵死的 goroutine", map[string]interface{}{
					"goroutine_id":   g.ID,
					"goroutine_name": g.Name,
					"state":          string(g.State),
					"last_heartbeat": g.LastHeartbeat.String(),
				})
			}
		}
	}

	for _, ch := range m.channels {
		info := ch.Info()
		if info.State == model.ChannelStateActive {
			if now.Sub(info.LastOpAt) > 10*time.Second {
				m.logger.Warn("monitor", "channel 长时间无操作", map[string]interface{}{
					"channel_id":   info.ID,
					"channel_name": info.Name,
					"length":       info.Length,
					"capacity":     info.Capacity,
				})
			}
		}
	}
}

func (m *Monitor) detectDeadlocks() {
	blockedGoroutines := make([]*model.GoroutineInfo, 0)
	m.mu.RLock()
	for _, g := range m.goroutines {
		if g.State == model.GoroutineStateBlocked {
			blockedGoroutines = append(blockedGoroutines, g)
		}
	}
	m.mu.RUnlock()

	if len(blockedGoroutines) >= 2 {
		channels := make([]*model.ChannelInfo, 0)
		for _, g := range blockedGoroutines {
			for _, chID := range g.WaitChannels {
				if ch, ok := m.channels[chID]; ok {
					channels = append(channels, ch.Info())
				}
			}
		}

		m.detector.RecordPotentialDeadlock(blockedGoroutines, "多个 goroutine 同时阻塞")
	}
}

func (m *Monitor) RegisterChannel(name string, capacity int, chType model.ChannelType) *monitoredChannel {
	m.mu.Lock()
	defer m.mu.Unlock()

	ch := newMonitoredChannel(name, capacity, chType)
	m.channels[ch.ID()] = ch

	m.logger.Info("monitor", "注册 channel", map[string]interface{}{
		"channel_id":   ch.ID(),
		"channel_name": name,
		"type":         string(chType),
		"capacity":     capacity,
	})

	return ch
}

func (m *Monitor) UnregisterChannel(chID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if ch, ok := m.channels[chID]; ok {
		ch.Close()
		delete(m.channels, chID)

		m.logger.Info("monitor", "注销 channel", map[string]interface{}{
			"channel_id": chID,
		})
	}
}

func (m *Monitor) RegisterGoroutine(g *model.GoroutineInfo) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.goroutines[g.ID] = g

	m.logger.Info("monitor", "注册 goroutine", map[string]interface{}{
		"goroutine_id":   g.ID,
		"goroutine_name": g.Name,
		"role":           g.Role,
	})
}

func (m *Monitor) UnregisterGoroutine(gID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if g, ok := m.goroutines[gID]; ok {
		g.UpdateState(model.GoroutineStateCompleted)
		delete(m.goroutines, gID)

		m.logger.Info("monitor", "注销 goroutine", map[string]interface{}{
			"goroutine_id": gID,
		})
	}
}

func (m *Monitor) RecordOperation(op *model.OperationInfo) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.operations = append(m.operations, op)

	if len(m.operations) > 1000 {
		m.operations = m.operations[len(m.operations)-1000:]
	}

	m.logger.Debug("monitor", "记录操作", map[string]interface{}{
		"operation_id": op.ID,
		"type":         string(op.Type),
		"channel_id":   op.ChannelID,
		"goroutine_id": op.GoroutineID,
	})
}

func (m *Monitor) GetChannel(chID string) (*monitoredChannel, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	ch, ok := m.channels[chID]
	return ch, ok
}

func (m *Monitor) GetGoroutine(gID string) (*model.GoroutineInfo, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	g, ok := m.goroutines[gID]
	return g, ok
}

func (m *Monitor) GetAllChannels() []*model.ChannelInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	infos := make([]*model.ChannelInfo, 0, len(m.channels))
	for _, ch := range m.channels {
		infos = append(infos, ch.Info())
	}
	return infos
}

func (m *Monitor) GetAllGoroutines() []*model.GoroutineInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	goroutines := make([]*model.GoroutineInfo, 0, len(m.goroutines))
	for _, g := range m.goroutines {
		goroutines = append(goroutines, g)
	}
	return goroutines
}

func (m *Monitor) GetRecentOperations(limit int) []*model.OperationInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if limit <= 0 || limit > len(m.operations) {
		limit = len(m.operations)
	}

	result := make([]*model.OperationInfo, limit)
	copy(result, m.operations[len(m.operations)-limit:])
	return result
}
