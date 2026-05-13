package model

import (
	"time"
)

type Provider string

const (
	ProviderAWS    Provider = "aws"
	ProviderAliyun Provider = "aliyun"
	ProviderTencent Provider = "tencent"
	ProviderHuawei Provider = "huawei"
)

type BucketStatus string

const (
	BucketStatusActive   BucketStatus = "active"
	BucketStatusInactive BucketStatus = "inactive"
	BucketStatusDegraded BucketStatus = "degraded"
)

type Bucket struct {
	ID        string       `json:"id"`
	Name      string       `json:"name"`
	Provider  Provider     `json:"provider"`
	Region    string       `json:"region"`
	Endpoint  string       `json:"endpoint"`
	Status    BucketStatus `json:"status"`
	Priority  int          `json:"priority"`
	CreatedAt time.Time    `json:"created_at"`
	UpdatedAt time.Time    `json:"updated_at"`
}

type StrategyType string

const (
	StrategyTypePriority StrategyType = "priority"
	StrategyTypeRoundRobin StrategyType = "round_robin"
	StrategyTypeWeighted StrategyType = "weighted"
)

type FailoverMode string

const (
	FailoverModeAutomatic FailoverMode = "automatic"
	FailoverModeManual    FailoverMode = "manual"
)

type RoutingStrategy struct {
	ID           string       `json:"id"`
	Name         string       `json:"name"`
	Type         StrategyType `json:"type"`
	FailoverMode FailoverMode `json:"failover_mode"`
	BucketIDs    []string     `json:"bucket_ids"`
	RetryCount   int          `json:"retry_count"`
	TimeoutSec   int          `json:"timeout_sec"`
	CreatedAt    time.Time    `json:"created_at"`
	UpdatedAt    time.Time    `json:"updated_at"`
}

type UploadStatus string

const (
	UploadStatusPending    UploadStatus = "pending"
	UploadStatusRouting    UploadStatus = "routing"
	UploadStatusUploading  UploadStatus = "uploading"
	UploadStatusSuccess    UploadStatus = "success"
	UploadStatusFailed     UploadStatus = "failed"
	UploadStatusSwitched   UploadStatus = "switched"
)

type UploadRequest struct {
	ID             string       `json:"id"`
	RequestID      string       `json:"request_id"`
	FileName       string       `json:"file_name"`
	FileSize       int64        `json:"file_size"`
	ContentType    string       `json:"content_type"`
	StrategyID     string       `json:"strategy_id"`
	CurrentBucketID string      `json:"current_bucket_id"`
	Status         UploadStatus `json:"status"`
	IdempotencyKey string       `json:"idempotency_key"`
	CreatedAt      time.Time    `json:"created_at"`
	UpdatedAt      time.Time    `json:"updated_at"`
}

type SwitchReason string

const (
	SwitchReasonTimeout      SwitchReason = "timeout"
	SwitchReasonError        SwitchReason = "error"
	SwitchReasonRateLimit    SwitchReason = "rate_limit"
	SwitchReasonCapacity     SwitchReason = "capacity"
	SwitchReasonManual       SwitchReason = "manual"
)

type RoutingSwitch struct {
	ID              string       `json:"id"`
	UploadRequestID string       `json:"upload_request_id"`
	FromBucketID    string       `json:"from_bucket_id"`
	ToBucketID      string       `json:"to_bucket_id"`
	Reason          SwitchReason `json:"reason"`
	ErrorCode       string       `json:"error_code,omitempty"`
	ErrorMessage    string       `json:"error_message,omitempty"`
	RetryAttempt    int          `json:"retry_attempt"`
	CreatedAt       time.Time    `json:"created_at"`
}

type ChecksumAlgorithm string

const (
	ChecksumMD5    ChecksumAlgorithm = "md5"
	ChecksumSHA1   ChecksumAlgorithm = "sha1"
	ChecksumSHA256 ChecksumAlgorithm = "sha256"
)

type ChecksumSummary struct {
	ID              string            `json:"id"`
	UploadRequestID string            `json:"upload_request_id"`
	BucketID        string            `json:"bucket_id"`
	Algorithm       ChecksumAlgorithm `json:"algorithm"`
	ExpectedHash    string            `json:"expected_hash"`
	ActualHash      string            `json:"actual_hash,omitempty"`
	IsValid         bool              `json:"is_valid"`
	VerifiedAt      *time.Time        `json:"verified_at,omitempty"`
	CreatedAt       time.Time         `json:"created_at"`
}

type AccessLink struct {
	ID              string    `json:"id"`
	UploadRequestID string    `json:"upload_request_id"`
	BucketID        string    `json:"bucket_id"`
	ObjectKey       string    `json:"object_key"`
	URL             string    `json:"url"`
	ExpiresAt       time.Time `json:"expires_at"`
	CreatedAt       time.Time `json:"created_at"`
}

type RoutingAudit struct {
	ID              string    `json:"id"`
	UploadRequestID string    `json:"upload_request_id"`
	Operation       string    `json:"operation"`
	Status          string    `json:"status"`
	Details         string    `json:"details,omitempty"`
	Operator        string    `json:"operator,omitempty"`
	ClientIP        string    `json:"client_ip,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}
