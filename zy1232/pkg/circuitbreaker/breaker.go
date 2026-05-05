package circuitbreaker

import (
	"sync"
	"time"
)

type State string

const (
	StateClosed    State = "closed"
	StateOpen      State = "open"
	StateHalfOpen  State = "half-open"
)

type CircuitBreaker struct {
	service     string
	state       State
	failures    int
	successes   int
	threshold   int
	timeout     time.Duration
	lastFailure time.Time
	lastSuccess time.Time
	mu          sync.Mutex
}

type Config struct {
	Service   string
	Threshold int
	Timeout   time.Duration
}

func NewCircuitBreaker(cfg Config) *CircuitBreaker {
	return &CircuitBreaker{
		service:   cfg.Service,
		state:     StateClosed,
		threshold: cfg.Threshold,
		timeout:   cfg.Timeout,
	}
}

func (cb *CircuitBreaker) Allow() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case StateOpen:
		if time.Since(cb.lastFailure) > cb.timeout {
			cb.state = StateHalfOpen
			cb.successes = 0
			return true
		}
		return false

	case StateHalfOpen:
		return true

	case StateClosed:
		return true

	default:
		return true
	}
}

func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.successes++
	cb.lastSuccess = time.Now()

	if cb.state == StateHalfOpen {
		if cb.successes >= 1 {
			cb.state = StateClosed
			cb.failures = 0
			cb.successes = 0
		}
	}
}

func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failures++
	cb.lastFailure = time.Now()

	if cb.state == StateClosed {
		if cb.failures >= cb.threshold {
			cb.state = StateOpen
		}
	} else if cb.state == StateHalfOpen {
		cb.state = StateOpen
		cb.successes = 0
	}
}

func (cb *CircuitBreaker) State() State {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	return cb.state
}

func (cb *CircuitBreaker) Stats() (State, int, int) {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	return cb.state, cb.failures, cb.successes
}

func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.state = StateClosed
	cb.failures = 0
	cb.successes = 0
}

type ServiceCircuitBreaker struct {
	breakers  map[string]*CircuitBreaker
	threshold int
	timeout   time.Duration
	mu        sync.RWMutex
}

func NewServiceCircuitBreaker(threshold int, timeout time.Duration) *ServiceCircuitBreaker {
	return &ServiceCircuitBreaker{
		breakers:  make(map[string]*CircuitBreaker),
		threshold: threshold,
		timeout:   timeout,
	}
}

func (scb *ServiceCircuitBreaker) Get(service string) *CircuitBreaker {
	scb.mu.RLock()
	breaker, exists := scb.breakers[service]
	scb.mu.RUnlock()

	if exists {
		return breaker
	}

	scb.mu.Lock()
	defer scb.mu.Unlock()

	if breaker, exists = scb.breakers[service]; exists {
		return breaker
	}

	breaker = NewCircuitBreaker(Config{
		Service:   service,
		Threshold: scb.threshold,
		Timeout:   scb.timeout,
	})
	scb.breakers[service] = breaker
	return breaker
}

func (scb *ServiceCircuitBreaker) All() map[string]*CircuitBreaker {
	scb.mu.RLock()
	defer scb.mu.RUnlock()

	result := make(map[string]*CircuitBreaker)
	for k, v := range scb.breakers {
		result[k] = v
	}
	return result
}
