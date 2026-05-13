package model

import (
	"time"

	"github.com/google/uuid"
)

type MirrorRuleStatus string

const (
	RuleStatusDraft     MirrorRuleStatus = "DRAFT"
	RuleStatusActive    MirrorRuleStatus = "ACTIVE"
	RuleStatusPaused    MirrorRuleStatus = "PAUSED"
	RuleStatusDisabled  MirrorRuleStatus = "DISABLED"
)

type TargetEnvironment struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	BaseURL     string    `json:"base_url" db:"base_url"`
	AuthType    string    `json:"auth_type" db:"auth_type"`
	AuthToken   string    `json:"auth_token,omitempty" db:"auth_token"`
	Headers     string    `json:"headers" db:"headers"`
	TimeoutSec  int       `json:"timeout_sec" db:"timeout_sec"`
	Enabled     bool      `json:"enabled" db:"enabled"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type MaskingField struct {
	ID          string `json:"id" db:"id"`
	RuleID      string `json:"rule_id" db:"rule_id"`
	FieldPath   string `json:"field_path" db:"field_path"`
	MaskType    string `json:"mask_type" db:"mask_type"`
	MaskPattern string `json:"mask_pattern" db:"mask_pattern"`
}

type MirrorRule struct {
	ID            string            `json:"id" db:"id"`
	IdempotencyKey string           `json:"idempotency_key" db:"idempotency_key"`
	Name          string            `json:"name" db:"name"`
	Description   string            `json:"description" db:"description"`
	SourcePath    string            `json:"source_path" db:"source_path"`
	SourceMethod  string            `json:"source_method" db:"source_method"`
	SampleRate    float64           `json:"sample_rate" db:"sample_rate"`
	Targets       []string          `json:"targets" db:"-"`
	TargetsJSON   string            `json:"-" db:"targets"`
	MaskingFields []MaskingField    `json:"masking_fields" db:"-"`
	Status        MirrorRuleStatus  `json:"status" db:"status"`
	CompareMode   bool              `json:"compare_mode" db:"compare_mode"`
	CreatedAt     time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at" db:"updated_at"`
	CreatedBy     string            `json:"created_by" db:"created_by"`
}

type RequestCopyStatus string

const (
	RequestStatusPending   RequestCopyStatus = "PENDING"
	RequestStatusDelivered RequestCopyStatus = "DELIVERED"
	RequestStatusFailed    RequestCopyStatus = "FAILED"
	RequestStatusCompared  RequestCopyStatus = "COMPARED"
)

type RequestCopy struct {
	ID             string            `json:"id" db:"id"`
	RuleID         string            `json:"rule_id" db:"rule_id"`
	TraceID        string            `json:"trace_id" db:"trace_id"`
	TargetEnvID    string            `json:"target_env_id" db:"target_env_id"`
	OriginalURL    string            `json:"original_url" db:"original_url"`
	Method         string            `json:"method" db:"method"`
	RequestHeaders string            `json:"request_headers" db:"request_headers"`
	RequestBody    string            `json:"request_body" db:"request_body"`
	MaskedBody     string            `json:"masked_body" db:"masked_body"`
	StatusCode     *int              `json:"status_code" db:"status_code"`
	Response       *string           `json:"response" db:"response"`
	ErrorMsg       *string           `json:"error_msg" db:"error_msg"`
	Status         RequestCopyStatus `json:"status" db:"status"`
	DurationMs     *int64            `json:"duration_ms" db:"duration_ms"`
	CreatedAt      time.Time         `json:"created_at" db:"created_at"`
	DeliveredAt    *time.Time        `json:"delivered_at" db:"delivered_at"`
}

type CompareResult struct {
	ID               string     `json:"id" db:"id"`
	OriginalCopyID   string     `json:"original_copy_id" db:"original_copy_id"`
	MirroredCopyID   string     `json:"mirrored_copy_id" db:"mirrored_copy_id"`
	RuleID           string     `json:"rule_id" db:"rule_id"`
	StatusCodeMatch  *bool      `json:"status_code_match" db:"status_code_match"`
	BodyMatch        *bool      `json:"body_match" db:"body_match"`
	HeadersMatch     *bool      `json:"headers_match" db:"headers_match"`
	SimilarityScore  float64    `json:"similarity_score" db:"similarity_score"`
	DiffDetails      string     `json:"diff_details" db:"diff_details"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
}

type ApiResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type CreateMirrorRuleRequest struct {
	IdempotencyKey string            `json:"idempotency_key" binding:"required"`
	Name           string            `json:"name" binding:"required"`
	Description    string            `json:"description"`
	SourcePath     string            `json:"source_path" binding:"required"`
	SourceMethod   string            `json:"source_method" binding:"required"`
	SampleRate     float64           `json:"sample_rate" binding:"min=0,max=1"`
	Targets        []string          `json:"targets" binding:"required,min=1"`
	MaskingFields  []MaskingFieldReq `json:"masking_fields"`
	CompareMode    bool              `json:"compare_mode"`
	CreatedBy      string            `json:"created_by"`
}

type MaskingFieldReq struct {
	FieldPath   string `json:"field_path" binding:"required"`
	MaskType    string `json:"mask_type" binding:"required"`
	MaskPattern string `json:"mask_pattern"`
}

type UpdateRuleStatusRequest struct {
	Status MirrorRuleStatus `json:"status" binding:"required"`
}

type TargetEnvRequest struct {
	Name       string `json:"name" binding:"required"`
	BaseURL    string `json:"base_url" binding:"required"`
	AuthType   string `json:"auth_type"`
	AuthToken  string `json:"auth_token"`
	Headers    string `json:"headers"`
	TimeoutSec int    `json:"timeout_sec"`
	Enabled    bool   `json:"enabled"`
}

type QueryRequest struct {
	Page     int    `form:"page,default=1"`
	PageSize int    `form:"page_size,default=20"`
	Status   string `form:"status"`
	RuleID   string `form:"rule_id"`
	TraceID  string `form:"trace_id"`
}

func GenerateID() string {
	return uuid.New().String()
}
