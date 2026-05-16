package models

import (
	"time"
)

type ReleaseStatus string

const (
	StatusPending    ReleaseStatus = "PENDING"
	StatusEvaluating ReleaseStatus = "EVALUATING"
	StatusApproved   ReleaseStatus = "APPROVED"
	StatusRollback   ReleaseStatus = "ROLLBACK"
	StatusManual     ReleaseStatus = "MANUAL_OVERRIDE"
)

type MetricType string

const (
	MetricTypeErrorRate MetricType = "ERROR_RATE"
	MetricTypeLatency   MetricType = "LATENCY"
	MetricTypeThroughput MetricType = "THROUGHPUT"
	MetricTypeSuccessRate MetricType = "SUCCESS_RATE"
)

type ThresholdOperator string

const (
	OpGreaterThan ThresholdOperator = "GT"
	OpLessThan    ThresholdOperator = "LT"
	OpGreaterEqual ThresholdOperator = "GTE"
	OpLessEqual   ThresholdOperator = "LTE"
	OpEqual       ThresholdOperator = "EQ"
)

type ReleaseBatch struct {
	ID          string        `json:"id" gorm:"primaryKey"`
	Name        string        `json:"name"`
	Version     string        `json:"version"`
	Description string        `json:"description"`
	Status      ReleaseStatus `json:"status"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
	CreatedBy   string        `json:"created_by"`
}

type CoreMetric struct {
	ID          string     `json:"id" gorm:"primaryKey"`
	BatchID     string     `json:"batch_id"`
	Name        string     `json:"name"`
	MetricType  MetricType `json:"metric_type"`
	Value       float64    `json:"value"`
	Baseline    float64    `json:"baseline"`
	CollectedAt time.Time  `json:"collected_at"`
	RawData     string     `json:"raw_data"`
}

type AuxiliaryMetric struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	BatchID     string    `json:"batch_id"`
	Name        string    `json:"name"`
	Value       float64   `json:"value"`
	Description string    `json:"description"`
	CollectedAt time.Time `json:"collected_at"`
}

type ThresholdRule struct {
	ID          string            `json:"id" gorm:"primaryKey"`
	BatchID     string            `json:"batch_id"`
	MetricName  string            `json:"metric_name"`
	MetricType  MetricType        `json:"metric_type"`
	Operator    ThresholdOperator `json:"operator"`
	Threshold   float64           `json:"threshold"`
	Severity    string            `json:"severity"`
	Description string            `json:"description"`
	CreatedAt   time.Time         `json:"created_at"`
}

type DecisionRecord struct {
	ID            string        `json:"id" gorm:"primaryKey"`
	BatchID       string        `json:"batch_id"`
	Status        ReleaseStatus `json:"status"`
	DecisionType  string        `json:"decision_type"`
	Reason        string        `json:"reason"`
	RawInput      string        `json:"raw_input"`
	Conclusion    string        `json:"conclusion"`
	ViolatedRules string        `json:"violated_rules"`
	DecidedBy     string        `json:"decided_by"`
	DecidedAt     time.Time     `json:"decided_at"`
}

type RollbackSummary struct {
	ID            string    `json:"id" gorm:"primaryKey"`
	BatchID       string    `json:"batch_id"`
	SummaryText   string    `json:"summary_text"`
	MetricsData   string    `json:"metrics_data"`
	DecisionData  string    `json:"decision_data"`
	ExportedAt    time.Time  `json:"exported_at"`
	ExportedBy    string    `json:"exported_by"`
}
