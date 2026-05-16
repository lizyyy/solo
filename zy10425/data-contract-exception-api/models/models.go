package models

import (
	"time"
)

type ExceptionStatus string

const (
	StatusPending           ExceptionStatus = "PENDING"
	StatusActive            ExceptionStatus = "ACTIVE"
	StatusExpired           ExceptionStatus = "EXPIRED"
	StatusRecoveryRequested ExceptionStatus = "RECOVERY_REQUESTED"
	StatusRecoveryApproved  ExceptionStatus = "RECOVERY_APPROVED"
	StatusRecovered         ExceptionStatus = "RECOVERED"
	StatusRejected          ExceptionStatus = "REJECTED"
)

type DataContract struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name" gorm:"not null"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ExceptionRecord struct {
	ID               string          `json:"id" gorm:"primaryKey"`
	ContractID       string          `json:"contract_id" gorm:"not null;index"`
	FieldPath        string          `json:"field_path" gorm:"not null;index"`
	ExceptionReason  string          `json:"exception_reason" gorm:"not null"`
	CreatedBy        string          `json:"created_by" gorm:"not null"`
	ApprovedBy       string          `json:"approved_by"`
	ExpireDate       time.Time       `json:"expire_date" gorm:"not null;index"`
	Status           ExceptionStatus `json:"status" gorm:"not null;index"`
	HitCount         int             `json:"hit_count" gorm:"default:0"`
	LastHitAt        time.Time       `json:"last_hit_at"`
	RecoveryApprovedBy string        `json:"recovery_approved_by"`
	RecoveryApprovedAt time.Time     `json:"recovery_approved_at"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
}

type HitRecord struct {
	ID             string    `json:"id" gorm:"primaryKey"`
	ExceptionID    string    `json:"exception_id" gorm:"not null;index"`
	FieldPath      string    `json:"field_path" gorm:"not null"`
	ActualValue    string    `json:"actual_value"`
	ExpectedValue  string    `json:"expected_value"`
	HitTimestamp   time.Time `json:"hit_timestamp" gorm:"not null"`
	SourceSystem   string    `json:"source_system"`
	RequestID      string    `json:"request_id"`
	CreatedAt      time.Time `json:"created_at"`
}

type RecoveryReport struct {
	ID              string    `json:"id" gorm:"primaryKey"`
	ExceptionID     string    `json:"exception_id" gorm:"not null;index;unique"`
	TotalHits       int       `json:"total_hits"`
	FieldPath       string    `json:"field_path"`
	ExceptionReason string    `json:"exception_reason"`
	CreatedBy       string    `json:"created_by"`
	ExpireDate      time.Time `json:"expire_date"`
	RecoveryNotes   string    `json:"recovery_notes"`
	ApprovedBy      string    `json:"approved_by"`
	GeneratedAt     time.Time `json:"generated_at"`
}

type AnomalyRecord struct {
	ID               string    `json:"id" gorm:"primaryKey"`
	ExceptionID      string    `json:"exception_id" gorm:"index"`
	OperationType    string    `json:"operation_type" gorm:"not null"`
	RawInput         string    `json:"raw_input" gorm:"type:text"`
	ProcessingResult string    `json:"processing_result" gorm:"type:text"`
	ErrorMessage     string    `json:"error_message"`
	HandledBy        string    `json:"handled_by"`
	ResolutionNotes  string    `json:"resolution_notes"`
	IsResolved       bool      `json:"is_resolved" gorm:"default:false"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type CreateExceptionRequest struct {
	ContractID      string    `json:"contract_id" binding:"required"`
	FieldPath       string    `json:"field_path" binding:"required"`
	ExceptionReason string    `json:"exception_reason" binding:"required"`
	CreatedBy       string    `json:"created_by" binding:"required"`
	ExpireDate      time.Time `json:"expire_date" binding:"required"`
}

type ApproveExceptionRequest struct {
	ApprovedBy string `json:"approved_by" binding:"required"`
}

type RecordHitRequest struct {
	FieldPath     string `json:"field_path" binding:"required"`
	ActualValue   string `json:"actual_value"`
	ExpectedValue string `json:"expected_value"`
	SourceSystem  string `json:"source_system"`
	RequestID     string `json:"request_id"`
}

type RequestRecoveryRequest struct {
	RequestedBy   string `json:"requested_by" binding:"required"`
	RecoveryNotes string `json:"recovery_notes"`
}

type ApproveRecoveryRequest struct {
	ApprovedBy string `json:"approved_by" binding:"required"`
}

type ManualCorrectionRequest struct {
	NewStatus      ExceptionStatus `json:"new_status" binding:"required"`
	CorrectedBy    string          `json:"corrected_by" binding:"required"`
	CorrectionNote string          `json:"correction_note" binding:"required"`
}

type ResolveAnomalyRequest struct {
	HandledBy       string `json:"handled_by" binding:"required"`
	ResolutionNotes string `json:"resolution_notes" binding:"required"`
}
