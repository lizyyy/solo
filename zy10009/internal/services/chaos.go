package services

import (
	"context"
	"errors"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"chaos-demo/internal/eventstore"
	"chaos-demo/internal/types"
)

type ChaosService struct {
	eventStore *eventstore.EventStore
	db         *pgxpool.Pool
	config     types.FaultConfig
	configMu   sync.RWMutex

	configVersion int

	leakedGoroutines int64

	activeLocks      int
	activeDBLocks    map[string]*dbLock
	activeDBLocksMu  sync.Mutex

	poolExhausted    bool
	poolExhaustedMu  sync.RWMutex
	poolExhaustedCh  chan struct{}

	backlogThrottled bool
	backlogThrottledMu sync.RWMutex

	dirtyCacheVersion map[string]int
	dirtyCacheMu      sync.RWMutex

	dbVersion     map[string]int
	dbVersionMu   sync.RWMutex
}

type dbLock struct {
	ID        string
	ProductID string
	AcquiredAt time.Time
	ReleaseAt  time.Time
}

func NewChaosService(eventStore *eventstore.EventStore, db *pgxpool.Pool) *ChaosService {
	return &ChaosService{
		eventStore:       eventStore,
		db:               db,
		config:           types.FaultConfig{},
		activeLocks:      0,
		configVersion:    1,
		activeDBLocks:    make(map[string]*dbLock),
		dirtyCacheVersion: make(map[string]int),
		dbVersion:        make(map[string]int),
	}
}

func (c *ChaosService) GetConfig() types.FaultConfig {
	c.configMu.RLock()
	defer c.configMu.RUnlock()
	return c.config
}

func (c *ChaosService) SetConfig(config types.FaultConfig) {
	c.configMu.Lock()
	defer c.configMu.Unlock()

	oldConfig := c.config
	c.config = config
	c.configVersion++

	c.eventStore.Append(types.Event{
		ID:     uuid.New(),
		Type:   types.EventTypeConfigDrift,
		Status: types.EventStatusSuccess,
		Payload: map[string]interface{}{
			"old_config":    oldConfig,
			"new_config":    config,
			"config_version": c.configVersion,
		},
		Timestamp: time.Now(),
	})
}

func (c *ChaosService) Enable() {
	config := c.GetConfig()
	config.Enabled = true
	c.SetConfig(config)
}

func (c *ChaosService) Disable() {
	config := c.GetConfig()
	config.Enabled = false
	c.SetConfig(config)
}

func (c *ChaosService) MaybeExhaustConnectionPool(ctx context.Context) error {
	config := c.GetConfig()
	if !config.Enabled || config.ConnectionPoolExhausted == nil || !config.ConnectionPoolExhausted.Enabled {
		return nil
	}

	duration := config.ConnectionPoolExhausted.DurationSec
	if duration <= 0 {
		duration = 30
	}

	c.eventStore.Append(types.Event{
		ID:     uuid.New(),
		Type:   types.EventTypeConnectionPoolExhausted,
		Status: types.EventStatusPending,
		Payload: map[string]interface{}{
			"duration_seconds": duration,
			"message":          "Connection pool exhaustion injected - acquiring all connections",
		},
		Timestamp: time.Now(),
	})

	go c.exhaustPool(ctx, duration)

	return errors.New("connection pool exhausted, request queued")
}

