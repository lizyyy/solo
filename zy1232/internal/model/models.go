package model

import (
	"time"
)

type ServiceInstance struct {
	ID        string            `json:"id"`
	Service   string            `json:"service"`
	Address   string            `json:"address"`
	Port      int               `json:"port"`
	Status    string            `json:"status"`
	Metadata  map[string]string `json:"metadata"`
	CreatedAt time.Time         `json:"created_at"`
	UpdatedAt time.Time         `json:"updated_at"`
}

type Service struct {
	Name        string            `json:"name"`
	Instances   []ServiceInstance `json:"instances"`
	Healthy     int               `json:"healthy"`
	Unhealthy   int               `json:"unhealthy"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

type Config struct {
	Version   string                 `json:"version"`
	Data      map[string]interface{} `json:"data"`
	CreatedAt time.Time              `json:"created_at"`
}

type RequestLog struct {
	TraceID    string                 `json:"trace_id"`
	Service    string                 `json:"service"`
	Endpoint   string                 `json:"endpoint"`
	Method     string                 `json:"method"`
	StatusCode int                    `json:"status_code"`
	Duration   time.Duration          `json:"duration"`
	Request    map[string]interface{} `json:"request,omitempty"`
	Response   map[string]interface{} `json:"response,omitempty"`
	Error      string                 `json:"error,omitempty"`
	CreatedAt  time.Time              `json:"created_at"`
}

type CircuitBreakerState struct {
	Service     string    `json:"service"`
	State       string    `json:"state"`
	Failures    int       `json:"failures"`
	Successes   int       `json:"successes"`
	LastFailure time.Time `json:"last_failure"`
	LastSuccess time.Time `json:"last_success"`
	Threshold   int       `json:"threshold"`
	Timeout     time.Duration `json:"timeout"`
}

type RateLimitConfig struct {
	Service     string `json:"service"`
	Limit       int    `json:"limit"`
	Window      time.Duration `json:"window"`
	Current     int    `json:"current"`
	LastReset   time.Time `json:"last_reset"`
}

type RoutingDecision struct {
	TraceID       string            `json:"trace_id"`
	Service       string            `json:"service"`
	Endpoint      string            `json:"endpoint"`
	Method        string            `json:"method"`
	InstanceID    string            `json:"instance_id,omitempty"`
	Decision      string            `json:"decision"`
	Reason        string            `json:"reason"`
	Error         string            `json:"error,omitempty"`
	Timestamp     time.Time         `json:"timestamp"`
}
