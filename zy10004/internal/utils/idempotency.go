package utils

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type IdempotencyStore struct {
	mu    sync.RWMutex
	cache map[string]*IdempotencyRecord
	ttl   time.Duration
}

type IdempotencyRecord struct {
	RequestID   string
	Response    interface{}
	ProcessedAt time.Time
	Completed   bool
}

var globalIdempotencyStore *IdempotencyStore

func InitIdempotencyStore(ttl time.Duration) {
	globalIdempotencyStore = &IdempotencyStore{
		cache: make(map[string]*IdempotencyRecord),
		ttl:   ttl,
	}
	go globalIdempotencyStore.cleanup()
}

func GetIdempotencyStore() *IdempotencyStore {
	if globalIdempotencyStore == nil {
		InitIdempotencyStore(30 * time.Minute)
	}
	return globalIdempotencyStore
}

func (s *IdempotencyStore) Get(ctx context.Context, key string) (*IdempotencyRecord, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	record, exists := s.cache[key]
	return record, exists
}

func (s *IdempotencyStore) Set(ctx context.Context, key string, response interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.cache[key] = &IdempotencyRecord{
		RequestID:   key,
		Response:    response,
		ProcessedAt: time.Now(),
		Completed:   true,
	}
	return nil
}

func (s *IdempotencyStore) Delete(ctx context.Context, key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.cache, key)
	return nil
}

func (s *IdempotencyStore) GenerateKey(service, method, requestID string) string {
	return fmt.Sprintf("%s:%s:%s", service, method, requestID)
}

func (s *IdempotencyStore) cleanup() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		s.mu.Lock()
		now := time.Now()
		for key, record := range s.cache {
			if now.Sub(record.ProcessedAt) > s.ttl {
				delete(s.cache, key)
			}
		}
		s.mu.Unlock()
	}
}
