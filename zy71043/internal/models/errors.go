package models

import "errors"

var (
	ErrMissingMaterial    = errors.New("missing_required_material")
	ErrInvalidState       = errors.New("invalid_state_for_operation")
	ErrDuplicateRequest   = errors.New("duplicate_request")
	ErrReviewRequired     = errors.New("review_required")
	ErrNotFound           = errors.New("resource_not_found")
	ErrValidationFailed   = errors.New("validation_failed")
	ErrBatchAlreadyExists = errors.New("batch_already_exists")
	ErrAreaNotFound       = errors.New("warehouse_area_not_found")
	ErrBatchNotFound      = errors.New("batch_not_found")
	ErrSampleNotFound     = errors.New("sample_not_found")
	ErrTransferNotFound   = errors.New("transfer_not_found")
	ErrInsufficientQty    = errors.New("insufficient_quantity")
	ErrAreaCapacityFull   = errors.New("area_capacity_full")
)

type ErrorResponse struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

const (
	SampleStatusPending    = "pending"
	SampleStatusNormal     = "normal"
	SampleStatusOverLimit  = "over_limit"
	SampleStatusProcessing = "processing"
	SampleStatusResolved   = "resolved"
	SampleStatusReviewed   = "reviewed"

	VentilationStatusPending  = "pending"
	VentilationStatusActive   = "active"
	VentilationStatusComplete = "completed"
	VentilationStatusReviewed = "reviewed"

	TransferStatusPending  = "pending"
	TransferStatusComplete = "completed"
	TransferStatusReviewed = "reviewed"
	TransferStatusUndone   = "undone"

	InspectionStatusPending  = "pending"
	InspectionStatusComplete = "completed"
	InspectionStatusReviewed = "reviewed"

	BatchStatusNormal    = "normal"
	BatchStatusInspected = "inspected"
	BatchStatusTransferred = "transferred"
	BatchStatusArchived  = "archived"

	AreaStatusActive   = "active"
	AreaStatusInactive = "inactive"

	RiskLevelNormal = "normal"
	RiskLevelLow    = "low"
	RiskLevelMedium = "medium"
	RiskLevelHigh   = "critical"

	ReportStatusGenerated = "generated"
	ReportStatusReviewed  = "reviewed"
)
