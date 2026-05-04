package model

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Tenant struct {
	ID        string    `db:"id" json:"id"`
	Name      string    `db:"name" json:"name"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

type Service struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

type ConfigItem struct {
	ID          string          `db:"id" json:"id"`
	TenantID    string          `db:"tenant_id" json:"tenant_id"`
	ServiceID   string          `db:"service_id" json:"service_id"`
	Key         string          `db:"key" json:"key"`
	Description string          `db:"description" json:"description"`
	Schema      json.RawMessage `db:"schema" json:"schema"`
	CreatedAt   time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time       `db:"updated_at" json:"updated_at"`
}

type ConfigVersion struct {
	ID          string          `db:"id" json:"id"`
	ConfigID    string          `db:"config_id" json:"config_id"`
	Version     int             `db:"version" json:"version"`
	Value       json.RawMessage `db:"value" json:"value"`
	Status      string          `db:"status" json:"status"`
	PublishedAt sql.NullTime    `db:"published_at" json:"published_at"`
	CreatedAt   time.Time       `db:"created_at" json:"created_at"`
	CreatedBy   string          `db:"created_by" json:"created_by"`
}

type ReleaseStatus string

const (
	ReleaseStatusDraft     ReleaseStatus = "draft"
	ReleaseStatusPending   ReleaseStatus = "pending"
	ReleaseStatusRolling   ReleaseStatus = "rolling"
	ReleaseStatusPaused    ReleaseStatus = "paused"
	ReleaseStatusCompleted ReleaseStatus = "completed"
	ReleaseStatusRolledBack ReleaseStatus = "rolled_back"
)

type Release struct {
	ID            string          `db:"id" json:"id"`
	TenantID      string          `db:"tenant_id" json:"tenant_id"`
	ServiceID     string          `db:"service_id" json:"service_id"`
	Name          string          `db:"name" json:"name"`
	ConfigChanges json.RawMessage `db:"config_changes" json:"config_changes"`
	GrayRule      json.RawMessage `db:"gray_rule" json:"gray_rule"`
	Status        ReleaseStatus   `db:"status" json:"status"`
	CreatedAt     time.Time       `db:"created_at" json:"created_at"`
	StartedAt     sql.NullTime    `db:"started_at" json:"started_at"`
	PausedAt      sql.NullTime    `db:"paused_at" json:"paused_at"`
	CompletedAt   sql.NullTime    `db:"completed_at" json:"completed_at"`
	RolledBackAt  sql.NullTime    `db:"rolled_back_at" json:"rolled_back_at"`
	CreatedBy     string          `db:"created_by" json:"created_by"`
	ApprovedBy    sql.NullString  `db:"approved_by" json:"approved_by"`
}

type GrayRule struct {
	TenantIDs []string `json:"tenant_ids,omitempty"`
	Regions   []string `json:"regions,omitempty"`
	Percentage int     `json:"percentage"`
}

type Client struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	ServiceID string    `db:"service_id" json:"service_id"`
	ClientID  string    `db:"client_id" json:"client_id"`
	Region    string    `db:"region" json:"region"`
	IP        string    `db:"ip" json:"ip"`
	Metadata  json.RawMessage `db:"metadata" json:"metadata"`
	LastSeen  time.Time `db:"last_seen" json:"last_seen"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type ClientPull struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	ServiceID    string    `db:"service_id" json:"service_id"`
	ClientID     string    `db:"client_id" json:"client_id"`
	ConfigID     string    `db:"config_id" json:"config_id"`
	VersionID    string    `db:"version_id" json:"version_id"`
	Version      int       `db:"version" json:"version"`
	ReleaseID    string    `db:"release_id" json:"release_id"`
	IsGrayHit    bool      `db:"is_gray_hit" json:"is_gray_hit"`
	ETag         string    `db:"etag" json:"etag"`
	PulledAt     time.Time `db:"pulled_at" json:"pulled_at"`
	ClientRegion string    `db:"client_region" json:"client_region"`
}

type AuditAction string

const (
	AuditActionCreateTenant     AuditAction = "create_tenant"
	AuditActionUpdateTenant     AuditAction = "update_tenant"
	AuditActionCreateService    AuditAction = "create_service"
	AuditActionCreateConfig     AuditAction = "create_config"
	AuditActionUpdateConfig     AuditAction = "update_config"
	AuditActionCreateVersion    AuditAction = "create_version"
	AuditActionValidateVersion  AuditAction = "validate_version"
	AuditActionCreateRelease    AuditAction = "create_release"
	AuditActionStartRelease     AuditAction = "start_release"
	AuditActionPauseRelease     AuditAction = "pause_release"
	AuditActionResumeRelease    AuditAction = "resume_release"
	AuditActionCompleteRelease  AuditAction = "complete_release"
	AuditActionRollbackRelease  AuditAction = "rollback_release"
	AuditActionClientPull       AuditAction = "client_pull"
)

