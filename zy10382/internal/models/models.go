package models

import (
	"time"
)

type CustomerEnvironment struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	CustomerID  string    `json:"customer_id" gorm:"index;not null"`
	Name        string    `json:"name" gorm:"not null"`
	Description string    `json:"description"`
	Region      string    `json:"region"`
	CreatedAt   time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

type ProbeTask struct {
	ID             string    `json:"id" gorm:"primaryKey"`
	IdempotencyKey string    `json:"idempotency_key" gorm:"uniqueIndex;not null"`
	EnvID          string    `json:"env_id" gorm:"index;not null"`
	TaskType       string    `json:"task_type" gorm:"not null"`
	TargetURL      string    `json:"target_url"`
	Status         string    `json:"status" gorm:"index;not null"`
	Priority       int       `json:"priority"`
	TimeoutSeconds int       `json:"timeout_seconds"`
	RetryCount     int       `json:"retry_count"`
	MaxRetries     int       `json:"max_retries"`
	AssignedAgent  string    `json:"assigned_agent"`
	ErrorMsg       string    `json:"error_msg"`
	CreatedAt      time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt      time.Time `json:"updated_at" gorm:"autoUpdateTime"`
	StartedAt      time.Time `json:"started_at"`
	CompletedAt    time.Time `json:"completed_at"`
}

type NetworkResult struct {
	ID              string    `json:"id" gorm:"primaryKey"`
	TaskID          string    `json:"task_id" gorm:"index;not null"`
	Success         bool      `json:"success"`
	HTTPStatusCode  int       `json:"http_status_code"`
	ResponseTimeMs  int64     `json:"response_time_ms"`
	ResponseSize    int64     `json:"response_size"`
	ErrorMessage    string    `json:"error_message"`
	RawResponse     string    `json:"raw_response"`
	RequestHeaders  string    `json:"request_headers"`
	ResponseHeaders string    `json:"response_headers"`
	CreatedAt       time.Time `json:"created_at" gorm:"autoCreateTime"`
}

type DNSRecord struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	TaskID      string    `json:"task_id" gorm:"index;not null"`
	Domain      string    `json:"domain" gorm:"index;not null"`
	RecordType  string    `json:"record_type"`
	Values      string    `json:"values"`
	TTL         int       `json:"ttl"`
	ResolveTime int64     `json:"resolve_time_ms"`
	ErrorMsg    string    `json:"error_msg"`
	CreatedAt   time.Time `json:"created_at" gorm:"autoCreateTime"`
}

type ProxySetting struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	EnvID     string    `json:"env_id" gorm:"index;not null"`
	Type      string    `json:"type"`
	Host      string    `json:"host"`
	Port      int       `json:"port"`
	Username  string    `json:"username"`
	Password  string    `json:"password"`
	IsEnabled bool      `json:"is_enabled"`
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

type DiagnosisConclusion struct {
	ID            string    `json:"id" gorm:"primaryKey"`
	TaskID        string    `json:"task_id" gorm:"uniqueIndex;not null"`
	Conclusion    string    `json:"conclusion"`
	Severity      string    `json:"severity"`
	RootCause     string    `json:"root_cause"`
	Suggestions   string    `json:"suggestions"`
	AffectedAreas string    `json:"affected_areas"`
	CreatedAt     time.Time `json:"created_at" gorm:"autoCreateTime"`
	GeneratedBy   string    `json:"generated_by"`
}

const (
	TaskStatusPending   = "pending"
	TaskStatusAssigned  = "assigned"
	TaskStatusRunning   = "running"
	TaskStatusCompleted = "completed"
	TaskStatusFailed    = "failed"
	TaskStatusTimeout   = "timeout"

	SeverityCritical = "critical"
	SeverityHigh     = "high"
	SeverityMedium   = "medium"
	SeverityLow      = "low"
)