func (c *ChaosService) exhaustPool(ctx context.Context, durationSec int) {
	c.poolExhaustedMu.Lock()
	if c.poolExhausted {
		c.poolExhaustedMu.Unlock()
		return
	}
	c.poolExhausted = true
	c.poolExhaustedCh = make(chan struct{})
	c.poolExhaustedMu.Unlock()

	acquired := 0
	var conns []*pgxpool.Conn
	maxConns := 0

	if c.db != nil {
		stat := c.db.Stat()
		maxConns = int(stat.MaxConns())
		for i := 0; i < maxConns; i++ {
			conn, err := c.db.Acquire(ctx)
			if err != nil {
				break
			}
			conns = append(conns, conn)
			acquired++
		}
	}

	c.eventStore.Append(types.Event{
		ID:     uuid.New(),
		Type:   types.EventTypeConnectionPoolExhausted,
		Status: types.EventStatusSuccess,
		Payload: map[string]interface{}{
			"acquired_conns":  acquired,
			"max_conns":       maxConns,
			"duration_seconds": durationSec,
			"message":         "Connection pool exhausted, all connections acquired",
		},
		Timestamp: time.Now(),
	})

	time.Sleep(time.Duration(durationSec) * time.Second)

	for _, conn := range conns {
		conn.Release()
	}

	c.poolExhaustedMu.Lock()
	c.poolExhausted = false
	if c.poolExhaustedCh != nil {
		close(c.poolExhaustedCh)
		c.poolExhaustedCh = nil
	}
	c.poolExhaustedMu.Unlock()

	c.eventStore.Append(types.Event{
		ID:     uuid.New(),
		Type:   types.EventTypeConnectionPoolExhausted,
		Status: types.EventStatusSuccess,
		Payload: map[string]interface{}{
			"released_conns": acquired,
			"message":        "Connection pool restored",
		},
		Timestamp: time.Now(),
	})
}

func (c *ChaosService) IsPoolExhausted() bool {
	c.poolExhaustedMu.RLock()
	defer c.poolExhaustedMu.RUnlock()
	return c.poolExhausted
}

