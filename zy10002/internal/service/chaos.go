package service

import (
	"context"
	"fmt"
	"math/rand"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"gorm.io/gorm"

	"chaos-payment/internal/cache"
	"chaos-payment/internal/config"
	"chaos-payment/internal/eventbus"
	"chaos-payment/internal/models"
)

type ChaosEngine struct {
	db                 *gorm.DB
	cache              *cache.Cache
	bus                *eventbus.EventBus
	metrics            map[string]float64
	metricsMu          sync.RWMutex
	activeLeaks        int64
	stopChannels       []chan struct{}
	stopMu             sync.Mutex
	running            bool
	configDriftStopCh  chan struct{}
	configDriftMu      sync.Mutex
	configDriftRunning bool
}

func NewChaosEngine(db *gorm.DB, c *cache.Cache, bus *eventbus.EventBus) *ChaosEngine {
	return &ChaosEngine{
		db:      db,
		cache:   c,
		bus:     bus,
		metrics: make(map[string]float64),
		running: true,
	}
}

func (ce *ChaosEngine) Start() {
	ce.running = true
	ce.startConfigDriftWatcher()
}

func (ce *ChaosEngine) Stop() {
	ce.running = false
	ce.stopMu.Lock()
	defer ce.stopMu.Unlock()
	for _, ch := range ce.stopChannels {
		close(ch)
	}
	ce.stopChannels = nil
}

func (ce *ChaosEngine) RecordMetric(metricType string, value float64, description string) {
	ce.metricsMu.Lock()
	ce.metrics[metricType] = value
	ce.metricsMu.Unlock()

	metric := &models.ChaosMetric{
		MetricType:  metricType,
		Value:       value,
		Description: description,
		Timestamp:   time.Now(),
	}
	ce.db.Create(metric)

	ce.bus.Publish(eventbus.EventTypeChaosInjected, "", "chaos_metric", nil, map[string]interface{}{
		"metric_type": metricType,
		"value":       value,
		"description": description,
	}, "chaos-engine")
}

func (ce *ChaosEngine) GetMetrics() map[string]float64 {
	ce.metricsMu.RLock()
	defer ce.metricsMu.RUnlock()

	result := make(map[string]float64)
	for k, v := range ce.metrics {
		result[k] = v
	}

	runtime.Stack(make([]byte, 0), false)
	result["active_goroutines"] = float64(runtime.NumGoroutine())
	result["active_leaks"] = float64(atomic.LoadInt64(&ce.activeLeaks))

	return result
}

func (ce *ChaosEngine) InjectConnectionPoolExhaustion(ctx context.Context, duration time.Duration) error {
	cfg := config.Get()
	scenario := cfg.Chaos.Scenarios.ConnectionPoolExhaustion

	if !scenario.Enabled {
		return nil
	}

	sqlDB, err := ce.db.DB()
	if err != nil {
		return err
	}

	originalMaxOpen := sqlDB.Stats().MaxOpenConnections
	ce.RecordMetric("connection_pool_exhaustion_started", float64(originalMaxOpen),
		fmt.Sprintf("开始耗尽连接池，原最大连接数: %d", originalMaxOpen))

	var wg sync.WaitGroup
	stopCh := make(chan struct{})

	for i := 0; i < scenario.TriggerCount; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()

			conn, err := sqlDB.Conn(ctx)
			if err != nil {
				ce.RecordMetric("connection_pool_exhaustion_error", 1,
					fmt.Sprintf("获取连接失败: %v", err))
				return
			}
			defer conn.Close()

			select {
			case <-time.After(time.Duration(scenario.DelayMs) * time.Millisecond):
			case <-stopCh:
			}

			ce.RecordMetric("connection_pool_exhaustion_conn_held", float64(index+1),
				fmt.Sprintf("连接 %d 已释放", index))
		}(i)
	}

	go func() {
		time.Sleep(duration)
		close(stopCh)
		ce.RecordMetric("connection_pool_exhaustion_ended", 1,
			"连接池耗尽场景结束")
	}()

	return nil
}

func (ce *ChaosEngine) InjectMessageBacklog(queueSize int, processingDelay time.Duration) error {
	cfg := config.Get()
	scenario := cfg.Chaos.Scenarios.MessageBacklog

	if !scenario.Enabled {
		return nil
	}

	if queueSize == 0 {
		queueSize = scenario.QueueSize
	}

	if processingDelay == 0 {
		processingDelay = time.Duration(scenario.ProcessingDelayMs) * time.Millisecond
	}

	ce.RecordMetric("message_backlog_started", float64(queueSize),
		fmt.Sprintf("开始消息积压场景，队列大小: %d, 处理延迟: %v", queueSize, processingDelay))

	queue := make(chan string, queueSize)
	stopCh := make(chan struct{})

	go func() {
		for i := 0; i < queueSize; i++ {
			select {
			case <-stopCh:
				return
			case queue <- fmt.Sprintf("message-%d", i):
				backlog := len(queue)
				ce.RecordMetric("message_backlog_queue_size", float64(backlog),
					fmt.Sprintf("当前积压消息数: %d", backlog))
			}
		}
	}()

	go func() {
		for {
			select {
			case <-stopCh:
				return
			case msg := <-queue:
				time.Sleep(processingDelay)
				ce.RecordMetric("message_backlog_processed", 1,
					fmt.Sprintf("已处理消息: %s", msg))
			}
		}
	}()

	go func() {
		time.Sleep(30 * time.Second)
		close(stopCh)
		ce.RecordMetric("message_backlog_ended", 1, "消息积压场景结束")
	}()

	return nil
}

