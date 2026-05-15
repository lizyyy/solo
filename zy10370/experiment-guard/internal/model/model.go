package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ExperimentStatus string

const (
	StatusDraft     ExperimentStatus = "draft"
	StatusRunning   ExperimentStatus = "running"
	StatusPaused    ExperimentStatus = "paused"
	StatusRollback  ExperimentStatus = "rollback"
	StatusCompleted ExperimentStatus = "completed"
)

type ThresholdOperator string

const (
	OpGreaterThan      ThresholdOperator = "gt"
	OpLessThan         ThresholdOperator = "lt"
	OpGreaterThanEqual ThresholdOperator = "gte"
	OpLessThanEqual    ThresholdOperator = "lte"
	OpEqual            ThresholdOperator = "eq"
)

type Experiment struct {
	ID          string           `gorm:"primaryKey" json:"id"`
	Name        string           `gorm:"not null" json:"name"`
	Description string           `json:"description"`
	Status      ExperimentStatus `gorm:"not null;default:draft" json:"status"`
	TrafficRate float64          `gorm:"not null;default:0" json:"traffic_rate"`
	BucketKey   string           `gorm:"not null" json:"bucket_key"`
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
	StartedAt   *time.Time       `json:"started_at,omitempty"`
	EndedAt     *time.Time       `json:"ended_at,omitempty"`

	Thresholds  []Threshold  `gorm:"foreignKey:ExperimentID" json:"thresholds,omitempty"`
	Metrics     []Metric     `gorm:"foreignKey:ExperimentID" json:"metrics,omitempty"`
	PauseLogs   []PauseLog   `gorm:"foreignKey:ExperimentID" json:"pause_logs,omitempty"`
	RollbackLog *RollbackLog `gorm:"foreignKey:ExperimentID" json:"rollback_log,omitempty"`
}

func (e *Experiment) BeforeCreate(tx *gorm.DB) error {
	if e.ID == "" {
		e.ID = uuid.New().String()
	}
	return nil
}

type Threshold struct {
	ID           string            `gorm:"primaryKey" json:"id"`
	ExperimentID string            `gorm:"index;not null" json:"experiment_id"`
	MetricName   string            `gorm:"not null" json:"metric_name"`
	Operator     ThresholdOperator `gorm:"not null" json:"operator"`
	Value        float64           `gorm:"not null" json:"value"`
	WindowSize   int               `gorm:"not null;default:1" json:"window_size"`
	TriggerCount int               `gorm:"not null;default:1" json:"trigger_count"`
	CreatedAt    time.Time         `json:"created_at"`
}

func (t *Threshold) BeforeCreate(tx *gorm.DB) error {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	return nil
}

type Metric struct {
	ID           string    `gorm:"primaryKey" json:"id"`
	ExperimentID string    `gorm:"index;not null" json:"experiment_id"`
	RequestID    string    `gorm:"index;not null" json:"request_id"`
	UserID       string    `gorm:"index" json:"user_id,omitempty"`
	Name         string    `gorm:"not null" json:"name"`
	Value        float64   `gorm:"not null" json:"value"`
	Timestamp    time.Time `gorm:"index;not null" json:"timestamp"`
	Tags         string    `json:"tags,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

func (m *Metric) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

type PauseLog struct {
	ID              string    `gorm:"primaryKey" json:"id"`
	ExperimentID    string    `gorm:"index;not null" json:"experiment_id"`
	TriggeredBy     string    `gorm:"not null" json:"triggered_by"`
	Reason          string    `json:"reason"`
	ThresholdID     *string   `json:"threshold_id,omitempty"`
	MetricName      string    `json:"metric_name,omitempty"`
	MetricValue     float64   `json:"metric_value,omitempty"`
	ThresholdValue  float64   `json:"threshold_value,omitempty"`
	ThresholdOperator string  `json:"threshold_operator,omitempty"`
	PausedAt        time.Time `json:"paused_at"`
	CreatedAt       time.Time `json:"created_at"`
}

func (p *PauseLog) BeforeCreate(tx *gorm.DB) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	return nil
}

type RollbackLog struct {
	ID            string    `gorm:"primaryKey" json:"id"`
	ExperimentID  string    `gorm:"index;unique;not null" json:"experiment_id"`
	ConfirmedBy   string    `gorm:"not null" json:"confirmed_by"`
	Reason        string    `json:"reason"`
	RollbackAt    time.Time `json:"rollback_at"`
	CreatedAt     time.Time `json:"created_at"`
}

func (r *RollbackLog) BeforeCreate(tx *gorm.DB) error {
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	return nil
}

type BucketAssignment struct {
	ID           string    `gorm:"primaryKey" json:"id"`
	ExperimentID string    `gorm:"index;not null" json:"experiment_id"`
	UserID       string    `gorm:"index;not null" json:"user_id"`
	InExperiment bool      `gorm:"not null" json:"in_experiment"`
	BucketHash   uint32    `json:"bucket_hash"`
	CreatedAt    time.Time `json:"created_at"`
}

func (b *BucketAssignment) BeforeCreate(tx *gorm.DB) error {
	if b.ID == "" {
		b.ID = uuid.New().String()
	}
	return nil
}