func (c *ChaosService) WaitForPoolRestore(ctx context.Context) error {
	c.poolExhaustedMu.RLock()
	if !c.poolExhausted {
		c.poolExhaustedMu.RUnlock()
		return nil
	}
	ch := c.poolExhaustedCh
	c.poolExhaustedMu.RUnlock()

	if ch == nil {
		return nil
	}

	select {
	case <-ch:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (c *ChaosService) ShouldInjectMessageBacklog() bool {
	config := c.GetConfig()
	if !config.Enabled || config.MessageBacklog == nil || !config.MessageBacklog.Enabled {
		return false
	}

	c.eventStore.Append(types.Event{
		ID:     uuid.New(),
		Type:   types.EventTypeMessageBacklog,
		Status: types.EventStatusPending,
		Payload: map[string]interface{}{
			"backlog_threshold": config.MessageBacklog.BacklogThreshold,
			"message":           "Message backlog injected - slowing down consumer",
		},
		Timestamp: time.Now(),
	})

	return true
}

func (c *ChaosService) GetMessageBacklogDelay() time.Duration {
	config := c.GetConfig()
	if !config.Enabled || config.MessageBacklog == nil || !config.MessageBacklog.Enabled {
		return 0
	}

	baseDelay := 500 * time.Millisecond
	randomExtra := time.Duration(rand.Intn(1500)) * time.Millisecond
	return baseDelay + randomExtra
}

func (c *ChaosService) ShouldInjectGoroutineLeak() bool {
	config := c.GetConfig()
	if !config.Enabled || config.GoroutineLeak == nil || !config.GoroutineLeak.Enabled {
		return false
	}

	probability := config.GoroutineLeak.LeakRate
	if probability <= 0 {
		probability = 0.1
	}

	shouldLeak := rand.Float64() < probability
	if shouldLeak {
		c.LeakGoroutine(probability)
	}

	return shouldLeak
}

func (c *ChaosService) LeakGoroutine(probability float64) {
	atomic.AddInt64(&c.leakedGoroutines, 1)

	go func() {
		<-make(chan struct{})
	}()

	c.eventStore.Append(types.Event{
		ID:     uuid.New(),
		Type:   types.EventTypeGoroutineLeak,
		Status: types.EventStatusSuccess,
		Payload: map[string]interface{}{
			"leak_rate":        probability,
			"leaked_count":     atomic.LoadInt64(&c.leakedGoroutines),
			"message":          "Goroutine leaked and will never exit",
		},
		Timestamp: time.Now(),
	})
}

func (c *ChaosService) GetLeakedGoroutineCount() int64 {
	return atomic.LoadInt64(&c.leakedGoroutines)
}

func (c *ChaosService) ShouldInjectDBLockWait() bool {
	config := c.GetConfig()
	if !config.Enabled || config.DBLockWait == nil || !config.DBLockWait.Enabled {
		return false
	}

	probability := config.DBLockWait.WaitProbability
	if probability <= 0 || probability > 1 {
		probability = 0.3
	}

	return rand.Float64() < probability
}

func (c *ChaosService) AcquireDBLock(ctx context.Context, productID string) (string, error) {
	config := c.GetConfig()
	if config.DBLockWait == nil {
		return "", nil
	}

	lockTimeout := config.DBLockWait.LockTimeoutMs
	if lockTimeout <= 0 {
		lockTimeout = 5000
	}

	lockID := uuid.New().String()

	c.activeDBLocksMu.Lock()
	c.activeLocks++
	lock := &dbLock{
		ID:         lockID,
		ProductID:  productID,
		AcquiredAt: time.Now(),
		ReleaseAt:  time.Now().Add(time.Duration(lockTimeout) * time.Millisecond),
	}
	c.activeDBLocks[lockID] = lock
	c.activeDBLocksMu.Unlock()

	c.eventStore.Append(types.Event{
		ID:        uuid.New(),
		Type:      types.EventTypeDBLockWait,
		Status:    types.EventStatusPending,
		ProductID: &productID,
		Payload: map[string]interface{}{
			"lock_id":         lockID,
			"lock_timeout_ms": lockTimeout,
			"active_locks":    c.activeLocks,
			"message":         "Database row-level lock acquired",
		},
		Timestamp: time.Now(),
	})

	return lockID, nil
}

func (c *ChaosService) ReleaseDBLock(lockID string) {
	if lockID == "" {
		return
	}

	c.activeDBLocksMu.Lock()
	lock, exists := c.activeDBLocks[lockID]
	if exists {
		delete(c.activeDBLocks, lockID)
		c.activeLocks--
	}
	c.activeDBLocksMu.Unlock()

	if exists {
		productID := lock.ProductID
		waitDuration := time.Since(lock.AcquiredAt).Milliseconds()
		c.eventStore.Append(types.Event{
			ID:        uuid.New(),
			Type:      types.EventTypeDBLockWait,
			Status:    types.EventStatusSuccess,
			ProductID: &productID,
			Payload: map[string]interface{}{
				"lock_id":        lockID,
				"wait_duration_ms": waitDuration,
				"active_locks":   c.activeLocks,
				"message":        "Database lock released",
			},
			Timestamp: time.Now(),
		})
	}
}

func (c *ChaosService) GetActiveLocks() int {
	c.activeDBLocksMu.Lock()
	defer c.activeDBLocksMu.Unlock()
	return c.activeLocks
}

func (c *ChaosService) ShouldInjectCacheDirtyData() bool {
	config := c.GetConfig()
	if !config.Enabled || config.CacheDirtyData == nil || !config.CacheDirtyData.Enabled {
		return false
	}

	probability := config.CacheDirtyData.DirtyProbability
	if probability <= 0 || probability > 1 {
		probability = 0.2
	}

	return rand.Float64() < probability
}

func (c *ChaosService) MarkCacheDirty(productID string) {
	config := c.GetConfig()
	if !config.Enabled || config.CacheDirtyData == nil || !config.CacheDirtyData.Enabled {
		return
	}

	c.dirtyCacheMu.Lock()
	if _, exists := c.dirtyCacheVersion[productID]; !exists {
		c.dirtyCacheVersion[productID] = 0
	}
	c.dirtyCacheVersion[productID]++
	dirtyCount := c.dirtyCacheVersion[productID]
	c.dirtyCacheMu.Unlock()

	c.eventStore.Append(types.Event{
		ID:        uuid.New(),
		Type:      types.EventTypeCacheDirty,
		Status:    types.EventStatusPending,
		ProductID: &productID,
		Payload: map[string]interface{}{
			"dirty_count": dirtyCount,
			"message":     "Cache marked as dirty - DB updated but cache not synced",
		},
		Timestamp: time.Now(),
	})
}

func (c *ChaosService) IsCacheDirty(productID string) bool {
	c.dirtyCacheMu.RLock()
	defer c.dirtyCacheMu.RUnlock()
	_, dirty := c.dirtyCacheVersion[productID]
	return dirty
}

func (c *ChaosService) UpdateDBVersion(productID string) {
	c.dbVersionMu.Lock()
	if _, exists := c.dbVersion[productID]; !exists {
		c.dbVersion[productID] = 0
	}
	c.dbVersion[productID]++
	c.dbVersionMu.Unlock()
}

func (c *ChaosService) GetDBVersion(productID string) int {
	c.dbVersionMu.RLock()
	defer c.dbVersionMu.RUnlock()
	return c.dbVersion[productID]
}

func (c *ChaosService) ShouldInjectConfigDrift() bool {
	config := c.GetConfig()
	if !config.Enabled || config.ConfigDrift == nil || !config.ConfigDrift.Enabled {
		return false
	}

	return true
}

func (c *ChaosService) ShouldInjectOrderFailure() bool {
	config := c.GetConfig()
	return config.Enabled
}

func (c *ChaosService) ShouldCompensationFail() bool {
	config := c.GetConfig()
	if !config.Enabled {
		return false
	}

	probability := 0.3
	return rand.Float64() < probability
}

func (c *ChaosService) ShouldInjectCompensationRetryFailure() bool {
	config := c.GetConfig()
	if !config.Enabled {
		return false
	}

	probability := 0.6
	return rand.Float64() < probability
}

func (c *ChaosService) GetConfigVersion() int {
	return c.configVersion
}

func (c *ChaosService) StartConfigDriftTicker(ctx context.Context) {
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			default:
				config := c.GetConfig()
				if config.Enabled && config.ConfigDrift != nil && config.ConfigDrift.Enabled {
					interval := config.ConfigDrift.DriftIntervalSec
					if interval <= 0 {
						interval = 60
					}
					time.Sleep(time.Duration(interval) * time.Second)

					c.configMu.Lock()
					c.configVersion++
					newVersion := c.configVersion
					c.configMu.Unlock()

					c.eventStore.Append(types.Event{
						ID:     uuid.New(),
						Type:   types.EventTypeConfigDrift,
						Status: types.EventStatusSuccess,
						Payload: map[string]interface{}{
							"message":        "Config drift detected",
							"config_version": newVersion,
							"drift_interval": interval,
						},
						Timestamp: time.Now(),
					})
				} else {
					time.Sleep(5 * time.Second)
				}
			}
		}
	}()
}

