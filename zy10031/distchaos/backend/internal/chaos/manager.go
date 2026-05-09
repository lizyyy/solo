package chaos

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"runtime"
	"sync"
	"sync/atomic"
	"time"
	
	"distchaos/internal/event"
)

type ChaosType string

const (
	ChaosTypeConnectionPool  ChaosType = "connection_pool"
	ChaosTypeMessageBacklog  ChaosType = "message_backlog"
	ChaosTypeGoroutineLeak   ChaosType = "goroutine_leak"
	ChaosTypeDBLockWait      ChaosType = "db_lock_wait"
	ChaosTypeCacheDirtyData  ChaosType = "cache_dirty_data"
	ChaosTypeConfigDrift     ChaosType = "config_drift"
)

type ChaosState struct {
	ActiveScenarios map[ChaosType]*ScenarioState
	mu              sync.RWMutex
}

type ScenarioState struct {
	Type        ChaosType
	Enabled     bool
	StartTime   time.Time
	EndTime     *time.Time
	Duration    time.Duration
	Params      map[string]interface{}
	Stats       map[string]interface{}
}

type ChaosManager struct {
	state          ChaosState
	eventManager   *event.EventManager
	connectionPool *SimulatedConnectionPool
	goroutineLeak  *GoroutineLeakSimulator
	configStore    *ConfigStore
	cacheSimulator *CacheSimulator
}

type SimulatedConnectionPool struct {
	maxConns      int32
	currentConns  int32
	waitingGoroutines int32
	mu            sync.Mutex
	leakedConns   []*LeakedConnection
}

type LeakedConnection struct {
	createdAt time.Time
	id        string
}

type GoroutineLeakSimulator struct {
	leakedCount  int32
	stopChannels []chan struct{}
	mu           sync.Mutex
}

type ConfigStore struct {
	configs     map[string]interface{}
	drifted     map[string]bool
	mu          sync.RWMutex
}

type CacheSimulator struct {
	data         map[string]interface{}
	dirtyEntries map[string]interface{}
	mu           sync.RWMutex
}

func NewChaosManager(eventManager *event.EventManager) *ChaosManager {
	return &ChaosManager{
		state: ChaosState{
			ActiveScenarios: make(map[ChaosType]*ScenarioState),
		},
		eventManager: eventManager,
		connectionPool: &SimulatedConnectionPool{
			maxConns:     10,
			currentConns: 0,
			leakedConns:  make([]*LeakedConnection, 0),
		},
		goroutineLeak: &GoroutineLeakSimulator{
			leakedCount:  0,
			stopChannels: make([]chan struct{}, 0),
		},
		configStore: &ConfigStore{
			configs: make(map[string]interface{}),
			drifted: make(map[string]bool),
		},
		cacheSimulator: &CacheSimulator{
			data:         make(map[string]interface{}),
			dirtyEntries: make(map[string]interface{}),
		},
	}
}

func (m *ChaosManager) InjectScenario(ctx context.Context, chaosType ChaosType, duration time.Duration, params map[string]interface{}) error {
	m.state.mu.Lock()
	defer m.state.mu.Unlock()
	
	state := &ScenarioState{
		Type:      chaosType,
		Enabled:   true,
		StartTime: time.Now(),
		Duration:  duration,
		Params:    params,
		Stats:     make(map[string]interface{}),
	}
	
	m.state.ActiveScenarios[chaosType] = state
	
	evt := event.Event{
		Type:    event.EventTypeChaosInject,
		Status:  event.EventStatusSuccess,
		Service: "chaos-manager",
		Payload: map[string]interface{}{
			"type":     chaosType,
			"duration": duration.String(),
			"params":   params,
		},
	}
	
	if err := m.eventManager.Record(ctx, evt); err != nil {
		return err
	}
	
	go m.executeScenario(ctx, chaosType, state)
	
	return nil
}

func (m *ChaosManager) executeScenario(ctx context.Context, chaosType ChaosType, state *ScenarioState) {
	ticker := time.NewTicker(state.Duration)
	defer ticker.Stop()
	
	switch chaosType {
	case ChaosTypeConnectionPool:
		m.simulateConnectionPoolExhaustion(ctx, state)
	case ChaosTypeGoroutineLeak:
		m.simulateGoroutineLeak(ctx, state)
	case ChaosTypeMessageBacklog:
		m.simulateMessageBacklog(ctx, state)
	case ChaosTypeDBLockWait:
		m.simulateDBLockWait(ctx, state)
	case ChaosTypeCacheDirtyData:
		m.simulateCacheDirtyData(ctx, state)
	case ChaosTypeConfigDrift:
		m.simulateConfigDrift(ctx, state)
	}
	
	select {
	case <-ticker.C:
		m.StopScenario(ctx, chaosType)
	case <-ctx.Done():
		m.StopScenario(ctx, chaosType)
	}
}

