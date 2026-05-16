package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TaskStatus string

const (
	StatusPending     TaskStatus = "PENDING"
	StatusDetected    TaskStatus = "DETECTED"
	StatusAnalyzing   TaskStatus = "ANALYZING"
	StatusRecovering  TaskStatus = "RECOVERING"
	StatusCompleted   TaskStatus = "COMPLETED"
	StatusFailed      TaskStatus = "FAILED"
	StatusManualFix   TaskStatus = "MANUAL_FIX"
	StatusCancelled   TaskStatus = "CANCELLED"
)

type RecoveryAction string

const (
	ActionRetry         RecoveryAction = "RETRY"
	ActionSkip          RecoveryAction = "SKIP"
	ActionManual        RecoveryAction = "MANUAL"
	ActionRollback      RecoveryAction = "ROLLBACK"
)

type MissReason string

const (
	ReasonSchedulerDown MissReason = "SCHEDULER_DOWN"
	ReasonTimeout       MissReason = "TIMEOUT"
	ReasonDependency    MissReason = "DEPENDENCY_FAILED"
	ReasonResource      MissReason = "RESOURCE_LIMIT"
	ReasonUnknown       MissReason = "UNKNOWN"
)

type TaskRecovery struct {
	ID              string         `gorm:"primaryKey;type:varchar(36)" json:"id"`
	TaskName        string         `gorm:"index;not null;type:varchar(255)" json:"task_name"`
	ScheduledTime   time.Time      `gorm:"index;not null" json:"scheduled_time"`
	ActualStatus    TaskStatus     `gorm:"index;not null;type:varchar(20)" json:"actual_status"`
	MissReason      MissReason     `gorm:"type:varchar(50)" json:"miss_reason"`
	RecoveryAction  RecoveryAction `gorm:"type:varchar(50)" json:"recovery_action"`
	Remarks         string         `gorm:"type:text" json:"remarks"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DetectedAt      *time.Time     `json:"detected_at"`
	RecoveredAt     *time.Time     `json:"recovered_at"`
	CreatedBy       string         `gorm:"type:varchar(100)" json:"created_by"`
	UpdatedBy       string         `gorm:"type:varchar(100)" json:"updated_by"`
	Version         int            `gorm:"default:0" json:"version"`
	OriginalInput   string         `gorm:"type:text" json:"original_input"`
	ProcessingNote  string         `gorm:"type:text" json:"processing_note"`
	Impacts         []TaskImpact   `gorm:"foreignKey:TaskRecoveryID" json:"impacts,omitempty"`
	Logs            []TaskLog      `gorm:"foreignKey:TaskRecoveryID" json:"logs,omitempty"`
}

type TaskImpact struct {
	ID              string    `gorm:"primaryKey;type:varchar(36)" json:"id"`
	TaskRecoveryID  string    `gorm:"index;not null;type:varchar(36)" json:"task_recovery_id"`
	ImpactType      string    `gorm:"not null;type:varchar(50)" json:"impact_type"`
	ImpactScope     string    `gorm:"not null;type:varchar(255)" json:"impact_scope"`
	ImpactDesc      string    `gorm:"type:text" json:"impact_desc"`
	AffectedCount   int       `gorm:"default:0" json:"affected_count"`
	BusinessDate    string    `gorm:"type:varchar(20)" json:"business_date"`
	CreatedAt       time.Time `json:"created_at"`
}

type TaskLog struct {
	ID              string     `gorm:"primaryKey;type:varchar(36)" json:"id"`
	TaskRecoveryID  string     `gorm:"index;not null;type:varchar(36)" json:"task_recovery_id"`
	FromStatus      TaskStatus `gorm:"type:varchar(20)" json:"from_status"`
	ToStatus        TaskStatus `gorm:"type:varchar(20)" json:"to_status"`
	Action          string     `gorm:"type:varchar(100)" json:"action"`
	Operator        string     `gorm:"type:varchar(100)" json:"operator"`
	OriginalInput   string     `gorm:"type:text" json:"original_input"`
	ProcessingNote  string     `gorm:"type:text" json:"processing_note"`
	CreatedAt       time.Time  `json:"created_at"`
}

func (t *TaskRecovery) BeforeCreate(tx *gorm.DB) error {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	now := time.Now()
	t.CreatedAt = now
	t.UpdatedAt = now
	return nil
}

func (t *TaskImpact) BeforeCreate(tx *gorm.DB) error {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	t.CreatedAt = time.Now()
	return nil
}

func (t *TaskLog) BeforeCreate(tx *gorm.DB) error {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	t.CreatedAt = time.Now()
	return nil
}

func IsValidStatusTransition(from, to TaskStatus) bool {
	transitions := map[TaskStatus][]TaskStatus{
		StatusPending:    {StatusDetected, StatusCancelled},
		StatusDetected:   {StatusAnalyzing, StatusCancelled, StatusManualFix},
		StatusAnalyzing:  {StatusRecovering, StatusManualFix, StatusFailed, StatusCancelled},
		StatusRecovering: {StatusCompleted, StatusFailed, StatusManualFix},
		StatusFailed:     {StatusRecovering, StatusManualFix, StatusCancelled},
		StatusManualFix:  {StatusRecovering, StatusCompleted, StatusFailed},
		StatusCompleted:  {},
		StatusCancelled:  {},
	}
	
	validNext, exists := transitions[from]
	if !exists {
		return false
	}
	for _, s := range validNext {
		if s == to {
			return true
		}
	}
	return false
}

func IsFinalStatus(status TaskStatus) bool {
	return status == StatusCompleted || status == StatusCancelled
}
