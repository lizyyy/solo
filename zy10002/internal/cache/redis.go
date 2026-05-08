package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"

	"chaos-payment/internal/config"
	"chaos-payment/internal/eventbus"
	"chaos-payment/internal/models"
)

type Cache struct {
	client *redis.Client
	bus    *eventbus.EventBus
}

var (
	cacheInstance *Cache
	cacheOnce     sync.Once
)

func InitCache(cfg *config.RedisConfig, bus *eventbus.EventBus) (*Cache, error) {
	var initErr error
	cacheOnce.Do(func() {
		client := redis.NewClient(&redis.Options{
			Addr:     cfg.Addr(),
			Password: cfg.Password,
			DB:       cfg.DB,
			PoolSize: cfg.PoolSize,
		})

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := client.Ping(ctx).Err(); err != nil {
			initErr = fmt.Errorf("failed to connect to redis: %w", err)
			return
		}

		cacheInstance = &Cache{
			client: client,
			bus:    bus,
		}
	})
	return cacheInstance, initErr
}

func GetCache() *Cache {
	return cacheInstance
}

func (c *Cache) Get(ctx context.Context, key string, dest interface{}) error {
	val, err := c.client.Get(ctx, key).Result()
	if err != nil {
		c.bus.Publish(eventbus.EventTypeCacheRead, key, "cache", nil, map[string]interface{}{
			"key":   key,
			"error": err.Error(),
		}, "cache")
		return err
	}

	c.bus.Publish(eventbus.EventTypeCacheRead, key, "cache", nil, map[string]interface{}{
		"key":   key,
		"value": val,
	}, "cache")

	return json.Unmarshal([]byte(val), dest)
}

func (c *Cache) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}

	if err := c.client.Set(ctx, key, string(data), ttl).Err(); err != nil {
		return err
	}

	c.bus.Publish(eventbus.EventTypeCacheWrite, key, "cache", nil, map[string]interface{}{
		"key":        key,
		"value":      string(data),
		"expiration": ttl.String(),
	}, "cache")

	return nil
}

func (c *Cache) Del(ctx context.Context, key string) error {
	return c.client.Del(ctx, key).Err()
}

func (c *Cache) SetOrder(ctx context.Context, order *models.Order, ttl time.Duration) error {
	key := fmt.Sprintf("order:%s", order.ID)
	return c.Set(ctx, key, order, ttl)
}

func (c *Cache) GetOrder(ctx context.Context, orderID string) (*models.Order, error) {
	key := fmt.Sprintf("order:%s", orderID)
	var order models.Order
	if err := c.Get(ctx, key, &order); err != nil {
		return nil, err
	}
	return &order, nil
}

func (c *Cache) DelOrder(ctx context.Context, orderID string) error {
	key := fmt.Sprintf("order:%s", orderID)
	return c.Del(ctx, key)
}

func (c *Cache) GetRawClient() *redis.Client {
	return c.client
}
