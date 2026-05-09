package services

import (
	"context"
	"math/rand"
	"sync"
	"time"

	"github.com/google/uuid"
	"chaos-demo/internal/eventstore"
	"chaos-demo/internal/types"
)

type ChaosService struct {
	eventStore *eventstore.EventStore
	config     types.FaultConfig
	configMu   sync.RWMutex

	activeLocks int
	locksMu     sync.Mutex

	configVersion int
}

func NewChaosService(eventStore *eventstore.EventStore) *ChaosService {
	return &ChaosService{
		eventStore:    eventStore,
		config:        types.FaultConfig{},
		activeLocks:   0,
		configVersion: 1,
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

func (c *ChaosService) ShouldInjectConnectionPoolExhausted() bool {
	config := c.GetConfig()
	if !config.Enabled || config.ConnectionPoolExhausted == nil || !config.ConnectionPoolExhausted.Enabled {
		return false
	}

	c.eventStore.Append(types.Event{
		ID:     uuid.New(),
		Type:   types.EventTypeConnectionPoolExhausted,
		Status: types.EventStatusPending,
		Payload: map[string]interface{}{
			"duration_seconds": config.ConnectionPoolExhausted.DurationSec,
			"message":          "Connection pool exhaustion injected",
		},
		Timestamp: time.Now(),
	})

	return true
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
			"message":           "Message backlog injected",
		},
		Timestamp: time.Now(),
	})

	return true
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
		c.eventStore.Append(types.Event{
			ID:     uuid.New(),
			Type:   types.EventTypeGoroutineLeak,
			Status: types.EventStatusPending,
			Payload: map[string]interface{}{
				"leak_rate": probability,
				"message":   "Goroutine leak injected",
			},
			Timestamp: time.Now(),
		})
	}

	return shouldLeak
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

	shouldWait := rand.Float64() < probability
	if shouldWait {
		c.locksMu.Lock()
		c.activeLocks++
		c.locksMu.Unlock()

		c.eventStore.Append(types.Event{
			ID:     uuid.New(),
			Type:   types.EventTypeDBLockWait,
			Status: types.EventStatusPending,
			Payload: map[string]interface{}{
				"lock_timeout_ms": config.DBLockWait.LockTimeoutMs,
				"active_locks":    c.activeLocks,
				"message":         "Database lock wait injected",
			},
			Timestamp: time.Now(),
		})
	}

	return shouldWait
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

	shouldInject := rand.Float64() < probability
	if shouldInject {
		c.eventStore.Append(types.Event{
			ID:     uuid.New(),
			Type:   types.EventTypeCacheDirty,
			Status: types.EventStatusPending,
			Payload: map[string]interface{}{
				"dirty_probability": probability,
				"message":           "Cache dirty data injected",
			},
			Timestamp: time.Now(),
		})
	}

	return shouldInject
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

func (c *ChaosService) GetActiveLocks() int {
	c.locksMu.Lock()
	defer c.locksMu.Unlock()
	return c.activeLocks
}

func (c *ChaosService) ReleaseLock() {
	c.locksMu.Lock()
	defer c.locksMu.Unlock()
	if c.activeLocks > 0 {
		c.activeLocks--
	}
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

					c.eventStore.Append(types.Event{
						ID:     uuid.New(),
						Type:   types.EventTypeConfigDrift,
						Status: types.EventStatusPending,
						Payload: map[string]interface{}{
							"message":         "Config drift detected",
							"config_version":  c.configVersion,
							"drift_interval":  interval,
						},
						Timestamp: time.Now(),
					})

					c.configMu.Lock()
					c.configVersion++
					c.configMu.Unlock()
				} else {
					time.Sleep(5 * time.Second)
				}
			}
		}
	}()
}

func (c *ChaosService) SimulateConnectionPoolExhaustion(duration int) {
	c.eventStore.Append(types.Event{
		ID:     uuid.New(),
		Type:   types.EventTypeConnectionPoolExhausted,
		Status: types.EventStatusSuccess,
		Payload: map[string]interface{}{
			"duration_seconds": duration,
			"message":          "Connection pool exhaustion simulation started",
		},
		Timestamp: time.Now(),
	})
}

func (c *ChaosService) SimulateMessageBacklog(threshold int) {
	c.eventStore.Append(types.Event{
		ID:     uuid.New(),
		Type:   types.EventTypeMessageBacklog,
		Status: types.EventStatusSuccess,
		Payload: map[string]interface{}{
			"backlog_threshold": threshold,
			"message":           "Message backlog simulation started",
		},
		Timestamp: time.Now(),
	})
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
