package models

import (
	"time"
)

type ArbitrationStatus string

const (
	StatusCreated    ArbitrationStatus = "created"
	StatusValidating ArbitrationStatus = "validating"
	StatusBlocked    ArbitrationStatus = "blocked"
	StatusProcessing ArbitrationStatus = "processing"
	StatusAppealing  ArbitrationStatus = "appealing"
	StatusClosed     ArbitrationStatus = "closed"
)

type DamageType string

const (
	DamageTypeScratch DamageType = "scratch"
	DamageTypeDent    DamageType = "dent"
	DamageTypeCrack   DamageType = "crack"
	DamageTypeOther   DamageType = "other"
)

type Arbitration struct {
	ID          int64             `json:"id" db:"id"`
	OrderID     string            `json:"order_id" db:"order_id"`
	VehicleID   string            `json:"vehicle_id" db:"vehicle_id"`
	UserID      string            `json:"user_id" db:"user_id"`
	Status      ArbitrationStatus `json:"status" db:"status"`
	PickupTime  *time.Time        `json:"pickup_time" db:"pickup_time"`
	ReturnTime  *time.Time        `json:"return_time" db:"return_time"`
	HandlerID   *string           `json:"handler_id" db:"handler_id"`
	HandlerName *string           `json:"handler_name" db:"handler_name"`
	CreatedAt   time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at" db:"updated_at"`
}

type DamageDetail struct {
	ID              int64      `json:"id" db:"id"`
	ArbitrationID   int64      `json:"arbitration_id" db:"arbitration_id"`
	DamageType      DamageType `json:"damage_type" db:"damage_type"`
	Location        string     `json:"location" db:"location"`
	Severity        string     `json:"severity" db:"severity"`
	Description     string     `json:"description" db:"description"`
	IsNew           bool       `json:"is_new" db:"is_new"`
	DeductAmount    float64    `json:"deduct_amount" db:"deduct_amount"`
	FeeCharged      bool       `json:"fee_charged" db:"fee_charged"`
	MatchedDamageID *int64     `json:"matched_damage_id" db:"matched_damage_id"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at" db:"updated_at"`
}

type Photo struct {
	ID            int64     `json:"id" db:"id"`
	ArbitrationID int64     `json:"arbitration_id" db:"arbitration_id"`
	PhotoType     string    `json:"photo_type" db:"photo_type"`
	PhotoURL      string    `json:"photo_url" db:"photo_url"`
	PhotoTime     time.Time `json:"photo_time" db:"photo_time"`
	DamageID      *int64    `json:"damage_id" db:"damage_id"`
	Remark        string    `json:"remark" db:"remark"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

type Appeal struct {
	ID            int64      `json:"id" db:"id"`
	ArbitrationID int64      `json:"arbitration_id" db:"arbitration_id"`
	UserID        string     `json:"user_id" db:"user_id"`
	Content       string     `json:"content" db:"content"`
	EvidenceURLs  []string   `json:"evidence_urls" db:"evidence_urls"`
	SubmittedAt   time.Time  `json:"submitted_at" db:"submitted_at"`
	HandlerID     *string    `json:"handler_id" db:"handler_id"`
	HandlerRemark *string    `json:"handler_remark" db:"handler_remark"`
	IsApproved    *bool      `json:"is_approved" db:"is_approved"`
	RefundAmount  *float64   `json:"refund_amount" db:"refund_amount"`
	HandledAt     *time.Time `json:"handled_at" db:"handled_at"`
}

type ProcessingLog struct {
	ID            int64     `json:"id" db:"id"`
	ArbitrationID int64     `json:"arbitration_id" db:"arbitration_id"`
	Action        string    `json:"action" db:"action"`
	OperatorID    string    `json:"operator_id" db:"operator_id"`
	OperatorName  string    `json:"operator_name" db:"operator_name"`
	OldStatus     string    `json:"old_status" db:"old_status"`
	NewStatus     string    `json:"new_status" db:"new_status"`
	Remark        string    `json:"remark" db:"remark"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

type ChangeDiff struct {
	ID            int64     `json:"id" db:"id"`
	ArbitrationID int64     `json:"arbitration_id" db:"arbitration_id"`
	TableName     string    `json:"table_name" db:"table_name"`
	RecordID      int64     `json:"record_id" db:"record_id"`
	FieldName     string    `json:"field_name" db:"field_name"`
	OldValue      *string   `json:"old_value" db:"old_value"`
	NewValue      *string   `json:"new_value" db:"new_value"`
	OperatorID    string    `json:"operator_id" db:"operator_id"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

type Conclusion struct {
	ID            int64     `json:"id" db:"id"`
	ArbitrationID int64     `json:"arbitration_id" db:"arbitration_id"`
	FinalResult   string    `json:"final_result" db:"final_result"`
	FinalRemark   string    `json:"final_remark" db:"final_remark"`
	RefundAmount  float64   `json:"refund_amount" db:"refund_amount"`
	HandlerID     string    `json:"handler_id" db:"handler_id"`
	HandlerName   string    `json:"handler_name" db:"handler_name"`
	ClosedAt      time.Time `json:"closed_at" db:"closed_at"`
}

type ValidationResult struct {
	Valid    bool     `json:"valid"`
	Issues   []string `json:"issues"`
	Warnings []string `json:"warnings"`
}

type DamageMatchResult struct {
	IsDuplicate     bool    `json:"is_duplicate"`
	MatchedDamageID int64   `json:"matched_damage_id"`
	Similarity      float64 `json:"similarity"`
	Remark          string  `json:"remark"`
}
