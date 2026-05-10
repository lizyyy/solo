package models

import (
	"errors"
	"time"
)

// CertificateStatus 证书状态
type CertificateStatus string

const (
	CertStatusActive           CertificateStatus = "active"
	CertStatusExpiring         CertificateStatus = "expiring"
	CertStatusExpired          CertificateStatus = "expired"
	CertStatusRevoked          CertificateStatus = "revoked"
	CertStatusPendingRenewal   CertificateStatus = "pending_renewal"
	CertStatusRenewing         CertificateStatus = "renewing"
	CertStatusRenewed          CertificateStatus = "renewed"
	CertStatusRolledBack       CertificateStatus = "rolled_back"
	CertStatusRequiresApproval CertificateStatus = "requires_approval"
)

// TaskStatus 任务状态
type TaskStatus string

const (
	TaskStatusPending      TaskStatus = "pending"
	TaskStatusProcessing   TaskStatus = "processing"
	TaskStatusCompleted    TaskStatus = "completed"
	TaskStatusFailed       TaskStatus = "failed"
	TaskStatusRollingBack  TaskStatus = "rolling_back"
	TaskStatusRolledBack   TaskStatus = "rolled_back"
	TaskStatusTimeout      TaskStatus = "timeout"
	TaskStatusConflict     TaskStatus = "conflict"
	TaskStatusCancelled    TaskStatus = "cancelled"
	TaskStatusRetrying     TaskStatus = "retrying"
	TaskStatusPendingRetry TaskStatus = "pending_retry"
)

// ReceiptStatus 回执状态
type ReceiptStatus string

const (
	ReceiptStatusPending    ReceiptStatus = "pending"
	ReceiptStatusDeployed   ReceiptStatus = "deployed"
	ReceiptStatusVerified   ReceiptStatus = "verified"
	ReceiptStatusFailed     ReceiptStatus = "failed"
	ReceiptStatusRolledBack ReceiptStatus = "rolled_back"
)

// TargetType 部署目标类型
type TargetType string

const (
	TargetTypeLoadBalancer TargetType = "load_balancer"
	TargetTypeGateway      TargetType = "gateway"
	TargetTypeClient       TargetType = "client"
)

// Certificate 证书清单
type Certificate struct {
	ID              string              `json:"id"`
	CommonName      string              `json:"common_name"`
	SANs            []string            `json:"sans"`
	SerialNumber    string              `json:"serial_number"`
	Issuer          string              `json:"issuer"`
	ValidFrom       time.Time           `json:"valid_from"`
	ValidTo         time.Time           `json:"valid_to"`
	Status          CertificateStatus   `json:"status"`
	Version         int                 `json:"version"`
	PreviousVersion *Certificate        `json:"previous_version,omitempty"`
	PEMData         string              `json:"-"`
	PrivateKey      string              `json:"-"`
	CreatedAt       time.Time           `json:"created_at"`
	UpdatedAt       time.Time           `json:"updated_at"`
	AutoRenew       bool                `json:"auto_renew"`
	RenewThreshold  time.Duration       `json:"renew_threshold"`
	Tags            map[string]string   `json:"tags"`
}

// DeploymentTarget 部署目标
type DeploymentTarget struct {
	ID       string       `json:"id"`
	Type     TargetType   `json:"type"`
	Name     string       `json:"name"`
	Endpoint string       `json:"endpoint"`
	Config   map[string]interface{} `json:"config"`
	HealthCheckEndpoint string `json:"health_check_endpoint"`
}

// RenewalTask 续签任务
type RenewalTask struct {
	ID              string              `json:"id"`
	CertificateID   string              `json:"certificate_id"`
	NewCertificate  *Certificate        `json:"new_certificate,omitempty"`
	OldCertificate  *Certificate        `json:"old_certificate,omitempty"`
	Status          TaskStatus          `json:"status"`
	Targets         []DeploymentTarget  `json:"targets"`
	Receipts        []DeploymentReceipt `json:"receipts,omitempty"`
	Priority        int                 `json:"priority"`
	RetryCount      int                 `json:"retry_count"`
	MaxRetries      int                 `json:"max_retries"`
	CreatedAt       time.Time           `json:"created_at"`
	StartedAt       *time.Time          `json:"started_at,omitempty"`
	CompletedAt     *time.Time          `json:"completed_at,omitempty"`
	TimeoutAt       *time.Time          `json:"timeout_at,omitempty"`
	ErrorMessages   []string            `json:"error_messages,omitempty"`
	LastRetryAt     *time.Time          `json:"last_retry_at,omitempty"`
	NextRetryAt     *time.Time          `json:"next_retry_at,omitempty"`
	IsRollback      bool                `json:"is_rollback"`
	ParentTaskID    *string             `json:"parent_task_id,omitempty"`
	Conflicts       []ConflictInfo      `json:"conflicts,omitempty"`
}