func (ce *ChaosEngine) InjectGoroutineLeak(leakRate float64) error {
	cfg := config.Get()
	scenario := cfg.Chaos.Scenarios.GoroutineLeak

	if !scenario.Enabled {
		return nil
	}

	if leakRate == 0 {
		leakRate = scenario.LeakRate
	}

	ce.RecordMetric("goroutine_leak_started", leakRate,
		fmt.Sprintf("开始 goroutine 泄漏场景，泄漏率: %.2f", leakRate))

	leakCount := int(float64(100) * leakRate)

	for i := 0; i < leakCount; i++ {
		atomic.AddInt64(&ce.activeLeaks, 1)
		ce.bus.Publish(eventbus.EventTypeGoroutineSpawned, fmt.Sprintf("leak-%d", i), "goroutine", nil,
			map[string]interface{}{"leaked": true}, "chaos-engine")

		go func(id int) {
			defer func() {
				atomic.AddInt64(&ce.activeLeaks, -1)
				ce.bus.Publish(eventbus.EventTypeGoroutineLeaked, fmt.Sprintf("leak-%d", id), "goroutine", nil,
					map[string]interface{}{"cleaned": true}, "chaos-engine")
			}()

			ch := make(chan struct{})
			select {
			case <-ch:
			case <-time.After(10 * time.Minute):
			}
		}(i)
	}

	ce.RecordMetric("goroutine_leak_count", float64(leakCount),
		fmt.Sprintf("已泄漏 %d 个 goroutine", leakCount))

	return nil
}

func (ce *ChaosEngine) InjectDatabaseLockWait(orderID string, holdTime time.Duration) error {
	cfg := config.Get()
	scenario := cfg.Chaos.Scenarios.DatabaseLockWait

	if !scenario.Enabled {
		return nil
	}

	if holdTime == 0 {
		holdTime = time.Duration(scenario.LockHoldTimeMs) * time.Millisecond
	}

	ce.RecordMetric("database_lock_wait_started", float64(holdTime.Milliseconds()),
		fmt.Sprintf("开始数据库锁等待场景，持有时间: %v", holdTime))

	tx := ce.db.Begin()
	if tx.Error != nil {
		return tx.Error
	}

	if err := tx.Exec("SELECT pg_advisory_lock(hashtext(?))", orderID).Error; err != nil {
		tx.Rollback()
		return err
	}

	ce.bus.Publish(eventbus.EventTypeDBTransaction, orderID, "database_lock", nil,
		map[string]interface{}{"action": "locked", "hold_time_ms": holdTime.Milliseconds()},
		"chaos-engine")

	go func() {
		time.Sleep(holdTime)
		tx.Exec("SELECT pg_advisory_unlock(hashtext(?))", orderID)
		tx.Commit()

		ce.bus.Publish(eventbus.EventTypeDBTransaction, orderID, "database_lock", nil,
			map[string]interface{}{"action": "unlocked"}, "chaos-engine")

		ce.RecordMetric("database_lock_wait_ended", 1, "数据库锁已释放")
	}()

	return nil
}

func (ce *ChaosEngine) InjectCacheDirtyData(ctx context.Context, orderID string, dirtyRate float64) error {
	cfg := config.Get()
	scenario := cfg.Chaos.Scenarios.CacheDirtyData

	if !scenario.Enabled {
		return nil
	}

	if dirtyRate == 0 {
		dirtyRate = scenario.DirtyRate
	}

	if ce.cache == nil {
		return fmt.Errorf("cache not initialized")
	}

	if rand.Float64() > dirtyRate {
		return nil
	}

	order, err := ce.cache.GetOrder(ctx, orderID)
	if err != nil {
		return err
	}

	ce.RecordMetric("cache_dirty_data_started", dirtyRate,
		fmt.Sprintf("开始缓存脏数据场景，脏数据率: %.2f", dirtyRate))

	dirtyOrder := *order
	dirtyOrder.Amount = order.Amount * 1.5
	dirtyOrder.Status = models.OrderStatusSuccess

	if err := ce.cache.SetOrder(ctx, &dirtyOrder, 5*time.Minute); err != nil {
		return err
	}

	ce.bus.Publish(eventbus.EventTypeCacheWrite, orderID, "cache_dirty",
		map[string]interface{}{"original_amount": order.Amount, "original_status": order.Status},
		map[string]interface{}{"dirty_amount": dirtyOrder.Amount, "dirty_status": dirtyOrder.Status},
		"chaos-engine")

	ce.RecordMetric("cache_dirty_data_injected", 1,
		fmt.Sprintf("已注入缓存脏数据: 原金额 %.2f -> 脏金额 %.2f", order.Amount, dirtyOrder.Amount))

	return nil
}

