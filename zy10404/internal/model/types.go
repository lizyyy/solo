package model

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"
)

type BackfillStatus string

const (
	StatusDraft         BackfillStatus = "DRAFT"
	StatusPendingReview BackfillStatus = "PENDING_REVIEW"
	StatusApproved      BackfillStatus = "APPROVED"
	StatusProcessing    BackfillStatus = "PROCESSING"
	StatusCompleted     BackfillStatus = "COMPLETED"
	StatusFailed        BackfillStatus = "FAILED"
	StatusRejected      BackfillStatus = "REJECTED"
	StatusCancelled     BackfillStatus = "CANCELLED"
)

type SourceType string

const (
	SourceLogReplay    SourceType = "LOG_REPLAY"
	SourceManual     SourceType = "MANUAL"
	SourceApiSync   SourceType = "API_SYNC"
	SourceBatchImport SourceType = "BATCH_IMPORT"
	SourceOther   SourceType = "OTHER"
)

type MetricType string

const (
	MetricQPS       MetricType = "QPS"
	MetricLatency MetricType = "LATENCY"
	MetricError    MetricType = "ERROR_RATE"
	MetricSuccess  MetricType = "SUCCESS_RATE"
	MetricCustom MetricType = "CUSTOM"
)

type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	return json.Marshal(j)
}

func (j *JSONB) Scan(value interface{}) error {
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(bytes, j)
}

type GrayscaleBatch struct {
	ID          int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	BatchID     string    `json:"batch_id" gorm:"uniqueIndex;size:64;not null"`
	BatchName   string    `json:"batch_name" gorm:"size:128;not null"`
	Description  string    `json:"description" gorm:"type:text"`
	CreatedAt    time.Time `json:"created_at" gorm:"index"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type MetricWindow struct {
	ID          int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	WindowID     string    `json:"window_id" gorm:"uniqueIndex;size:64;not null"`
	BatchID      string    `json:"batch_id" gorm:"index;size:64;not null"`
	StartTime    time.Time `json:"start_time" gorm:"index;not null"`
	EndTime      time.Time `json:"end_time" gorm:"index;not null"`
	MetricTypes  []string  `json:"metric_types" gorm:"serializer:json"`
	Granularity  string    `json:"granularity" gorm:"size:32;default:'5m"`
	IsReadOnly   bool      `json:"is_read_only" gorm:"default:false"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type GapSegment struct {
	ID             int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	SegmentID      string    `json:"segment_id" gorm:"uniqueIndex;size:64;not null"`
	BackfillID     string    `json:"backfill_id" gorm:"index;size:64;not null"`
	StartTime      time.Time `json:"start_time" gorm:"index;not null"`
	EndTime        time.Time `json:"end_time" gorm:"index;not null"`
	ExpectedCount  int64     `json:"expected_count"`
	ActualCount    int64     `json:"actual_count"`
	GapPercent     float64   `json:"gap_percent"`
	DetectedAt     time.Time `json:"detected_at"`
	CreatedAt      time.Time `json:"created_at"`
}

type BackfillSource struct {
	ID              int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	SourceID        string    `json:"source_id" gorm:"uniqueIndex;size:64;not null"`
	BackfillID      string    `json:"backfill_id" gorm:"index;size:64;not null"`
	SourceType      SourceType `json:"source_type" gorm:"size:32;not null"`
	SourceConfig    JSONB      `json:"source_config" gorm:"type:jsonb"`
	ConnectionInfo    string    `json:"connection_info" gorm:"size:512"`
	IsAvailable     bool      `json:"is_available" gorm:"default:true"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type AuditRecord struct {
	ID              int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	AuditID         string    `json:"audit_id" gorm:"uniqueIndex;size:64;not null"`
	BackfillID      string    `json:"backfill_id" gorm:"index;size:64;not null"`
	Operator        string    `json:"operator" gorm:"size:64;not null"`
	FromStatus      BackfillStatus `json:"from_status" gorm:"size:32"`
	ToStatus        BackfillStatus `json:"to_status" gorm:"size:32;not null"`
	Comment         string    `json:"comment" gorm:"type:text"`
	AuditTime       time.Time `json:"audit_time" gorm:"index;not null"`
	CreatedAt        time.Time `json:"created_at"`
}

type ResultSnapshot struct {
	ID              int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	SnapshotID      string    `json:"snapshot_id" gorm:"uniqueIndex;size:64;not null"`
	BackfillID      string    `json:"backfill_id" gorm="index;size:64;not null"`
	SnapshotType    string    `json:"snapshot_type" gorm:"size:32;not null"`
	Content         JSONB     `json:"content" gorm:"type:jsonb;not null"`
	RecordCount     int64     `json:"record_count"`
	FileHash        string    `json:"file_hash" gorm:"size:128"`
	ExportedAt      time.Time `json:"exported_at"`
	CreatedAt       time.Time `json:"created_at"`
}

type BackfillTask struct {
	ID                int64          `json:"id" gorm:"primaryKey;autoIncrement"`
	BackfillID        string         `json:"backfill_id" gorm:"uniqueIndex;size:64;not null"`
	BatchID           string         `json:"batch_id" gorm:"index;size:64;not null"`
	WindowID          string         `json:"window_id" gorm:"index;size:64;not null"`
	Status            BackfillStatus `json:"status" gorm:"index;size:32;not null;default:'DRAFT'"`
	Title             string         `json:"title" gorm:"size:256;not null"`
	Description       string         `json:"description" gorm:"type:text"`
	Creator           string         `json:"creator" gorm="size:64;not null"`

	RawInput          JSONB          `json:"raw_input" gorm:"type:jsonb;not null"`
	ProcessingResult  JSONB          `json:"processing_result" gorm:"type:jsonb"`
	FailureReason     string         `json:"failure_reason" gorm:"type:text"`
	ErrorDetails      JSONB          `json:"error_details" gorm:"type:jsonb"`

	AllowOverwrite    bool           `json:"allow_overwrite" gorm:"default:false"`
	OverwriteProtect bool           `json:"overwrite_protect" gorm:"default:true"`
	DeduplicationKey string         `json:"deduplication_key" gorm:"index;size:256;not null"`

	ProcessedRecords   int64          `json:"processed_records" gorm:"default:0"`
	TotalRecords      int64          `json:"total_records" gorm:"default:0"`
	SuccessRecords   int64          `json:"success_records" gorm="default:0"`
	FailedRecords     int64          `json:"failed_records" gorm:"default:0"`

	StartTime        time.Time      `json:"start_time"`
	EndTime          time.Time      `json:"end_time"`
	CreatedAt        time.Time      `json:"created_at" gorm:"index"`
	UpdatedAt        time.Time      `json:"updated_at"`
}
