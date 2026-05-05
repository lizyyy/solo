package ratelimit

import (
	"sync"
	"time"
)

type RateLimiter struct {
	limit   int
	window  time.Duration
	current int
	mu      sync.Mutex
	lastReset time.Time
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		limit:   limit,
		window:  window,
		current: 0,
		lastReset: time.Now(),
	}
}

func (rl *RateLimiter) Allow() bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	if now.Sub(rl.lastReset) > rl.window {
		rl.current = 0
		rl.lastReset = now
	}

	if rl.current >= rl.limit {
		return false
	}

	rl.current++
	return true
}

func (rl *RateLimiter) Remaining() int {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	if now.Sub(rl.lastReset) > rl.window {
		return rl.limit
	}

	return rl.limit - rl.current
}

func (rl *RateLimiter) Reset() {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	rl.current = 0
	rl.lastReset = time.Now()
}

type ServiceRateLimiter struct {
	limiters map[string]*RateLimiter
	mu       sync.RWMutex
}

func NewServiceRateLimiter() *ServiceRateLimiter {
	return &ServiceRateLimiter{
		limiters: make(map[string]*RateLimiter),
	}
}

func (srl *ServiceRateLimiter) Get(service string, limit int, window time.Duration) *RateLimiter {
	srl.mu.RLock()
	limiter, exists := srl.limiters[service]
	srl.mu.RUnlock()

	if exists {
		return limiter
	}

	srl.mu.Lock()
	defer srl.mu.Unlock()

	// Double check after lock
	if limiter, exists = srl.limiters[service]; exists {
		return limiter
	}

	limiter = NewRateLimiter(limit, window)
	srl.limiters[service] = limiter
	return limiter
}

func (srl *ServiceRateLimiter) Allow(service string, limit int, window time.Duration) bool {
	return srl.Get(service, limit, window).Allow()
}