func (m *ChaosManager) simulateConnectionPoolExhaustion(ctx context.Context, state *ScenarioState) {
	maxConns := int32(10)
	if val, ok := state.Params["max_conns"]; ok {
		if v, ok := val.(float64); ok {
			maxConns = int32(v)
		}
	}
	
	m.connectionPool.mu.Lock()
	m.connectionPool.maxConns = maxConns
	m.connectionPool.mu.Unlock()
	
	leakCount := 5
	if val, ok := state.Params["leak_count"]; ok {
		if v, ok := val.(float64); ok {
			leakCount = int(v)
		}
	}
	
	for i := 0; i < leakCount; i++ {
		conn := &LeakedConnection{
			createdAt: time.Now(),
			id:        fmt.Sprintf("conn-%d-%d", time.Now().UnixNano(), i),
		}
		m.connectionPool.mu.Lock()
		m.connectionPool.currentConns++
		m.connectionPool.leakedConns = append(m.connectionPool.leakedConns, conn)
		m.connectionPool.mu.Unlock()
		
		evt := event.Event{
			Type:    event.EventTypeConnectionExhausted,
			Status:  event.EventStatusPending,
			Service: "connection-pool",
			Payload: map[string]interface{}{
				"connection_id":   conn.id,
				"current_connections": atomic.LoadInt32(&m.connectionPool.currentConns),
				"max_connections": m.connectionPool.maxConns,
			},
		}
		m.eventManager.Record(ctx, evt)
		
		time.Sleep(100 * time.Millisecond)
	}
	
	state.Stats["current_connections"] = atomic.LoadInt32(&m.connectionPool.currentConns)
	state.Stats["leaked_connections"] = len(m.connectionPool.leakedConns)
}

func (m *ChaosManager) simulateGoroutineLeak(ctx context.Context, state *ScenarioState) {
	leakCount := 100
	if val, ok := state.Params["leak_count"]; ok {
		if v, ok := val.(float64); ok {
			leakCount = int(v)
		}
	}
	
	m.goroutineLeak.mu.Lock()
	initialCount := atomic.LoadInt32(&m.goroutineLeak.leakedCount)
	m.goroutineLeak.mu.Unlock()
	
	for i := 0; i < leakCount; i++ {
		stopChan := make(chan struct{})
		m.goroutineLeak.mu.Lock()
		m.goroutineLeak.stopChannels = append(m.goroutineLeak.stopChannels, stopChan)
		m.goroutineLeak.mu.Unlock()
		
		go func(id int) {
			atomic.AddInt32(&m.goroutineLeak.leakedCount, 1)
			for {
				select {
				case <-stopChan:
					atomic.AddInt32(&m.goroutineLeak.leakedCount, -1)
					return
				case <-ctx.Done():
					return
				default:
					time.Sleep(100 * time.Millisecond)
				}
			}
		}(i)
		
		evt := event.Event{
			Type:    event.EventTypeGoroutineLeak,
			Status:  event.EventStatusPending,
			Service: "goroutine-leak",
			Payload: map[string]interface{}{
				"goroutine_id":   i,
				"leaked_count":   atomic.LoadInt32(&m.goroutineLeak.leakedCount),
				"total_goroutines": runtime.NumGoroutine(),
			},
		}
		m.eventManager.Record(ctx, evt)
		
		time.Sleep(10 * time.Millisecond)
	}
	
	state.Stats["leaked_goroutines"] = atomic.LoadInt32(&m.goroutineLeak.leakedCount) - initialCount
	state.Stats["total_goroutines"] = runtime.NumGoroutine()
}

