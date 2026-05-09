package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"

	"mq-deadletter-review/pkg/logger"
	"mq-deadletter-review/pkg/utils"
)

type RedisLocker struct {
	client *redis.Client
}

func NewRedisLocker(redisClient *redis.Client) *RedisLocker {
	return &RedisLocker{client: redisClient}
}

func (r *RedisLocker) TryLock(ctx context.Context, key string, ttl time.Duration) (bool, error) {
	lockKey := fmt.Sprintf("lock:%s", key)
	lockValue := utils.GenerateID()

	success, err := r.client.SetNX(ctx, lockKey, lockValue, ttl).Result()
	if err != nil {
		return false, err
	}

	if success {
		logger.Debug("Acquired lock: %s", key)
	}

	return success, nil
}

func (r *RedisLocker) Unlock(ctx context.Context, key string) error {
	lockKey := fmt.Sprintf("lock:%s", key)
	err := r.client.Del(ctx, lockKey).Err()
	if err != nil {
		return err
	}
	logger.Debug("Released lock: %s", key)
	return nil
}

func (r *RedisLocker) Lock(ctx context.Context, key string, ttl time.Duration) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			success, err := r.TryLock(ctx, key, ttl)
			if err != nil {
				return err
			}
			if success {
				return nil
			}
			time.Sleep(50 * time.Millisecond)
		}
	}
}

func (r *RedisLocker) RunWithLock(ctx context.Context, key string, ttl time.Duration, fn func() error) error {
	success, err := r.TryLock(ctx, key, ttl)
	if err != nil {
		return err
	}
	if !success {
		return fmt.Errorf("failed to acquire lock: %s", key)
	}
	defer r.Unlock(ctx, key)
	return fn()
}