func (ce *ChaosEngine) startConfigDriftWatcher() {
	ce.configDriftMu.Lock()
	defer ce.configDriftMu.Unlock()

	if ce.configDriftRunning {
		return
	}

	cfg := config.Get()
	scenario := cfg.Chaos.Scenarios.ConfigDrift

	if !scenario.Enabled {
		return
	}

	interval := time.Duration(scenario.DriftIntervalMs) * time.Millisecond

	stopCh := make(chan struct{})
	ce.configDriftStopCh = stopCh
	ce.configDriftRunning = true

	ce.bus.Publish(eventbus.EventTypeChaosInjected, "", "config_drift", nil,
		map[string]interface{}{"action": "started", "interval_ms": interval.Milliseconds()},
		"chaos-engine")

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				if !ce.running {
					ce.configDriftMu.Lock()
					ce.configDriftRunning = false
					ce.configDriftMu.Unlock()
					return
				}

				config.Update(func(c *config.Config) {
					if rand.Float64() < 0.5 {
						c.Order.DefaultAmount += 10
					} else {
						c.Order.DuplicateCallbackDelay += 1000
					}
				})

				ce.RecordMetric("config_drift_detected", 1,
					"配置漂移检测: 配置值已更改")

			case <-stopCh:
				ce.configDriftMu.Lock()
				ce.configDriftRunning = false
				ce.configDriftMu.Unlock()
				return

			case <-time.After(1 * time.Second):
				if !ce.running {
					ce.configDriftMu.Lock()
					ce.configDriftRunning = false
					ce.configDriftMu.Unlock()
					return
				}
			}
		}
	}()
}

func (ce *ChaosEngine) stopConfigDriftWatcher() {
	ce.configDriftMu.Lock()
	defer ce.configDriftMu.Unlock()

	if !ce.configDriftRunning {
		return
	}

	if ce.configDriftStopCh != nil {
		close(ce.configDriftStopCh)
		ce.configDriftStopCh = nil
	}

	ce.bus.Publish(eventbus.EventTypeChaosInjected, "", "config_drift", nil,
		map[string]interface{}{"action": "stopped"},
		"chaos-engine")
}

func (ce *ChaosEngine) ToggleScenario(scenarioName string, enabled bool) error {
	config.Update(func(c *config.Config) {
		switch scenarioName {
		case "connection_pool_exhaustion":
			c.Chaos.Scenarios.ConnectionPoolExhaustion.Enabled = enabled
		case "message_backlog":
			c.Chaos.Scenarios.MessageBacklog.Enabled = enabled
		case "goroutine_leak":
			c.Chaos.Scenarios.GoroutineLeak.Enabled = enabled
		case "database_lock_wait":
			c.Chaos.Scenarios.DatabaseLockWait.Enabled = enabled
		case "cache_dirty_data":
			c.Chaos.Scenarios.CacheDirtyData.Enabled = enabled
		case "config_drift":
			c.Chaos.Scenarios.ConfigDrift.Enabled = enabled
		}
	})

	ce.bus.Publish(eventbus.EventTypeRecoveryAction, scenarioName, "scenario_toggle", nil,
		map[string]interface{}{"enabled": enabled}, "chaos-engine")

	if scenarioName == "config_drift" {
		if enabled {
			ce.startConfigDriftWatcher()
		} else {
			ce.stopConfigDriftWatcher()
		}
	}

	return config.Save()
}

func (ce *ChaosEngine) GetScenarioStatus() map[string]bool {
	cfg := config.Get()
	return map[string]bool{
		"connection_pool_exhaustion": cfg.Chaos.Scenarios.ConnectionPoolExhaustion.Enabled,
		"message_backlog":            cfg.Chaos.Scenarios.MessageBacklog.Enabled,
		"goroutine_leak":             cfg.Chaos.Scenarios.GoroutineLeak.Enabled,
		"database_lock_wait":         cfg.Chaos.Scenarios.DatabaseLockWait.Enabled,
		"cache_dirty_data":           cfg.Chaos.Scenarios.CacheDirtyData.Enabled,
		"config_drift":               cfg.Chaos.Scenarios.ConfigDrift.Enabled,
	}
}