func (m *ChaosManager) simulateMessageBacklog(ctx context.Context, state *ScenarioState) {
	backlogSize := 1000
	if val, ok := state.Params["backlog_size"]; ok {
		if v, ok := val.(float64); ok {
			backlogSize = int(v)
		}
	}
	
	processDelay := 100 * time.Millisecond
	if val, ok := state.Params["process_delay"]; ok {
		if v, ok := val.(float64); ok {
			processDelay = time.Duration(v) * time.Millisecond
		}
	}
	
	for i := 0; i < backlogSize; i++ {
		evt := event.Event{
			Type:    event.EventTypeMessageBacklog,
			Status:  event.EventStatusPending,
			Service: "message-queue",
			Payload: map[string]interface{}{
				"message_id":     i,
				"backlog_size":   i + 1,
				"process_delay":  processDelay.String(),
			},
		}
		m.eventManager.Record(ctx, evt)
		
		if rand.Float64() < 0.1 {
			time.Sleep(processDelay)
		}
	}
	
	state.Stats["backlog_size"] = backlogSize
	state.Stats["process_delay"] = processDelay.String()
}

func (m *ChaosManager) simulateDBLockWait(ctx context.Context, state *ScenarioState) {
	lockCount := 5
	if val, ok := state.Params["lock_count"]; ok {
		if v, ok := val.(float64); ok {
			lockCount = int(v)
		}
	}
	
	lockDuration := 30 * time.Second
	if val, ok := state.Params["lock_duration"]; ok {
		if v, ok := val.(float64); ok {
			lockDuration = time.Duration(v) * time.Second
		}
	}
	
	var wg sync.WaitGroup
	lockChans := make([]chan struct{}, lockCount)
	
	for i := 0; i < lockCount; i++ {
		lockChans[i] = make(chan struct{})
		wg.Add(1)
		
		go func(id int, done chan struct{}) {
			defer wg.Done()
			
			evt := event.Event{
				Type:    event.EventTypeDBLockWait,
				Status:  event.EventStatusPending,
				Service: "database-lock",
				Payload: map[string]interface{}{
					"lock_id":        id,
					"lock_duration":  lockDuration.String(),
					"status":         "waiting",
				},
			}
			m.eventManager.Record(ctx, evt)
			
			select {
			case <-done:
				evt := event.Event{
					Type:    event.EventTypeDBLockWait,
					Status:  event.EventStatusSuccess,
					Service: "database-lock",
					Payload: map[string]interface{}{
						"lock_id": id,
						"status":  "released",
					},
				}
				m.eventManager.Record(ctx, evt)
			case <-ctx.Done():
				return
			case <-time.After(lockDuration):
				evt := event.Event{
					Type:    event.EventTypeDBLockWait,
					Status:  event.EventStatusFailed,
					Service: "database-lock",
					Payload: map[string]interface{}{
						"lock_id": id,
						"error":   "lock wait timeout",
					},
				}
				m.eventManager.Record(ctx, evt)
			}
		}(i, lockChans[i])
	}
	
	state.Stats["active_locks"] = lockCount
	state.Stats["lock_duration"] = lockDuration.String()
	
	for _, ch := range lockChans {
		close(ch)
	}
	wg.Wait()
}

func (m *ChaosManager) simulateCacheDirtyData(ctx context.Context, state *ScenarioState) {
	dirtyCount := 50
	if val, ok := state.Params["dirty_count"]; ok {
		if v, ok := val.(float64); ok {
			dirtyCount = int(v)
		}
	}
	
	for i := 0; i < dirtyCount; i++ {
		key := fmt.Sprintf("product:%d", i)
		correctValue := fmt.Sprintf("correct-value-%d", i)
		dirtyValue := fmt.Sprintf("dirty-value-%d-%d", i, time.Now().Unix())
		
		m.cacheSimulator.mu.Lock()
		m.cacheSimulator.data[key] = correctValue
		m.cacheSimulator.dirtyEntries[key] = dirtyValue
		m.cacheSimulator.mu.Unlock()
		
		evt := event.Event{
			Type:    event.EventTypeCacheDirty,
			Status:  event.EventStatusPending,
			Service: "cache-simulator",
			Payload: map[string]interface{}{
				"cache_key":     key,
				"correct_value": correctValue,
				"dirty_value":   dirtyValue,
			},
		}
		m.eventManager.Record(ctx, evt)
	}
	
	state.Stats["dirty_entries_count"] = dirtyCount
}

