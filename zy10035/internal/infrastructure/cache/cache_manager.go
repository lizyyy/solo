package cache

import (
	"context"
	"fmt"
	"sync"
	"time"

	"mq-deadletter-review/pkg/errors"
	"mq-deadletter-review/pkg/logger"
)

type CacheManager struct {
	redis   *RedisClient
	locker  *RedisLocker
	localMu sync.RWMutex
	local   map[string]*cacheEntry
	ttl     time.Duration
}

type cacheEntry struct {
	value     string
	expiresAt time.Time
}

func NewCacheManager(redis *RedisClient, locker *RedisLocker) *CacheManager {
	return &CacheManager{
		redis:  redis,
		locker: locker,
		local:  make(map[string]*cacheEntry),
		ttl:    5 * time.Second,
	}
}

func (c *CacheManager) GetOrCompute(ctx context.Context, key string, ttl time.Duration, compute func() (string, error)) (string, error) {
	if c.redis != nil {
		if value, err := c.redis.Get(ctx, key); err == nil {
			return value, nil
		}
	}

	c.localMu.RLock()
	if entry, exists := c.local[key]; exists && time.Now().Before(entry.expiresAt) {
		c.localMu.RUnlock()
		return entry.value, nil
	}
	c.localMu.RUnlock()

	var value string
	var err error

	if c.redis != nil && c.locker != nil {
		lockKey := fmt.Sprintf("cache_lock:%s", key)
		success, err := c.locker.TryLock(ctx, lockKey, 10*time.Second)
		if err != nil {
			logger.Error("Failed to acquire cache lock: %v", err)
			return "", errors.ErrCacheOperationFailed("acquire lock", err)
		}

		if !success {
			time.Sleep(100 * time.Millisecond)
			if c.redis != nil {
				if value, err := c.redis.Get(ctx, key); err == nil {
					return value, nil
				}
			}
			c.localMu.RLock()
			if entry, exists := c.local[key]; exists && time.Now().Before(entry.expiresAt) {
				c.localMu.RUnlock()
				return entry.value, nil
			}
			c.localMu.RUnlock()
		}

		defer c.locker.Unlock(ctx, lockKey)

		value, err = compute()
		if err != nil {
			return "", err
		}

		if err := c.redis.SetWithTTL(ctx, key, value, ttl); err != nil {
			logger.Warn("Failed to set cache: %v", err)
		}
	} else {
		c.localMu.Lock()
		if entry, exists := c.local[key]; exists && time.Now().Before(entry.expiresAt) {
			c.localMu.Unlock()
			return entry.value, nil
		}
		c.localMu.Unlock()

		value, err = compute()
		if err != nil {
			return "", err
		}
	}

	c.localMu.Lock()
	c.local[key] = &cacheEntry{
		value:     value,
		expiresAt: time.Now().Add(ttl),
	}
	c.localMu.Unlock()

	return value, nil
}

func (c *CacheManager) Set(ctx context.Context, key string, value string, ttl time.Duration) error {
	c.localMu.Lock()
	c.local[key] = &cacheEntry{
		value:     value,
		expiresAt: time.Now().Add(ttl),
	}
	c.localMu.Unlock()

	if c.redis != nil {
		if err := c.redis.SetWithTTL(ctx, key, value, ttl); err != nil {
			return errors.ErrCacheOperationFailed("set", err)
		}
	}
	return nil
}

func (c *CacheManager) Delete(ctx context.Context, key string) error {
	c.localMu.Lock()
	delete(c.local, key)
	c.localMu.Unlock()

	if c.redis != nil {
		if err := c.redis.Del(ctx, key); err != nil {
			return errors.ErrCacheOperationFailed("delete", err)
		}
	}
	return nil
}

func (c *CacheManager) Clear(ctx context.Context, pattern string) error {
	c.localMu.Lock()
	for k := range c.local {
		if len(pattern) == 0 || matchPattern(k, pattern) {
			delete(c.local, k)
		}
	}
	c.localMu.Unlock()

	if c.redis != nil {
		keys, err := c.redis.GetClient().Keys(ctx, pattern).Result()
		if err != nil {
			return errors.ErrCacheOperationFailed("clear keys", err)
		}
		if len(keys) > 0 {
			if err := c.redis.Del(ctx, keys...); err != nil {
				return errors.ErrCacheOperationFailed("clear delete", err)
			}
		}
	}
	return nil
}

func (c *CacheManager) Get(ctx context.Context, key string) (string, error) {
	c.localMu.RLock()
	if entry, exists := c.local[key]; exists && time.Now().Before(entry.expiresAt) {
		c.localMu.RUnlock()
		return entry.value, nil
	}
	c.localMu.RUnlock()

	if c.redis != nil {
		return c.redis.Get(ctx, key)
	}
	return "", fmt.Errorf("key not found: %s", key)
}

func (c *CacheManager) Exists(ctx context.Context, key string) (bool, error) {
	c.localMu.RLock()
	if entry, exists := c.local[key]; exists && time.Now().Before(entry.expiresAt) {
		c.localMu.RUnlock()
		return true, nil
	}
	c.localMu.RUnlock()

	if c.redis != nil {
		return c.redis.Exists(ctx, key)
	}
	return false, nil
}

func matchPattern(key, pattern string) bool {
	if len(pattern) == 0 {
		return true
	}
	if pattern[len(pattern)-1] == '*' {
		prefix := pattern[:len(pattern)-1]
		return len(key) >= len(prefix) && key[:len(prefix)] == prefix
	}
	return key == pattern
}

func GenerateTrackingCacheKey(trackingID string) string {
	return fmt.Sprintf("tracking:%s", trackingID)
}

func GenerateDeadLetterCacheKey(id int64) string {
	return fmt.Sprintf("deadletter:%d", id)
}

func GenerateReplayRequestCacheKey(requestID string) string {
	return fmt.Sprintf("replay:%s", requestID)
}