type AuditLog struct {
	ID         string          `db:"id" json:"id"`
	TenantID   string          `db:"tenant_id" json:"tenant_id"`
	Action     AuditAction     `db:"action" json:"action"`
	ResourceID string          `db:"resource_id" json:"resource_id"`
	ResourceType string        `db:"resource_type" json:"resource_type"`
	Details    json.RawMessage `db:"details" json:"details"`
	Operator   string          `db:"operator" json:"operator"`
	CreatedAt  time.Time       `db:"created_at" json:"created_at"`
}

func NewID() string {
	return uuid.New().String()
}

func (r *GrayRule) Validate() error {
	if r.Percentage < 0 || r.Percentage > 100 {
		return ErrInvalidGrayPercentage
	}
	return nil
}

type DiffResult struct {
	ConfigKey   string      `json:"config_key"`
	OldVersion  int         `json:"old_version"`
	NewVersion  int         `json:"new_version"`
	OldValue    interface{} `json:"old_value"`
	NewValue    interface{} `json:"new_value"`
	Operation   string      `json:"operation"`
}

type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Value   interface{} `json:"value,omitempty"`
}

type ValidationResult struct {
	Valid   bool               `json:"valid"`
	ConfigKey string            `json:"config_key"`
	Errors  []ValidationError `json:"errors,omitempty"`
}

type ReportItem struct {
	ConfigKey    string          `json:"config_key"`
	Status       string          `json:"status"`
	OldVersion   int             `json:"old_version"`
	NewVersion   int             `json:"new_version"`
	HitClients   int             `json:"hit_clients"`
	TotalClients int             `json:"total_clients"`
	HitPercentage float64        `json:"hit_percentage"`
}

type ReleaseReport struct {
	ReleaseID    string          `json:"release_id"`
	ReleaseName  string          `json:"release_name"`
	TenantID     string          `json:"tenant_id"`
	ServiceID    string          `json:"service_id"`
	Status       string          `json:"status"`
	GrayRule     *GrayRule       `json:"gray_rule"`
	ChangeSummary []ReportItem   `json:"change_summary"`
	ValidationErrors []ValidationResult `json:"validation_errors,omitempty"`
	RollbackRecords []RollbackRecord `json:"rollback_records,omitempty"`
	PendingRisks []RiskItem      `json:"pending_risks,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
	StartedAt    *time.Time      `json:"started_at,omitempty"`
	CompletedAt  *time.Time      `json:"completed_at,omitempty"`
	RolledBackAt *time.Time      `json:"rolled_back_at,omitempty"`
	CreatedBy    string          `json:"created_by"`
}

type RollbackRecord struct {
	FromVersion int       `json:"from_version"`
	ToVersion   int       `json:"to_version"`
	Operator    string    `json:"operator"`
	Timestamp   time.Time `json:"timestamp"`
	AffectedClients int   `json:"affected_clients"`
	Reason      string    `json:"reason"`
}

type RiskItem struct {
	Level       string `json:"level"`
	Description string `json:"description"`
	ConfigKey   string `json:"config_key,omitempty"`
}

var (
	ErrTenantNotFound        = &AppError{Code: "tenant_not_found", Message: "租户不存在"}
	ErrServiceNotFound       = &AppError{Code: "service_not_found", Message: "服务不存在"}
	ErrConfigNotFound        = &AppError{Code: "config_not_found", Message: "配置项不存在"}
	ErrVersionNotFound       = &AppError{Code: "version_not_found", Message: "版本不存在"}
	ErrReleaseNotFound       = &AppError{Code: "release_not_found", Message: "发布批次不存在"}
	ErrClientNotFound        = &AppError{Code: "client_not_found", Message: "客户端不存在"}
	ErrVersionConflict       = &AppError{Code: "version_conflict", Message: "版本冲突"}
	ErrInvalidGrayPercentage = &AppError{Code: "invalid_gray_percentage", Message: "灰度比例必须在 0-100 之间"}
	ErrInvalidReleaseStatus  = &AppError{Code: "invalid_release_status", Message: "无效的发布状态"}
	ErrValidationFailed      = &AppError{Code: "validation_failed", Message: "配置校验失败"}
	ErrSchemaInvalid         = &AppError{Code: "schema_invalid", Message: "Schema 无效"}
	ErrTenantMismatch        = &AppError{Code: "tenant_mismatch", Message: "租户不匹配"}
	ErrDuplicateKey          = &AppError{Code: "duplicate_key", Message: "配置键已存在"}
)

type AppError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *AppError) Error() string {
	return e.Message
}
