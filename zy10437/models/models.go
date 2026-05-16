package models

import (
	"time"
)

type DriftStatus string

const (
	StatusPendingReview DriftStatus = "PENDING_REVIEW"
	StatusApproved      DriftStatus = "APPROVED"
	StatusRejected      DriftStatus = "REJECTED"
	StatusExpired       DriftStatus = "EXPIRED"
	StatusCompensated   DriftStatus = "COMPENSATED"
	StatusBlocked       DriftStatus = "BLOCKED"
)

type ApiResultCode string

const (
	ResultSuccess       ApiResultCode = "SUCCESS"
	ResultPendingReview ApiResultCode = "PENDING_REVIEW"
	ResultBlocked       ApiResultCode = "BLOCKED"
	ResultCompensated   ApiResultCode = "COMPENSATED"
)

type ConfigDriftRecord struct {
	ID              int64       `json:"id" db:"id"`
	ServiceName     string      `json:"service_name" db:"service_name"`
	ConfigKey       string      `json:"config_key" db:"config_key"`
	ExpectedValue   string      `json:"expected_value" db:"expected_value"`
	ActualValue     string      `json:"actual_value" db:"actual_value"`
	DriftHash       string      `json:"drift_hash" db:"drift_hash"`
	Reason          string      `json:"reason" db:"reason"`
	Reporter        string      `json:"reporter" db:"reporter"`
	Status          DriftStatus `json:"status" db:"status"`
	Reviewer        string      `json:"reviewer,omitempty" db:"reviewer"`
	ReviewComment   string      `json:"review_comment,omitempty" db:"review_comment"`
	ExemptionExpiry time.Time   `json:"exemption_expiry" db:"exemption_expiry"`
	ReportData      string      `json:"report_data,omitempty" db:"report_data"`
	RawInput        string      `json:"raw_input,omitempty" db:"raw_input"`
	ProcessingNote  string      `json:"processing_note,omitempty" db:"processing_note"`
	CompensationLog string      `json:"compensation_log,omitempty" db:"compensation_log"`
	CreatedAt       time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at" db:"updated_at"`
	ReviewedAt      *time.Time  `json:"reviewed_at,omitempty" db:"reviewed_at"`
}

type CreateDriftRequest struct {
	ServiceName     string    `json:"service_name" binding:"required"`
	ConfigKey       string    `json:"config_key" binding:"required"`
	ExpectedValue   string    `json:"expected_value" binding:"required"`
	ActualValue     string    `json:"actual_value" binding:"required"`
	Reason          string    `json:"reason" binding:"required"`
	Reporter        string    `json:"reporter" binding:"required"`
	ExemptionExpiry time.Time `json:"exemption_expiry" binding:"required"`
	ReportData      string    `json:"report_data"`
	RawInput        string    `json:"raw_input"`
}

type ApiResponse struct {
	Code    ApiResultCode `json:"code"`
	Message string        `json:"message"`
	Data    interface{}   `json:"data,omitempty"`
}

type ReviewRequest struct {
	Status        DriftStatus `json:"status" binding:"required"`
	Reviewer      string      `json:"reviewer" binding:"required"`
	ReviewComment string      `json:"review_comment"`
}

type ManualFixRequest struct {
	NewExpectedValue string `json:"new_expected_value"`
	NewActualValue   string `json:"new_actual_value"`
	FixReason        string `json:"fix_reason" binding:"required"`
	Operator         string `json:"operator" binding:"required"`
}

type QueryFilter struct {
	ServiceName string      `json:"service_name"`
	ConfigKey   string      `json:"config_key"`
	Status      DriftStatus `json:"status"`
	Reporter    string      `json:"reporter"`
	Reviewer    string      `json:"reviewer"`
	IsExpired   *bool       `json:"is_expired"`
	Page        int         `json:"page"`
	PageSize    int         `json:"page_size"`
}

type ExportRecord struct {
	ID              int64     `json:"id"`
	ServiceName     string    `json:"service_name"`
	ConfigKey       string    `json:"config_key"`
	ExpectedValue   string    `json:"expected_value"`
	ActualValue     string    `json:"actual_value"`
	DiffType        string    `json:"diff_type"`
	Reason          string    `json:"reason"`
	Reporter        string    `json:"reporter"`
	Status          string    `json:"status"`
	Reviewer        string    `json:"reviewer"`
	ExemptionExpiry time.Time `json:"exemption_expiry"`
	CreatedAt       time.Time `json:"created_at"`
}

type DriftHistory struct {
	ID            int64     `json:"id"`
	DriftID       int64     `json:"drift_id"`
	Action        string    `json:"action"`
	OldStatus     string    `json:"old_status"`
	NewStatus     string    `json:"new_status"`
	Operator      string    `json:"operator"`
	ChangeComment string    `json:"change_comment"`
	ChangedAt     time.Time `json:"changed_at"`
}
