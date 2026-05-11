package config

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"distchaos/internal/service"
)

type ConfigService struct {
	mu          sync.RWMutex
	defaults    map[string]interface{}
	overrides   map[string]interface{}
	chaosState  *service.ChaosState
}

func NewConfigService(chaosState *service.ChaosState) *ConfigService {
	svc := &ConfigService{
		defaults:   make(map[string]interface{}),
		overrides:  make(map[string]interface{}),
		chaosState: chaosState,
	}

	svc.defaults["db.connection.timeout"] = "30s"
	svc.defaults["db.connection.pool_size"] = 10
	svc.defaults["redis.pool.size"] = 20
	svc.defaults["redis.connection.timeout"] = "5s"
	svc.defaults["kafka.batch.size"] = 16384
	svc.defaults["kafka.request.timeout.ms"] = 30000
	svc.defaults["service.retry.count"] = 3
	svc.defaults["service.retry.delay"] = "1s"
	svc.defaults["circuit.breaker.threshold"] = 0.5
	svc.defaults["circuit.breaker.reset.timeout"] = "30s"
	svc.defaults["rate.limit.requests"] = 100
	svc.defaults["rate.limit.window"] = "1m"
	svc.defaults["cache.ttl.seconds"] = 300
	svc.defaults["worker.pool.size"] = 10
	svc.defaults["log.level"] = "info"
	svc.defaults["feature.flag.inventory_check"] = true
	svc.defaults["feature.flag.async_commit"] = false
	svc.defaults["order.processing.timeout"] = "1m"
	svc.defaults["payment.processing.timeout"] = "2m"

	return svc
}

func (c *ConfigService) Get(key string) interface{} {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.chaosState.IsConfigDrifted() {
		if driftedVal, ok := c.chaosState.GetDriftedConfig(key); ok {
			return driftedVal
		}
	}

	if val, ok := c.overrides[key]; ok {
		return val
	}

	if val, ok := c.defaults[key]; ok {
		return val
	}

	return nil
}

func (c *ConfigService) GetString(key string) string {
	val := c.Get(key)
	if val == nil {
		return ""
	}
	switch v := val.(type) {
	case string:
		return v
	default:
		return fmt.Sprintf("%v", v)
	}
}

func (c *ConfigService) GetInt(key string) int {
	val := c.Get(key)
	if val == nil {
		return 0
	}
	switch v := val.(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	default:
		return 0
	}
}

func (c *ConfigService) GetBool(key string) bool {
	val := c.Get(key)
	if val == nil {
		return false
	}
	switch v := val.(type) {
	case bool:
		return v
	default:
		return false
	}
}

func (c *ConfigService) GetDuration(key string) (time.Duration, error) {
	str := c.GetString(key)
	if str == "" {
		return 0, fmt.Errorf("config not found: %s", key)
	}
	return time.ParseDuration(str)
}

func (c *ConfigService) Set(key string, value interface{}) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.overrides[key] = value
}

func (c *ConfigService) Reset(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.overrides, key)
}

func (c *ConfigService) GetAll() map[string]interface{} {
	c.mu.RLock()
	defer c.mu.RUnlock()

	result := make(map[string]interface{})
	for k, v := range c.defaults {
		result[k] = v
	}
	for k, v := range c.overrides {
		result[k] = v
	}

	if c.chaosState.IsConfigDrifted() {
		c.chaosState.Mu.RLock()
		for k, v := range c.chaosState.DriftedConfigs {
			result[k] = v
		}
		c.chaosState.Mu.RUnlock()
	}

	return result
}

func (c *ConfigService) GetInventoryCheckEnabled() bool {
	return c.GetBool("feature.flag.inventory_check")
}

func (c *ConfigService) GetProcessingTimeout() time.Duration {
	d, err := c.GetDuration("order.processing.timeout")
	if err != nil {
		return 60 * time.Second
	}
	return d
}

func (c *ConfigService) GetRetryCount() int {
	return c.GetInt("service.retry.count")
}

func (c *ConfigService) GetCacheTTL() int {
	return c.GetInt("cache.ttl.seconds")
}

func (c *ConfigService) DumpJSON() string {
	data, err := json.MarshalIndent(c.GetAll(), "", "  ")
	if err != nil {
		return "{}"
	}
	return string(data)
}