func (c *ChaosService) ToggleFault(faultType string, enabled bool) error {
	config := c.GetConfig()

	switch faultType {
	case "connection_pool_exhausted":
		if config.ConnectionPoolExhausted == nil {
			config.ConnectionPoolExhausted = &types.FaultConfigItem{Enabled: enabled, DurationSec: 30}
		} else {
			config.ConnectionPoolExhausted.Enabled = enabled
		}
	case "message_backlog":
		if config.MessageBacklog == nil {
			config.MessageBacklog = &types.FaultConfigItem{Enabled: enabled, BacklogThreshold: 1000}
		} else {
			config.MessageBacklog.Enabled = enabled
		}
	case "goroutine_leak":
		if config.GoroutineLeak == nil {
			config.GoroutineLeak = &types.FaultConfigItem{Enabled: enabled, LeakRate: 0.1}
		} else {
			config.GoroutineLeak.Enabled = enabled
		}
	case "db_lock_wait":
		if config.DBLockWait == nil {
			config.DBLockWait = &types.FaultConfigItem{Enabled: enabled, LockTimeoutMs: 5000, WaitProbability: 0.3}
		} else {
			config.DBLockWait.Enabled = enabled
		}
	case "cache_dirty_data":
		if config.CacheDirtyData == nil {
			config.CacheDirtyData = &types.FaultConfigItem{Enabled: enabled, DirtyProbability: 0.2}
		} else {
			config.CacheDirtyData.Enabled = enabled
		}
	case "config_drift":
		if config.ConfigDrift == nil {
			config.ConfigDrift = &types.FaultConfigItem{Enabled: enabled, DriftIntervalSec: 60}
		} else {
			config.ConfigDrift.Enabled = enabled
		}
	default:
		return nil
	}

	c.SetConfig(config)
	return nil
}

func (c *ChaosService) SetBacklogThrottled(enabled bool) {
	c.backlogThrottledMu.Lock()
	defer c.backlogThrottledMu.Unlock()
	c.backlogThrottled = enabled
}

func (c *ChaosService) IsBacklogThrottled() bool {
	c.backlogThrottledMu.RLock()
	defer c.backlogThrottledMu.RUnlock()
	return c.backlogThrottled
}
