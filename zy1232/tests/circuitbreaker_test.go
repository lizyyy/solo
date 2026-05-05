package tests

import (
	"testing"
	"time"

	"github.com/zy1232/microservice-framework/pkg/circuitbreaker"
)

func TestCircuitBreaker_InitialState(t *testing.T) {
	cb := circuitbreaker.NewCircuitBreaker(circuitbreaker.Config{
		Service:   "test-service",
		Threshold: 3,
		Timeout:   1 * time.Second,
	})

	if cb.State() != circuitbreaker.StateClosed {
		t.Errorf("Expected initial state to be Closed, got: %s", cb.State())
	}

	if !cb.Allow() {
		t.Error("Expected Allow() to return true for closed circuit")
	}
}

func TestCircuitBreaker_OpensOnFailures(t *testing.T) {
	cb := circuitbreaker.NewCircuitBreaker(circuitbreaker.Config{
		Service:   "test-service",
		Threshold: 2,
		Timeout:   1 * time.Second,
	})

	cb.RecordFailure()
	cb.RecordFailure()

	if cb.State() != circuitbreaker.StateOpen {
		t.Errorf("Expected state to be Open after 2 failures, got: %s", cb.State())
	}

	if cb.Allow() {
		t.Error("Expected Allow() to return false for open circuit")
	}
}

func TestCircuitBreaker_HalfOpenAfterTimeout(t *testing.T) {
	cb := circuitbreaker.NewCircuitBreaker(circuitbreaker.Config{
		Service:   "test-service",
		Threshold: 2,
		Timeout:   100 * time.Millisecond,
	})

	cb.RecordFailure()
	cb.RecordFailure()

	if cb.State() != circuitbreaker.StateOpen {
		t.Errorf("Expected state to be Open, got: %s", cb.State())
	}

	time.Sleep(150 * time.Millisecond)

	if !cb.Allow() {
		t.Error("Expected Allow() to return true after timeout (should transition to half-open)")
	}

	if cb.State() != circuitbreaker.StateHalfOpen {
		t.Errorf("Expected state to be HalfOpen, got: %s", cb.State())
	}
}

func TestCircuitBreaker_ClosesOnSuccess(t *testing.T) {
	cb := circuitbreaker.NewCircuitBreaker(circuitbreaker.Config{
		Service:   "test-service",
		Threshold: 2,
		Timeout:   100 * time.Millisecond,
	})

	cb.RecordFailure()
	cb.RecordFailure()
	time.Sleep(150 * time.Millisecond)

	cb.Allow()

	if cb.State() != circuitbreaker.StateHalfOpen {
		t.Errorf("Expected state to be HalfOpen, got: %s", cb.State())
	}

	cb.RecordSuccess()

	if cb.State() != circuitbreaker.StateClosed {
		t.Errorf("Expected state to be Closed after success in half-open, got: %s", cb.State())
	}
}

func TestCircuitBreaker_OpensOnFailureInHalfOpen(t *testing.T) {
	cb := circuitbreaker.NewCircuitBreaker(circuitbreaker.Config{
		Service:   "test-service",
		Threshold: 2,
		Timeout:   100 * time.Millisecond,
	})

	cb.RecordFailure()
	cb.RecordFailure()
	time.Sleep(150 * time.Millisecond)

	cb.Allow()

	if cb.State() != circuitbreaker.StateHalfOpen {
		t.Errorf("Expected state to be HalfOpen, got: %s", cb.State())
	}

	cb.RecordFailure()

	if cb.State() != circuitbreaker.StateOpen {
		t.Errorf("Expected state to be Open after failure in half-open, got: %s", cb.State())
	}
}

func TestCircuitBreaker_Reset(t *testing.T) {
	cb := circuitbreaker.NewCircuitBreaker(circuitbreaker.Config{
		Service:   "test-service",
		Threshold: 2,
		Timeout:   1 * time.Second,
	})

	cb.RecordFailure()
	cb.RecordFailure()

	if cb.State() != circuitbreaker.StateOpen {
		t.Errorf("Expected state to be Open, got: %s", cb.State())
	}

	cb.Reset()

	if cb.State() != circuitbreaker.StateClosed {
		t.Errorf("Expected state to be Closed after reset, got: %s", cb.State())
	}

	if !cb.Allow() {
		t.Error("Expected Allow() to return true after reset")
	}
}

func TestServiceCircuitBreaker_Get(t *testing.T) {
	scb := circuitbreaker.NewServiceCircuitBreaker(3, 30*time.Second)

	cb1 := scb.Get("service1")
	if cb1 == nil {
		t.Error("Expected Get() to create a new circuit breaker")
	}

	cb2 := scb.Get("service1")
	if cb1 != cb2 {
		t.Error("Expected Get() to return same instance for same service")
	}

	cb3 := scb.Get("service2")
	if cb1 == cb3 {
		t.Error("Expected different instances for different services")
	}
}

func TestServiceCircuitBreaker_All(t *testing.T) {
	scb := circuitbreaker.NewServiceCircuitBreaker(3, 30*time.Second)

	all := scb.All()
	if len(all) != 0 {
		t.Errorf("Expected 0 breakers initially, got: %d", len(all))
	}

	scb.Get("service1")
	scb.Get("service2")

	all = scb.All()
	if len(all) != 2 {
		t.Errorf("Expected 2 breakers, got: %d", len(all))
	}
}
