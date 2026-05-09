package statemanager

import (
	"sync"
	"time"

	"system-chaos-visualizer/backend/pkg/eventbus"
	"system-chaos-visualizer/backend/pkg/types"
)

type StateManager struct {
	mu             sync.RWMutex
	connections    map[string]types.ConnectionState
	messages       map[string]types.MessageState
	goroutines     map[int64]types.GoroutineState
	dbLocks        map[string]types.DbLockState
	cache          map[string]types.CacheState
	config         map[string]types.ConfigState
	metrics        types.SystemMetrics
	eventBus       *eventbus.EventBus
	snapshots      []types.SystemState
	maxSnapshots   int
	goroutineIDSeq int64
	messageSeq     int64
}

func NewStateManager(eb *eventbus.EventBus) *StateManager {
	return &StateManager{
		connections:  make(map[string]types.ConnectionState),
		messages:     make(map[string]types.MessageState),
		goroutines:   make(map[int64]types.GoroutineState),
		dbLocks:      make(map[string]types.DbLockState),
		cache:        make(map[string]types.CacheState),
		config:       make(map[string]types.ConfigState),
		eventBus:     eb,
		snapshots:    make([]types.SystemState, 0),
		maxSnapshots: 100,
	}
}

func (sm *StateManager) AddConnection(conn types.ConnectionState) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.connections[conn.ID] = conn
	sm.metrics.ActiveConnections++
	sm.eventBus.Publish(types.Event{
		Type:     types.EventTypeConnectionCreated,
		Severity: types.SeverityInfo,
		Source:   "connection_manager",
		Message:  "Connection created",
		Data: map[string]interface{}{
			"connection_id": conn.ID,
		},
	})
}

func (sm *StateManager) RemoveConnection(id string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	if _, exists := sm.connections[id]; exists {
		delete(sm.connections, id)
		sm.metrics.ActiveConnections--
		sm.eventBus.Publish(types.Event{
			Type:     types.EventTypeConnectionClosed,
			Severity: types.SeverityInfo,
			Source:   "connection_manager",
			Message:  "Connection closed",
			Data: map[string]interface{}{
				"connection_id": id,
			},
		})
	}
}

func (sm *StateManager) UpdateConnection(id string, updates types.ConnectionState) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	if conn, exists := sm.connections[id]; exists {
		conn.Status = updates.Status
		conn.LastActiveAt = updates.LastActiveAt
		conn.MessageCount = updates.MessageCount
		conn.ReconnectCount = updates.ReconnectCount
		sm.connections[id] = conn
	}
}

func (sm *StateManager) GetConnections() []types.ConnectionState {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	result := make([]types.ConnectionState, 0, len(sm.connections))
	for _, conn := range sm.connections {
		result = append(result, conn)
	}
	return result
}

func (sm *StateManager) AddMessage(msg types.MessageState) int64 {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.messageSeq++
	msg.Sequence = sm.messageSeq
	sm.messages[msg.ID] = msg
	return sm.messageSeq
}

func (sm *StateManager) UpdateMessage(id string, updates types.MessageState) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	if msg, exists := sm.messages[id]; exists {
		if !updates.ReceivedAt.IsZero() {
			msg.ReceivedAt = updates.ReceivedAt
			msg.DelayMs = updates.ReceivedAt.Sub(msg.SentAt).Milliseconds()
		}
		msg.Status = updates.Status
		sm.messages[id] = msg
		if msg.Status == "processed" {
			sm.metrics.MessageProcessed++
		}
	}
}

func (sm *StateManager) GetMessages() []types.MessageState {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	result := make([]types.MessageState, 0, len(sm.messages))
	for _, msg := range sm.messages {
		result = append(result, msg)
	}
	return result
}

func (sm *StateManager) AddGoroutine(g types.GoroutineState) int64 {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.goroutineIDSeq++
	g.ID = sm.goroutineIDSeq
	g.CreatedAt = time.Now()
	g.Status = "running"
	sm.goroutines[g.ID] = g
	sm.metrics.ActiveGoroutines++
	sm.eventBus.Publish(types.Event{
		Type:     types.EventTypeGoroutineCreated,
		Severity: types.SeverityInfo,
		Source:   "goroutine_manager",
		Message:  "Goroutine created",
		Data: map[string]interface{}{
			"goroutine_id": g.ID,
			"name":         g.Name,
		},
	})
	return g.ID
}

