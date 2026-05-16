package models

import (
	"time"
	"github.com/google/uuid"
)

type Tenant struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
	MaxConcurrent int     `json:"max_concurrent" db:"max_concurrent"`
	MaxDailySize int64    `json:"max_daily_size" db:"max_daily_size"`
	MaxQueueSize int      `json:"max_queue_size" db:"max_queue_size"`
}

type ExportTaskStatus string

const (
	StatusPending   ExportTaskStatus = "pending"
	StatusQueued    ExportTaskStatus = "queued"
	StatusRunning   ExportTaskStatus = "running"
	StatusCompleted ExportTaskStatus = "completed"
	StatusFailed    ExportTaskStatus = "failed"
	StatusRejected  ExportTaskStatus = "rejected"
	StatusCancelled ExportTaskStatus = "cancelled"
)

type RejectReason string

const (
	RejectQuotaExceeded      RejectReason = "quota_exceeded"
	RejectConcurrentLimit    RejectReason = "concurrent_limit"
	RejectQueueFull          RejectReason = "queue_full"
	RejectFileTooLarge       RejectReason = "file_too_large"
	RejectTenantDisabled     RejectReason = "tenant_disabled"
	RejectInvalidRequest     RejectReason = "invalid_request"
)

type ExportTask struct {
	ID            string           `json:"id" db:"id"`
	TenantID      string           `json:"tenant_id" db:"tenant_id"`
	FileName      string           `json:"file_name" db:"file_name"`
	FileSize      int64            `json:"file_size" db:"file_size"`
	FileType      string           `json:"file_type" db:"file_type"`
	Status        ExportTaskStatus `json:"status" db:"status"`
	CreatedAt     time.Time        `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time        `json:"updated_at" db:"updated_at"`
	StartedAt     *time.Time       `json:"started_at,omitempty" db:"started_at"`
	CompletedAt   *time.Time       `json:"completed_at,omitempty" db:"completed_at"`
	RejectReason  *RejectReason    `json:"reject_reason,omitempty" db:"reject_reason"`
	RejectDetail  *string          `json:"reject_detail,omitempty" db:"reject_detail"`
	RawRequest    string           `json:"raw_request" db:"raw_request"`
	ProcessingLog string           `json:"processing_log" db:"processing_log"`
	Priority      int              `json:"priority" db:"priority"`
	DownloadURL   *string          `json:"download_url,omitempty" db:"download_url"`
}

type QuotaWindow struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenant_id" db:"tenant_id"`
	WindowType   string    `json:"window_type" db:"window_type"`
	WindowStart  time.Time `json:"window_start" db:"window_start"`
	WindowEnd    time.Time `json:"window_end" db:"window_end"`
	UsedSize     int64     `json:"used_size" db:"used_size"`
	UsedCount    int       `json:"used_count" db:"used_count"`
	MaxSize      int64     `json:"max_size" db:"max_size"`
	MaxCount     int       `json:"max_count" db:"max_count"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

type UsageReport struct {
	ID             string    `json:"id" db:"id"`
	TenantID       string    `json:"tenant_id" db:"tenant_id"`
	ReportDate     time.Time `json:"report_date" db:"report_date"`
	TotalTasks     int       `json:"total_tasks" db:"total_tasks"`
	CompletedTasks int       `json:"completed_tasks" db:"completed_tasks"`
	FailedTasks    int       `json:"failed_tasks" db:"failed_tasks"`
	RejectedTasks  int       `json:"rejected_tasks" db:"rejected_tasks"`
	TotalSize      int64     `json:"total_size" db:"total_size"`
	AvgDuration    float64   `json:"avg_duration_seconds" db:"avg_duration_seconds"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

type TaskHistory struct {
	ID        string           `json:"id" db:"id"`
	TaskID    string           `json:"task_id" db:"task_id"`
	FromStatus ExportTaskStatus `json:"from_status" db:"from_status"`
	ToStatus   ExportTaskStatus `json:"to_status" db:"to_status"`
	Reason     string           `json:"reason" db:"reason"`
	CreatedAt  time.Time        `json:"created_at" db:"created_at"`
	Operator   *string          `json:"operator,omitempty" db:"operator"`
}

func NewTenant(name string, maxConcurrent int, maxDailySize int64, maxQueueSize int) *Tenant {
	return &Tenant{
		ID:           uuid.NewString(),
		Name:         name,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
		MaxConcurrent: maxConcurrent,
		MaxDailySize: maxDailySize,
		MaxQueueSize: maxQueueSize,
	}
}

func NewExportTask(tenantID, fileName string, fileSize int64, fileType, rawRequest string, priority int) *ExportTask {
	return &ExportTask{
		ID:           uuid.NewString(),
		TenantID:     tenantID,
		FileName:     fileName,
		FileSize:     fileSize,
		FileType:     fileType,
		Status:       StatusPending,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
		RawRequest:   rawRequest,
		Priority:     priority,
		ProcessingLog: "",
	}
}

func NewQuotaWindow(tenantID string, windowType string, windowStart, windowEnd time.Time, maxSize int64, maxCount int) *QuotaWindow {
	return &QuotaWindow{
		ID:          uuid.NewString(),
		TenantID:    tenantID,
		WindowType:  windowType,
		WindowStart: windowStart,
		WindowEnd:   windowEnd,
		UsedSize:    0,
		UsedCount:   0,
		MaxSize:     maxSize,
		MaxCount:    maxCount,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
}

func NewTaskHistory(taskID string, fromStatus, toStatus ExportTaskStatus, reason string, operator *string) *TaskHistory {
	return &TaskHistory{
		ID:         uuid.NewString(),
		TaskID:     taskID,
		FromStatus: fromStatus,
		ToStatus:   toStatus,
		Reason:     reason,
		CreatedAt:  time.Now(),
		Operator:   operator,
	}
}
