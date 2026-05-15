package model

import (
	"time"
)

type ReleaseStatus string

const (
	StatusPending    ReleaseStatus = "PENDING"
	StatusRunning    ReleaseStatus = "RUNNING"
	StatusObserving  ReleaseStatus = "OBSERVING"
	StatusSuccess    ReleaseStatus = "SUCCESS"
	StatusRollback   ReleaseStatus = "ROLLBACK"
	StatusFailed     ReleaseStatus = "FAILED"
)

type ConfigRelease struct {
	ID           string        `json:"id"`
	ConfigName   string        `json:"config_name"`
	Version      string        `json:"version"`
	Content      string        `json:"content"`
	Status       ReleaseStatus `json:"status"`
	BaselineID   string        `json:"baseline_id"`
	ThresholdID  string        `json:"threshold_id"`
	CreatedAt    time.Time     `json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
	ObservedAt   *time.Time    `json:"observed_at,omitempty"`
	CompletedAt  *time.Time    `json:"completed_at,omitempty"`
	RollbackAt   *time.Time    `json:"rollback_at,omitempty"`
	IdempotentKey string       `json:"idempotent_key"`
}

type BaselineWindow struct {
	ID           string        `json:"id"`
	ReleaseID    string        `json:"release_id"`
	WindowStart  time.Time     `json:"window_start"`
	WindowEnd    time.Time     `json:"window_end"`
	Metrics      []MetricPoint `json:"metrics"`
	AvgValue     float64       `json:"avg_value"`
	MaxValue     float64       `json:"max_value"`
	MinValue     float64       `json:"min_value"`
	CreatedAt    time.Time     `json:"created_at"`
}

type MetricPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
	Metric    string    `json:"metric"`
}

type AnomalyThreshold struct {
	ID             string  `json:"id"`
	ReleaseID      string  `json:"release_id"`
	MetricName     string  `json:"metric_name"`
	MaxDeviation   float64 `json:"max_deviation"`
	MinThreshold   float64 `json:"min_threshold"`
	MaxThreshold   float64 `json:"max_threshold"`
	ConsecutiveCount int   `json:"consecutive_count"`
	CreatedAt      time.Time `json:"created_at"`
}

type RollbackAction struct {
	ID           string        `json:"id"`
	ReleaseID    string        `json:"release_id"`
	Reason       string        `json:"reason"`
	AnomalyData  string        `json:"anomaly_data"`
	RollbackConfig string       `json:"rollback_config"`
	ExecutedAt   time.Time     `json:"executed_at"`
	Success      bool          `json:"success"`
}

type DecisionRecord struct {
	ID           string        `json:"id"`
	ReleaseID    string        `json:"release_id"`
	DecisionType string        `json:"decision_type"`
	FromStatus   ReleaseStatus `json:"from_status"`
	ToStatus     ReleaseStatus `json:"to_status"`
	Reason       string        `json:"reason"`
	MetricsData  string        `json:"metrics_data"`
	DecidedAt    time.Time     `json:"decided_at"`
	Operator     string        `json:"operator"`
}

type ObservationResult struct {
	IsAnomaly     bool      `json:"is_anomaly"`
	AnomalyScore  float64   `json:"anomaly_score"`
	Deviation     float64   `json:"deviation"`
	CurrentValue  float64   `json:"current_value"`
	BaselineAvg   float64   `json:"baseline_avg"`
	MetricName    string    `json:"metric_name"`
	Timestamp     time.Time `json:"timestamp"`
}

type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

func (e *APIError) Error() string {
	return e.Message
}