func (sm *StateManager) MarkGoroutineLeaked(id int64) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	if g, exists := sm.goroutines[id]; exists {
		g.IsLeaked = true
		g.Status = "leaked"
		sm.goroutines[id] = g
		sm.metrics.LeakedGoroutines++
		sm.eventBus.Publish(types.Event{
			Type:     types.EventTypeGoroutineLeaked,
			Severity: types.SeverityWarning,
			Source:   "goroutine_manager",
			Message:  "Goroutine leaked detected",
			Data: map[string]interface{}{
				"goroutine_id": id,
				"name":         g.Name,
			},
		})
	}
}

func (sm *StateManager) RemoveGoroutine(id int64) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	if _, exists := sm.goroutines[id]; exists {
		delete(sm.goroutines, id)
		sm.metrics.ActiveGoroutines--
	}
}

func (sm *StateManager) GetGoroutines() []types.GoroutineState {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	result := make([]types.GoroutineState, 0, len(sm.goroutines))
	for _, g := range sm.goroutines {
		result = append(result, g)
	}
	return result
}

func (sm *StateManager) AcquireLock(resource, holderID string) bool {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	if lock, exists := sm.dbLocks[resource]; exists {
		lock.Waiters = append(lock.Waiters, holderID)
		sm.dbLocks[resource] = lock
		sm.eventBus.Publish(types.Event{
			Type:     types.EventTypeDbLockWait,
			Severity: types.SeverityWarning,
			Source:   "db_lock_manager",
			Message:  "Waiting for lock",
			Data: map[string]interface{}{
				"resource":   resource,
				"holder_id":  holderID,
				"current_holder": lock.HolderID,
			},
		})
		return false
	}
	sm.dbLocks[resource] = types.DbLockState{
		Resource:   resource,
		HolderID:   holderID,
		AcquiredAt: time.Now(),
		Waiters:    []string{},
	}
	sm.eventBus.Publish(types.Event{
		Type:     types.EventTypeDbLockAcquired,
		Severity: types.SeverityInfo,
		Source:   "db_lock_manager",
		Message:  "Lock acquired",
		Data: map[string]interface{}{
			"resource":  resource,
			"holder_id": holderID,
		},
	})
	return true
}

func (sm *StateManager) ReleaseLock(resource string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	if lock, exists := sm.dbLocks[resource]; exists {
		if len(lock.Waiters) > 0 {
			newHolder := lock.Waiters[0]
			lock.Waiters = lock.Waiters[1:]
			lock.HolderID = newHolder
			lock.AcquiredAt = time.Now()
			sm.dbLocks[resource] = lock
			sm.eventBus.Publish(types.Event{
				Type:     types.EventTypeDbLockAcquired,
				Severity: types.SeverityInfo,
				Source:   "db_lock_manager",
				Message:  "Lock acquired by waiter",
				Data: map[string]interface{}{
					"resource":  resource,
					"holder_id": newHolder,
				},
			})
		} else {
			delete(sm.dbLocks, resource)
		}
		sm.eventBus.Publish(types.Event{
			Type:     types.EventTypeDbLockReleased,
			Severity: types.SeverityInfo,
			Source:   "db_lock_manager",
			Message:  "Lock released",
			Data: map[string]interface{}{
				"resource": resource,
			},
		})
	}
}

func (sm *StateManager) GetDbLocks() []types.DbLockState {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	result := make([]types.DbLockState, 0, len(sm.dbLocks))
	for _, lock := range sm.dbLocks {
		result = append(result, lock)
	}
	return result
}

func (sm *StateManager) SetCache(key string, value interface{}, ttl time.Duration) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	existing, exists := sm.cache[key]
	version := int64(1)
	if exists {
		version = existing.Version + 1
	}
	sm.cache[key] = types.CacheState{
		Key:         key,
		Value:       value,
		Version:     version,
		LastUpdated: time.Now(),
		IsDirty:     false,
		TTL:         ttl,
	}
	sm.eventBus.Publish(types.Event{
		Type:     types.EventTypeCacheUpdated,
		Severity: types.SeverityInfo,
		Source:   "cache_manager",
		Message:  "Cache updated",
		Data: map[string]interface{}{
			"key":     key,
			"version": version,
		},
	})
}

func (sm *StateManager) MarkCacheDirty(key string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	if cache, exists := sm.cache[key]; exists {
		cache.IsDirty = true
		sm.cache[key] = cache
		sm.eventBus.Publish(types.Event{
			Type:     types.EventTypeCacheDirty,
			Severity: types.SeverityWarning,
			Source:   "cache_manager",
			Message:  "Cache marked as dirty",
			Data: map[string]interface{}{
				"key": key,
			},
		})
	}
}

