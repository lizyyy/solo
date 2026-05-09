package recovery

import (
	"sync"
	"time"

	"system-chaos-visualizer/backend/pkg/eventbus"
	"system-chaos-visualizer/backend/pkg/statemanager"
	"system-chaos-visualizer/backend/pkg/types"
)

type RecoveryService struct {
	mu           sync.Mutex
	sm           *statemanager.StateManager
	eb           *eventbus.EventBus
	isRecovering bool
}

func NewRecoveryService(sm *statemanager.StateManager, eb *eventbus.EventBus) *RecoveryService {
	return &RecoveryService{
		sm: sm,
		eb: eb,
	}
}

func (rs *RecoveryService) RecoverConnectionPool() {
	rs.eb.Publish(types.Event{
		Type:     types.EventTypeRecoveryStarted,
		Severity: types.SeverityInfo,
		Source:   "recovery_service",
		Message:  "Starting connection pool recovery",
		Data: map[string]interface{}{
			"strategy": "reset_pool",
		},
	})

	conns := rs.sm.GetConnections()
	for _, conn := range conns {
		rs.sm.UpdateConnection(conn.ID, types.ConnectionState{
			Status:       "recovering",
			LastActiveAt: time.Now(),
		})
	}

	time.Sleep(500 * time.Millisecond)

	rs.sm.UpdateMetrics(func(m *types.SystemMetrics) {
		m.ConnectionPoolUsage = 0
	})

	rs.eb.Publish(types.Event{
		Type:     types.EventTypeRecoveryCompleted,
		Severity: types.SeverityInfo,
		Source:   "recovery_service",
		Message:  "Connection pool recovered",
		Data: map[string]interface{}{
			"recovered_conns": len(conns),
		},
	})
}

func (rs *RecoveryService) RecoverMessageQueue() {
	rs.eb.Publish(types.Event{
		Type:     types.EventTypeRecoveryStarted,
		Severity: types.SeverityInfo,
		Source:   "recovery_service",
		Message:  "Starting message queue recovery",
		Data: map[string]interface{}{
			"strategy": "clear_queue",
		},
	})

	rs.sm.UpdateMetrics(func(m *types.SystemMetrics) {
		m.MessageQueueSize = 0
	})

	rs.eb.Publish(types.Event{
		Type:     types.EventTypeRecoveryCompleted,
		Severity: types.SeverityInfo,
		Source:   "recovery_service",
		Message:  "Message queue recovered",
		Data: map[string]interface{}{
			"queue_cleared": true,
		},
	})
}

func (rs *RecoveryService) RecoverGoroutines() {
	rs.eb.Publish(types.Event{
		Type:     types.EventTypeRecoveryStarted,
		Severity: types.SeverityInfo,
		Source:   "recovery_service",
		Message:  "Starting goroutine recovery",
		Data: map[string]interface{}{
			"strategy": "mark_leaked",
		},
	})

	leaked := 0
	goroutines := rs.sm.GetGoroutines()
	for _, g := range goroutines {
		if !g.IsLeaked && time.Now().After(g.ExpectedEnd) {
			rs.sm.MarkGoroutineLeaked(g.ID)
			leaked++
		}
	}

	rs.eb.Publish(types.Event{
		Type:     types.EventTypeRecoveryCompleted,
		Severity: types.SeverityInfo,
		Source:   "recovery_service",
		Message:  "Goroutine recovery completed",
		Data: map[string]interface{}{
			"leaked_detected": leaked,
		},
	})
}

func (rs *RecoveryService) RecoverDbLocks() {
	rs.eb.Publish(types.Event{
		Type:     types.EventTypeRecoveryStarted,
		Severity: types.SeverityInfo,
		Source:   "recovery_service",
		Message:  "Starting database lock recovery",
		Data: map[string]interface{}{
			"strategy": "force_release",
		},
	})

	locks := rs.sm.GetDbLocks()
	for _, lock := range locks {
		rs.sm.ReleaseLock(lock.Resource)
	}

	rs.sm.UpdateMetrics(func(m *types.SystemMetrics) {
		m.DbLockWaitTimeMs = 0
	})

	rs.eb.Publish(types.Event{
		Type:     types.EventTypeRecoveryCompleted,
		Severity: types.SeverityInfo,
		Source:   "recovery_service",
		Message:  "Database lock recovery completed",
		Data: map[string]interface{}{
			"locks_released": len(locks),
		},
	})
}

func (rs *RecoveryService) RecoverCache() {
	rs.eb.Publish(types.Event{
		Type:     types.EventTypeRecoveryStarted,
		Severity: types.SeverityInfo,
		Source:   "recovery_service",
		Message:  "Starting cache recovery",
		Data: map[string]interface{}{
			"strategy": "invalidate_dirty",
		},
	})

	cache := rs.sm.GetCache()
	invalidated := 0
	for _, c := range cache {
		if c.IsDirty {
			rs.sm.SetCache(c.Key, c.Value, c.TTL)
			invalidated++
		}
	}

	rs.eb.Publish(types.Event{
		Type:     types.EventTypeRecoveryCompleted,
		Severity: types.SeverityInfo,
		Source:   "recovery_service",
		Message:  "Cache recovery completed",
		Data: map[string]interface{}{
			"dirty_invalidated": invalidated,
		},
	})
}

func (rs *RecoveryService) RecoverConfig() {
	rs.eb.Publish(types.Event{
		Type:     types.EventTypeRecoveryStarted,
		Severity: types.SeverityInfo,
		Source:   "recovery_service",
		Message:  "Starting config recovery",
		Data: map[string]interface{}{
			"strategy": "reset_to_default",
		},
	})

	config := rs.sm.GetConfig()
	recovered := 0
	for _, c := range config {
		if c.HasDrift && c.ExpectedValue != nil {
			rs.sm.SetConfig(c.Key, c.ExpectedValue, "recovery", nil)
			recovered++
		}
	}

	rs.sm.UpdateMetrics(func(m *types.SystemMetrics) {
		m.ConfigDriftCount = 0
	})

	rs.eb.Publish(types.Event{
		Type:     types.EventTypeRecoveryCompleted,
		Severity: types.SeverityInfo,
		Source:   "recovery_service",
		Message:  "Config recovery completed",
		Data: map[string]interface{}{
			"configs_recovered": recovered,
		},
	})
}

func (rs *RecoveryService) RecoverAll() {
	rs.eb.Publish(types.Event{
		Type:     types.EventTypeRecoveryStarted,
		Severity: types.SeverityInfo,
		Source:   "recovery_service",
		Message:  "Starting full system recovery",
	})

	go func() {
		rs.RecoverConnectionPool()
		rs.RecoverMessageQueue()
		rs.RecoverGoroutines()
		rs.RecoverDbLocks()
		rs.RecoverCache()
		rs.RecoverConfig()

		rs.eb.Publish(types.Event{
			Type:     types.EventTypeRecoveryCompleted,
			Severity: types.SeverityInfo,
			Source:   "recovery_service",
			Message:  "Full system recovery completed",
		})
	}()
}