// DeploymentReceipt 部署回执
type DeploymentReceipt struct {
	ID              string          `json:"id"`
	TaskID          string          `json:"task_id"`
	TargetID        string          `json:"target_id"`
	TargetType      TargetType      `json:"target_type"`
	CertificateID   string          `json:"certificate_id"`
	Status          ReceiptStatus   `json:"status"`
	DeployedAt      *time.Time      `json:"deployed_at,omitempty"`
	VerifiedAt      *time.Time      `json:"verified_at,omitempty"`
	Error           string          `json:"error,omitempty"`
	HealthCheck     *HealthCheckResult `json:"health_check,omitempty"`
	Details         map[string]interface{} `json:"details,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

// HealthCheckResult 健康探测结果
type HealthCheckResult struct {
	Success   bool          `json:"success"`
	Timestamp time.Time     `json:"timestamp"`
	Latency   time.Duration `json:"latency"`
	Error     string        `json:"error,omitempty"`
	Details   map[string]interface{} `json:"details,omitempty"`
}

// ConflictInfo 冲突信息
type ConflictInfo struct {
	ConflictID  string    `json:"conflict_id"`
	Type        string    `json:"type"`
	Description string    `json:"description"`
	Resolved    bool      `json:"resolved"`
	ResolvedAt  *time.Time `json:"resolved_at,omitempty"`
	Resolution  string    `json:"resolution,omitempty"`
}

// ExpiryReport 到期报表
type ExpiryReport struct {
	ReportID        string                   `json:"report_id"`
	GeneratedAt     time.Time                `json:"generated_at"`
	PeriodStart     time.Time                `json:"period_start"`
	PeriodEnd       time.Time                `json:"period_end"`
	ExpiringCerts   []CertificateSummary     `json:"expiring_certs"`
	ExpiredCerts    []CertificateSummary     `json:"expired_certs"`
	ActiveCerts     []CertificateSummary     `json:"active_certs"`
	Statistics      ReportStatistics         `json:"statistics"`
}

// CertificateSummary 证书摘要
type CertificateSummary struct {
	ID          string    `json:"id"`
	CommonName  string    `json:"common_name"`
	ValidTo     time.Time `json:"valid_to"`
	DaysLeft    int       `json:"days_left"`
	Status      CertificateStatus `json:"status"`
	AutoRenew   bool      `json:"auto_renew"`
}

// ReportStatistics 报表统计
type ReportStatistics struct {
	TotalCerts       int `json:"total_certs"`
	ActiveCerts      int `json:"active_certs"`
	ExpiringCerts    int `json:"expiring_certs"`
	ExpiredCerts     int `json:"expired_certs"`
	RenewingCerts    int `json:"renewing_certs"`
	RenewedCerts     int `json:"renewed_certs"`
	FailedRenewals   int `json:"failed_renewals"`
	PendingApproval  int `json:"pending_approval"`
	SuccessRate      float64 `json:"success_rate"`
}

// APIError API 错误结构
type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

// SuccessCriteria 成功标准定义
type SuccessCriteria struct {
	TaskCompleted   bool
	AllReceipts     bool
	HealthChecks    bool
	NoConflicts     bool
	WithinTimeout   bool
}

// 预定义错误
var (
	ErrCertificateNotFound   = errors.New("certificate not found")
	ErrTaskNotFound          = errors.New("task not found")
	ErrTaskConflict          = errors.New("task conflict")
	ErrTaskCancelled         = errors.New("task cancelled")
	ErrTaskTimeout           = errors.New("task timeout")
	ErrDeploymentFailed      = errors.New("deployment failed")
	ErrHealthCheckFailed     = errors.New("health check failed")
	ErrRollbackFailed        = errors.New("rollback failed")
	ErrMaxRetriesExceeded    = errors.New("max retries exceeded")
	ErrInvalidStatus         = errors.New("invalid status transition")
	ErrCertificateExpired    = errors.New("certificate expired")
	ErrManualReviewRequired  = errors.New("manual review required")
)