func (sm *StateManager) GetCache() []types.CacheState {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	result := make([]types.CacheState, 0, len(sm.cache))
	for _, c := range sm.cache {
		result = append(result, c)
	}
	return result
}

func (sm *StateManager) SetConfig(key string, value interface{}, source string, expectedValue interface{}) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	hasDrift := false
	if expectedValue != nil {
		hasDrift = value != expectedValue
	}
	sm.config[key] = types.ConfigState{
		Key:           key,
		Value:         value,
		Source:        source,
		LastUpdated:   time.Now(),
		ExpectedValue: expectedValue,
		HasDrift:      hasDrift,
	}
	if hasDrift {
		sm.metrics.ConfigDriftCount++
		sm.eventBus.Publish(types.Event{
			Type:     types.EventTypeConfigDrift,
			Severity: types.SeverityWarning,
			Source:   "config_manager",
			Message:  "Config drift detected",
			Data: map[string]interface{}{
				"key":            key,
				"value":          value,
				"expected_value": expectedValue,
			},
		})
	} else {
		sm.eventBus.Publish(types.Event{
			Type:     types.EventTypeConfigChanged,
			Severity: types.SeverityInfo,
			Source:   "config_manager",
			Message:  "Config updated",
			Data: map[string]interface{}{
				"key":   key,
				"value": value,
			},
		})
	}
}

func (sm *StateManager) GetConfig() []types.ConfigState {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	result := make([]types.ConfigState, 0, len(sm.config))
	for _, c := range sm.config {
		result = append(result, c)
	}
	return result
}

func (sm *StateManager) UpdateMetrics(updates func(*types.SystemMetrics)) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	updates(&sm.metrics)
}

func (sm *StateManager) GetMetrics() types.SystemMetrics {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.metrics
}

func (sm *StateManager) TakeSnapshot() types.SystemState {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	state := types.SystemState{
		Timestamp:   time.Now(),
		Connections: make([]types.ConnectionState, 0, len(sm.connections)),
		Messages:    make([]types.MessageState, 0, len(sm.messages)),
		Goroutines:  make([]types.GoroutineState, 0, len(sm.goroutines)),
		DbLocks:     make([]types.DbLockState, 0, len(sm.dbLocks)),
		Cache:       make([]types.CacheState, 0, len(sm.cache)),
		Config:      make([]types.ConfigState, 0, len(sm.config)),
		Metrics:     sm.metrics,
	}

	for _, conn := range sm.connections {
		state.Connections = append(state.Connections, conn)
	}
	for _, msg := range sm.messages {
		state.Messages = append(state.Messages, msg)
	}
	for _, g := range sm.goroutines {
		state.Goroutines = append(state.Goroutines, g)
	}
	for _, lock := range sm.dbLocks {
		state.DbLocks = append(state.DbLocks, lock)
	}
	for _, c := range sm.cache {
		state.Cache = append(state.Cache, c)
	}
	for _, c := range sm.config {
		state.Config = append(state.Config, c)
	}

	sm.snapshots = append(sm.snapshots, state)
	if len(sm.snapshots) > sm.maxSnapshots {
		sm.snapshots = sm.snapshots[len(sm.snapshots)-sm.maxSnapshots:]
	}

	sm.eventBus.Publish(types.Event{
		Type:     types.EventTypeSystemStateSnapshot,
		Severity: types.SeverityInfo,
		Source:   "state_manager",
		Message:  "System state snapshot taken",
		Data: map[string]interface{}{
			"snapshot_index": len(sm.snapshots) - 1,
		},
	})

	return state
}

func (sm *StateManager) GetSnapshots() []types.SystemState {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	result := make([]types.SystemState, len(sm.snapshots))
	copy(result, sm.snapshots)
	return result
}

func (sm *StateManager) Clear() {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.connections = make(map[string]types.ConnectionState)
	sm.messages = make(map[string]types.MessageState)
	sm.goroutines = make(map[int64]types.GoroutineState)
	sm.dbLocks = make(map[string]types.DbLockState)
	sm.cache = make(map[string]types.CacheState)
	sm.config = make(map[string]types.ConfigState)
	sm.metrics = types.SystemMetrics{}
	sm.snapshots = make([]types.SystemState, 0)
	sm.goroutineIDSeq = 0
	sm.messageSeq = 0
}
