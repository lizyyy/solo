package model

import (
	"time"
)

type Tenant struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type TrafficSample struct {
	ID             string    `json:"id" gorm:"primaryKey"`
	TenantID       string    `json:"tenant_id"`
	RequestID      string    `json:"request_id"`
	Method         string    `json:"method"`
	URL            string    `json:"url"`
	Headers        string    `json:"headers"`
	Body           string    `json:"body"`
	Timestamp      time.Time `json:"timestamp"`
	Source         string    `json:"source"`
	IdempotencyKey string    `json:"idempotency_key" gorm:"uniqueIndex"`
	CreatedAt      time.Time `json:"created_at"`
}

type ThrottleRule struct {
	ID               string    `json:"id" gorm:"primaryKey"`
	TenantID         string    `json:"tenant_id"`
	Name             string    `json:"name"`
	MaxRequests      int       `json:"max_requests"`
	WindowSeconds    int       `json:"window_seconds"`
	MaxConcurrency   int       `json:"max_concurrency"`
	ErrorThreshold   float64   `json:"error_threshold"`
	BackoffMultiplier float64  `json:"backoff_multiplier"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type ReplayPlan struct {
	ID             string    `json:"id" gorm:"primaryKey"`
	TenantID       string    `json:"tenant_id"`
	RuleID         string    `json:"rule_id"`
	Name           string    `json:"name"`
	Status         string    `json:"status"`
	SampleCount    int       `json:"sample_count"`
	ProcessedCount int       `json:"processed_count"`
	SuccessCount   int       `json:"success_count"`
	ErrorCount     int       `json:"error_count"`
	StartTime      *time.Time `json:"start_time"`
	EndTime        *time.Time `json:"end_time"`
	IdempotencyKey string    `json:"idempotency_key" gorm:"uniqueIndex"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type PausePoint struct {
	ID         string    `json:"id" gorm:"primaryKey"`
	PlanID     string    `json:"plan_id"`
	Reason     string    `json:"reason"`
	PausedAt   time.Time `json:"paused_at"`
	ResumedAt  *time.Time `json:"resumed_at"`
	PausedBy   string    `json:"paused_by"`
	CreatedAt  time.Time `json:"created_at"`
}

type ReplayResult struct {
	ID             string    `json:"id" gorm:"primaryKey"`
	PlanID         string    `json:"plan_id"`
	SampleID       string    `json:"sample_id"`
	Status         string    `json:"status"`
	HTTPStatus     int       `json:"http_status"`
	ResponseBody   string    `json:"response_body"`
	ErrorCategory  string    `json:"error_category"`
	ErrorMessage   string    `json:"error_message"`
	DurationMs     int64     `json:"duration_ms"`
	StartedAt      time.Time `json:"started_at"`
	FinishedAt     time.Time `json:"finished_at"`
	IdempotencyKey string    `json:"idempotency_key" gorm:"uniqueIndex"`
	CreatedAt      time.Time `json:"created_at"`
}

type IdempotencyRecord struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	Key       string    `json:"key" gorm:"uniqueIndex"`
	Resource  string    `json:"resource"`
	Result    string    `json:"result"`
	CreatedAt time.Time `json:"created_at"`
}

const (
	PlanStatusPending   = "pending"
	PlanStatusRunning   = "running"
	PlanStatusPaused    = "paused"
	PlanStatusCompleted = "completed"
	PlanStatusFailed    = "failed"

	ResultStatusSuccess = "success"
	ResultStatusFailed  = "failed"

	ErrorCategoryNetwork    = "network"
	ErrorCategoryTimeout    = "timeout"
	ErrorCategoryHTTP       = "http_error"
	ErrorCategoryValidation = "validation"
	ErrorCategoryUnknown    = "unknown"
)
