package models

import (
	"time"

	"gorm.io/gorm"
)

type Project struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	Name        string         `json:"name" gorm:"uniqueIndex;not null"`
	Description string         `json:"description"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`

	Routes     []Route     `json:"routes,omitempty" gorm:"foreignKey:ProjectID"`
	Runs       []Run       `json:"runs,omitempty" gorm:"foreignKey:ProjectID"`
	Baselines  []Baseline  `json:"baselines,omitempty" gorm:"foreignKey:ProjectID"`
	Samples    []Sample    `json:"samples,omitempty" gorm:"foreignKey:ProjectID"`
	ProfileEvents []ProfileEvent `json:"profile_events,omitempty" gorm:"foreignKey:ProjectID"`
}

type Route struct {
	ID           uint           `json:"id" gorm:"primaryKey"`
	ProjectID    uint           `json:"project_id" gorm:"index;not null"`
	Method       string         `json:"method" gorm:"not null"`
	Path         string         `json:"path" gorm:"not null"`
	Description  string         `json:"description"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `json:"-" gorm:"index"`

	PerformanceBudget PerformanceBudget `json:"performance_budget" gorm:"embedded"`
}

type PerformanceBudget struct {
	P95MaxMs        float64 `json:"p95_max_ms"`
	P99MaxMs        float64 `json:"p99_max_ms"`
	ErrorRateMax    float64 `json:"error_rate_max"`
	TimeoutRateMax  float64 `json:"timeout_rate_max"`
	ThroughputMin   float64 `json:"throughput_min"`
}

type Sample struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	ProjectID   uint           `json:"project_id" gorm:"index;not null"`
	Method      string         `json:"method" gorm:"not null"`
	Path        string         `json:"path" gorm:"not null"`
	QueryParams string         `json:"query_params"`
	RequestBody string         `json:"request_body"`
	Weight      float64        `json:"weight"`
	Tags        string         `json:"tags"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
}

type Baseline struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	ProjectID   uint           `json:"project_id" gorm:"index;not null"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	IsActive    bool           `json:"is_active" gorm:"default:false"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`

	Metrics BaselineMetrics `json:"metrics" gorm:"embedded"`
}

type BaselineMetrics struct {
	P50Ms           float64 `json:"p50_ms"`
	P95Ms           float64 `json:"p95_ms"`
	P99Ms           float64 `json:"p99_ms"`
	Throughput      float64 `json:"throughput"`
	ErrorRate       float64 `json:"error_rate"`
	TimeoutRate     float64 `json:"timeout_rate"`
	AvgResponseSize int64   `json:"avg_response_size"`
}

type ProfileEvent struct {
	ID             uint           `json:"id" gorm:"primaryKey"`
	ProjectID      uint           `json:"project_id" gorm:"index;not null"`
	RunID          uint           `json:"run_id" gorm:"index"`
	EventType      string         `json:"event_type" gorm:"not null"`
	Category       string         `json:"category"`
	Description    string         `json:"description"`
	DurationMs     float64        `json:"duration_ms"`
	StartTimestamp time.Time      `json:"start_timestamp"`
	Tags           string         `json:"tags"`
	Metadata       string         `json:"metadata"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `json:"-" gorm:"index"`
}

type Run struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	ProjectID   uint           `json:"project_id" gorm:"index;not null"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Status      string         `json:"status" gorm:"default:pending"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	StartedAt   *time.Time     `json:"started_at"`
	EndedAt     *time.Time     `json:"ended_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`

	Config  RunConfig   `json:"config" gorm:"embedded"`
	Metrics RunMetrics  `json:"metrics" gorm:"embedded"`
}

type RunConfig struct {
	Concurrency    int       `json:"concurrency"`
	TargetRPS      float64   `json:"target_rps"`
	TimeoutMs      int       `json:"timeout_ms"`
	DurationSeconds int      `json:"duration_seconds"`
	TotalRequests  int       `json:"total_requests"`
	UseWeighted    bool      `json:"use_weighted"`
}

type RunMetrics struct {
	TotalRequests   int64   `json:"total_requests"`
	SuccessfulRequests int64 `json:"successful_requests"`
	FailedRequests  int64   `json:"failed_requests"`
	TimeoutRequests int64   `json:"timeout_requests"`
	Throughput      float64 `json:"throughput"`
	P50Ms           float64 `json:"p50_ms"`
	P95Ms           float64 `json:"p95_ms"`
	P99Ms           float64 `json:"p99_ms"`
	ErrorRate       float64 `json:"error_rate"`
	TimeoutRate     float64 `json:"timeout_rate"`
	AvgResponseSize int64   `json:"avg_response_size"`
}

type RunComparison struct {
	ID              uint           `json:"id" gorm:"primaryKey"`
	RunID           uint           `json:"run_id" gorm:"index;not null"`
	BaselineID      uint           `json:"baseline_id" gorm:"index;not null"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `json:"-" gorm:"index"`

	MetricsComparison MetricsComparison `json:"metrics_comparison" gorm:"embedded"`
}

type MetricsComparison struct {
	P50DiffMs           float64 `json:"p50_diff_ms"`
	P50DiffPercent      float64 `json:"p50_diff_percent"`
	P95DiffMs           float64 `json:"p95_diff_ms"`
	P95DiffPercent      float64 `json:"p95_diff_percent"`
	P99DiffMs           float64 `json:"p99_diff_ms"`
	P99DiffPercent      float64 `json:"p99_diff_percent"`
	ThroughputDiff      float64 `json:"throughput_diff"`
	ThroughputDiffPercent float64 `json:"throughput_diff_percent"`
	ErrorRateDiff       float64 `json:"error_rate_diff"`
	TimeoutRateDiff     float64 `json:"timeout_rate_diff"`
	HasRegression       bool    `json:"has_regression"`
}

type SlowPathAttribution struct {
	ID              uint           `json:"id" gorm:"primaryKey"`
	RunID           uint           `json:"run_id" gorm:"index;not null"`
	Category        string         `json:"category"`
	Severity        string         `json:"severity"`
	Description     string         `json:"description"`
	ImpactScore     float64        `json:"impact_score"`
	Priority        int            `json:"priority"`
	Recommendation  string         `json:"recommendation"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `json:"-" gorm:"index"`

	Metrics AttributionMetrics `json:"metrics" gorm:"embedded"`
}

type AttributionMetrics struct {
	TotalTimeMs        float64 `json:"total_time_ms"`
	PercentageOfTotal  float64 `json:"percentage_of_total"`
	Count              int     `json:"count"`
	AvgTimeMs          float64 `json:"avg_time_ms"`
	MaxTimeMs          float64 `json:"max_time_ms"`
}

type Report struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	RunID       uint           `json:"run_id" gorm:"index;not null"`
	Format      string         `json:"format"`
	Content     string         `json:"content"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
}

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Message string      `json:"message,omitempty"`
}

const (
	RunStatusPending   = "pending"
	RunStatusRunning   = "running"
	RunStatusCompleted = "completed"
	RunStatusFailed    = "failed"
	RunStatusStopped   = "stopped"

	EventCategorySQL          = "sql"
	EventCategoryCache        = "cache"
	EventCategoryDownstream   = "downstream"
	EventCategorySerialization = "serialization"
	EventCategoryResponseSize = "response_size"
	EventCategoryConnectionPool = "connection_pool"

	SeverityCritical = "critical"
	SeverityHigh     = "high"
	SeverityMedium   = "medium"
	SeverityLow      = "low"
)
