package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ExemptionStatus string

const (
	StatusPending  ExemptionStatus = "PENDING"
	StatusApproved ExemptionStatus = "APPROVED"
	StatusRejected ExemptionStatus = "REJECTED"
	StatusExpired  ExemptionStatus = "EXPIRED"
	StatusRevoked  ExemptionStatus = "REVOKED"
	StatusConflict ExemptionStatus = "CONFLICT"
)

type Exemption struct {
	ID              string          `gorm:"primaryKey;type:varchar(36)" json:"id"`
	ScriptVersion   string          `gorm:"type:varchar(100);not null;index" json:"script_version"`
	ScriptContent   string          `gorm:"type:text" json:"script_content"`
	CallID          string          `gorm:"type:varchar(100);index" json:"call_id"`
	AgentID         string          `gorm:"type:varchar(100);index" json:"agent_id"`
	ExemptionReason string          `gorm:"type:text;not null" json:"exemption_reason"`
	ExpireAt        *time.Time      `json:"expire_at"`
	Status          ExemptionStatus `gorm:"type:varchar(20);not null;index" json:"status"`
	SupervisorID    string          `gorm:"type:varchar(100)" json:"supervisor_id"`
	SupervisorName  string          `gorm:"type:varchar(100)" json:"supervisor_name"`
	ApprovalComment string          `gorm:"type:text" json:"approval_comment"`
	ApprovedAt      *time.Time      `json:"approved_at"`
	QualityReportID string          `gorm:"type:varchar(36)" json:"quality_report_id"`
	IdempotencyKey  string          `gorm:"type:varchar(64);uniqueIndex" json:"idempotency_key"`
	CreatedBy       string          `gorm:"type:varchar(100);not null" json:"created_by"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
	Samples         []Sample        `gorm:"foreignKey:ExemptionID" json:"samples,omitempty"`
	ApprovalHistory []ApprovalLog   `gorm:"foreignKey:ExemptionID" json:"approval_history,omitempty"`
	OperationLogs   []OperationLog  `gorm:"foreignKey:ExemptionID" json:"operation_logs,omitempty"`
}

func (e *Exemption) BeforeCreate(tx *gorm.DB) error {
	if e.ID == "" {
		e.ID = uuid.NewString()
	}
	now := time.Now()
	e.CreatedAt = now
	e.UpdatedAt = now
	if e.Status == "" {
		e.Status = StatusPending
	}
	return nil
}

func (e *Exemption) BeforeUpdate(tx *gorm.DB) error {
	e.UpdatedAt = time.Now()
	return nil
}

type Sample struct {
	ID          string    `gorm:"primaryKey;type:varchar(36)" json:"id"`
	ExemptionID string    `gorm:"type:varchar(36);not null;index" json:"exemption_id"`
	SampleType  string    `gorm:"type:varchar(50);not null" json:"sample_type"`
	FileName    string    `gorm:"type:varchar(255);not null" json:"file_name"`
	FileSize    int64     `json:"file_size"`
	FileHash    string    `gorm:"type:varchar(64)" json:"file_hash"`
	StoragePath string    `gorm:"type:varchar(255);not null" json:"storage_path"`
	UploadedBy  string    `gorm:"type:varchar(100);not null" json:"uploaded_by"`
	UploadedAt  time.Time `json:"uploaded_at"`
}

func (s *Sample) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = uuid.NewString()
	}
	s.UploadedAt = time.Now()
	return nil
}

type ApprovalLog struct {
	ID             string          `gorm:"primaryKey;type:varchar(36)" json:"id"`
	ExemptionID    string          `gorm:"type:varchar(36);not null;index" json:"exemption_id"`
	SupervisorID   string          `gorm:"type:varchar(100);not null" json:"supervisor_id"`
	SupervisorName string          `gorm:"type:varchar(100);not null" json:"supervisor_name"`
	Action         ExemptionStatus `gorm:"type:varchar(20);not null" json:"action"`
	Comment        string          `gorm:"type:text" json:"comment"`
	IsConflict     bool            `gorm:"default:false" json:"is_conflict"`
	ConflictedWith string          `gorm:"type:varchar(100)" json:"conflicted_with"`
	CreatedAt      time.Time       `json:"created_at"`
}

func (a *ApprovalLog) BeforeCreate(tx *gorm.DB) error {
	if a.ID == "" {
		a.ID = uuid.NewString()
	}
	a.CreatedAt = time.Now()
	return nil
}

type OperationLog struct {
	ID           string    `gorm:"primaryKey;type:varchar(36)" json:"id"`
	ExemptionID  string    `gorm:"type:varchar(36);index" json:"exemption_id"`
	OperatorID   string    `gorm:"type:varchar(100);not null" json:"operator_id"`
	OperatorName string    `gorm:"type:varchar(100);not null" json:"operator_name"`
	Operation    string    `gorm:"type:varchar(50);not null" json:"operation"`
	OldStatus    string    `gorm:"type:varchar(20)" json:"old_status"`
	NewStatus    string    `gorm:"type:varchar(20)" json:"new_status"`
	Detail       string    `gorm:"type:text" json:"detail"`
	CreatedAt    time.Time `json:"created_at"`
}

func (o *OperationLog) BeforeCreate(tx *gorm.DB) error {
	if o.ID == "" {
		o.ID = uuid.NewString()
	}
	o.CreatedAt = time.Now()
	return nil
}

type QualityReport struct {
	ID            string    `gorm:"primaryKey;type:varchar(36)" json:"id"`
	ExemptionID   string    `gorm:"type:varchar(36);not null;index" json:"exemption_id"`
	ReportNo      string    `gorm:"type:varchar(100);uniqueIndex" json:"report_no"`
	Score         float64   `json:"score"`
	InspectorID   string    `gorm:"type:varchar(100);not null" json:"inspector_id"`
	InspectorName string    `gorm:"type:varchar(100);not null" json:"inspector_name"`
	CheckItems    string    `gorm:"type:text" json:"check_items"`
	IssuesFound   string    `gorm:"type:text" json:"issues_found"`
	Suggestions   string    `gorm:"type:text" json:"suggestions"`
	CreatedAt     time.Time `json:"created_at"`
}

func (q *QualityReport) BeforeCreate(tx *gorm.DB) error {
	if q.ID == "" {
		q.ID = uuid.NewString()
	}
	q.CreatedAt = time.Now()
	return nil
}

type ExemptionRequest struct {
	ScriptVersion   string     `json:"script_version" binding:"required"`
	ScriptContent   string     `json:"script_content"`
	CallID          string     `json:"call_id"`
	AgentID         string     `json:"agent_id"`
	ExemptionReason string     `json:"exemption_reason" binding:"required"`
	ExpireAt        *time.Time `json:"expire_at"`
	CreatedBy       string     `json:"created_by" binding:"required"`
	CreatedByName   string     `json:"created_by_name"`
	IdempotencyKey  string     `json:"idempotency_key"`
}

type ApprovalRequest struct {
	SupervisorID   string          `json:"supervisor_id" binding:"required"`
	SupervisorName string          `json:"supervisor_name" binding:"required"`
	Action         ExemptionStatus `json:"action" binding:"required"`
	Comment        string          `json:"comment"`
}

type QueryRequest struct {
	ScriptVersion string          `form:"script_version"`
	AgentID       string          `form:"agent_id"`
	Status        ExemptionStatus `form:"status"`
	CallID        string          `form:"call_id"`
	StartDate     *time.Time      `form:"start_date"`
	EndDate       *time.Time      `form:"end_date"`
	Page          int             `form:"page,default=1"`
	PageSize      int             `form:"page_size,default=20"`
}

type PaginatedResponse struct {
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
	Data     interface{} `json:"data"`
}

type IdempotentResponse struct {
	IsDuplicate  bool        `json:"is_duplicate"`
	ProcessedBy  string      `json:"processed_by,omitempty"`
	ProcessedAt  *time.Time  `json:"processed_at,omitempty"`
	OriginalData interface{} `json:"original_data,omitempty"`
}

type StatisticsSummary struct {
	TotalCount          int64 `json:"total_count"`
	PendingCount        int64 `json:"pending_count"`
	ApprovedCount       int64 `json:"approved_count"`
	RejectedCount       int64 `json:"rejected_count"`
	ExpiredCount        int64 `json:"expired_count"`
	ConflictCount       int64 `json:"conflict_count"`
	ConflictStatusCount int64 `json:"conflict_status_count"`
	NoSampleCount       int64 `json:"no_sample_count"`
}

type QualityReportRequest struct {
	ExemptionID   string  `json:"exemption_id" binding:"required"`
	ReportNo      string  `json:"report_no" binding:"required"`
	Score         float64 `json:"score"`
	InspectorID   string  `json:"inspector_id" binding:"required"`
	InspectorName string  `json:"inspector_name" binding:"required"`
	CheckItems    string  `json:"check_items"`
	IssuesFound   string  `json:"issues_found"`
	Suggestions   string  `json:"suggestions"`
}
