package utils

import (
	"context"
	"sync"
	"time"
)

type DistributedLocker interface {
	TryLock(ctx context.Context, key string, ttl time.Duration) (bool, error)
	Unlock(ctx context.Context, key string) error
	Lock(ctx context.Context, key string, ttl time.Duration) error
}

type LocalLocker struct {
	mu      sync.RWMutex
	entries map[string]struct{}
}

func NewLocalLocker() *LocalLocker {
	return &LocalLocker{
		entries: make(map[string]struct{}),
	}
}

func (l *LocalLocker) TryLock(ctx context.Context, key string, ttl time.Duration) (bool, error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	if _, exists := l.entries[key]; exists {
		return false, nil
	}

	l.entries[key] = struct{}{}

	if ttl > 0 {
		go func() {
			select {
			case <-ctx.Done():
				l.mu.Lock()
				delete(l.entries, key)
				l.mu.Unlock()
			case <-time.After(ttl):
				l.mu.Lock()
				delete(l.entries, key)
				l.mu.Unlock()
			}
		}()
	}

	return true, nil
}

func (l *LocalLocker) Lock(ctx context.Context, key string, ttl time.Duration) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			success, err := l.TryLock(ctx, key, ttl)
			if err != nil {
				return err
			}
			if success {
				return nil
			}
			time.Sleep(10 * time.Millisecond)
		}
	}
}

func (l *LocalLocker) Unlock(ctx context.Context, key string) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	delete(l.entries, key)
	return nil
}

type NoopLocker struct{}

func NewNoopLocker() *NoopLocker {
	return &NoopLocker{}
}

func (n *NoopLocker) TryLock(ctx context.Context, key string, ttl time.Duration) (bool, error) {
	return true, nil
}

func (n *NoopLocker) Unlock(ctx context.Context, key string) error {
	return nil
}

func (n *NoopLocker) Lock(ctx context.Context, key string, ttl time.Duration) error {
	return nil
}
