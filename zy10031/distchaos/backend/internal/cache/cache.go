package cache

import (
	"fmt"
	"sync"
	"time"

	"distchaos/internal/service"
)

type CacheService struct {
	mu        sync.RWMutex
	data      map[string]interface{}
	chaosState *service.ChaosState
}

func NewCacheService(chaosState *service.ChaosState) *CacheService {
	return &CacheService{
		data:       make(map[string]interface{}),
		chaosState: chaosState,
	}
}

func (c *CacheService) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.chaosState.IsCacheDirty() {
		if dirtyVal, ok := c.chaosState.GetDirtyCache(key); ok {
			return dirtyVal, true
		}
	}

	val, ok := c.data[key]
	return val, ok
}

func (c *CacheService) Set(key string, value interface{}) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.data[key] = value
}

func (c *CacheService) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.data, key)
}

func (c *CacheService) GetProductCache(productID int64) (map[string]interface{}, bool) {
	key := GetProductKey(productID)
	val, ok := c.Get(key)
	if !ok {
		return nil, false
	}
	if m, ok := val.(map[string]interface{}); ok {
		return m, true
	}
	return nil, false
}

func (c *CacheService) SetProductCache(productID int64, price float64, stock int) {
	key := GetProductKey(productID)
	c.Set(key, map[string]interface{}{
		"id":       productID,
		"price":    price,
		"stock":    stock,
		"version":  1,
		"cachedAt": time.Now().Unix(),
	})
}

func GetProductKey(productID int64) string {
	return fmt.Sprintf("product:%d", productID)
}

func (c *CacheService) GetAll() map[string]interface{} {
	c.mu.RLock()
	defer c.mu.RUnlock()

	result := make(map[string]interface{})
	for k, v := range c.data {
		result[k] = v
	}

	if c.chaosState.IsCacheDirty() {
		c.chaosState.Mu.RLock()
		for k, v := range c.chaosState.CacheDirtyData {
			result[k] = v
		}
		c.chaosState.Mu.RUnlock()
	}

	return result
}