func (m *ChaosManager) simulateConfigDrift(ctx context.Context, state *ScenarioState) {
	driftCount := 20
	if val, ok := state.Params["drift_count"]; ok {
		if v, ok := val.(float64); ok {
			driftCount = int(v)
		}
	}
	
	configKeys := []string{
		"db.connection.timeout",
		"redis.pool.size",
		"kafka.batch.size",
		"service.retry.count",
		"circuit.breaker.threshold",
		"rate.limit.requests",
		"cache.ttl.seconds",
		"worker.pool.size",
		"log.level",
		"feature.flag.enabled",
	}
	
	for i := 0; i < driftCount; i++ {
		key := configKeys[i%len(configKeys)]
		originalValue := fmt.Sprintf("original-%d", i)
		driftedValue := fmt.Sprintf("drifted-%d-%d", i, time.Now().Unix())
		
		m.configStore.mu.Lock()
		m.configStore.configs[key] = originalValue
		m.configStore.drifted[key] = true
		m.configStore.mu.Unlock()
		
		evt := event.Event{
			Type:    event.EventTypeConfigDrift,
			Status:  event.EventStatusPending,
			Service: "config-store",
			Payload: map[string]interface{}{
				"config_key":      key,
				"original_value":  originalValue,
				"drifted_value":   driftedValue,
			},
		}
		m.eventManager.Record(ctx, evt)
	}
	
	state.Stats["drifted_configs_count"] = driftCount
}

func (m *ChaosManager) StopScenario(ctx context.Context, chaosType ChaosType) error {
	m.state.mu.Lock()
	defer m.state.mu.Unlock()
	
	state, exists := m.state.ActiveScenarios[chaosType]
	if !exists {
		return errors.New("scenario not found")
	}
	
	state.Enabled = false
	now := time.Now()
	state.EndTime = &now
	
	m.cleanupScenario(chaosType)
	
	evt := event.Event{
		Type:    event.EventTypeChaosRecover,
		Status:  event.EventStatusSuccess,
		Service: "chaos-manager",
		Payload: map[string]interface{}{
			"type":       chaosType,
			"duration":   time.Since(state.StartTime).String(),
			"stats":      state.Stats,
		},
	}
	
	return m.eventManager.Record(ctx, evt)
}

func (m *ChaosManager) cleanupScenario(chaosType ChaosType) {
	switch chaosType {
	case ChaosTypeConnectionPool:
		m.connectionPool.mu.Lock()
		for _, conn := range m.connectionPool.leakedConns {
			_ = conn
			atomic.AddInt32(&m.connectionPool.currentConns, -1)
		}
		m.connectionPool.leakedConns = make([]*LeakedConnection, 0)
		m.connectionPool.mu.Unlock()
		
	case ChaosTypeGoroutineLeak:
		m.goroutineLeak.mu.Lock()
		for _, ch := range m.goroutineLeak.stopChannels {
			select {
			case ch <- struct{}{}:
			default:
				close(ch)
			}
		}
		m.goroutineLeak.stopChannels = make([]chan struct{}, 0)
		m.goroutineLeak.mu.Unlock()
		
	case ChaosTypeCacheDirtyData:
		m.cacheSimulator.mu.Lock()
		for key, correctValue := range m.cacheSimulator.data {
			m.cacheSimulator.dirtyEntries[key] = correctValue
		}
		m.cacheSimulator.mu.Unlock()
		
	case ChaosTypeConfigDrift:
		m.configStore.mu.Lock()
		for key := range m.configStore.drifted {
			m.configStore.drifted[key] = false
		}
		m.configStore.mu.Unlock()
	}
}

func (m *ChaosManager) GetStatus() map[string]interface{} {
	m.state.mu.RLock()
	defer m.state.mu.RUnlock()
	
	status := make(map[string]interface{})
	activeScenarios := make(map[string]interface{})
	
	for typ, state := range m.state.ActiveScenarios {
		if state.Enabled {
			activeScenarios[string(typ)] = map[string]interface{}{
				"enabled":  state.Enabled,
				"duration": time.Since(state.StartTime).String(),
				"params":   state.Params,
				"stats":    state.Stats,
			}
		}
	}
	
	status["active_scenarios"] = activeScenarios
	status["connection_pool"] = map[string]interface{}{
		"current_connections": atomic.LoadInt32(&m.connectionPool.currentConns),
		"max_connections":     m.connectionPool.maxConns,
		"leaked_connections":  len(m.connectionPool.leakedConns),
	}
	status["goroutine_leak"] = map[string]interface{}{
		"leaked_count": atomic.LoadInt32(&m.goroutineLeak.leakedCount),
		"total_goroutines": runtime.NumGoroutine(),
	}
	
	return status
}
