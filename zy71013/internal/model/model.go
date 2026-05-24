package model

import (
	"time"
)

type ReagentStatus string

const (
	StatusFrozen    ReagentStatus = "frozen"
	StatusThawed    ReagentStatus = "thawed"
	StatusInUse     ReagentStatus = "in_use"
	StatusExpired   ReagentStatus = "expired"
	StatusDiscarded ReagentStatus = "discarded"
)

type Reagent struct {
	ID           int64         `json:"id" db:"id"`
	BatchNo      string        `json:"batch_no" db:"batch_no"`
	ReagentType  string        `json:"reagent_type" db:"reagent_type"`
	Status       ReagentStatus `json:"status" db:"status"`
	ThawedAt     *time.Time    `json:"thawed_at,omitempty" db:"thawed_at"`
	ThawedBy     string        `json:"thawed_by,omitempty" db:"thawed_by"`
	Project      string        `json:"project,omitempty" db:"project"`
	ExpireAt     *time.Time    `json:"expire_at,omitempty" db:"expire_at"`
	DiscardedAt  *time.Time    `json:"discarded_at,omitempty" db:"discarded_at"`
	DiscardedBy  string        `json:"discarded_by,omitempty" db:"discarded_by"`
	DiscardReason string       `json:"discard_reason,omitempty" db:"discard_reason"`
	CreatedAt    time.Time     `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at" db:"updated_at"`
	RequestID    string        `json:"-" db:"request_id"`
}

type ThawRequest struct {
	RequestID   string `json:"request_id" binding:"required"`
	BatchNo     string `json:"batch_no" binding:"required"`
	ReagentType string `json:"reagent_type" binding:"required"`
	ThawedBy    string `json:"thawed_by" binding:"required"`
	Project     string `json:"project"`
}

type UsageRequest struct {
	RequestID string `json:"request_id" binding:"required"`
	BatchNo   string `json:"batch_no" binding:"required"`
	UsedBy    string `json:"used_by" binding:"required"`
	Project   string `json:"project" binding:"required"`
	Volume    string `json:"volume"`
	Notes     string `json:"notes"`
}

type UsageRecord struct {
	ID        int64     `json:"id" db:"id"`
	ReagentID int64     `json:"reagent_id" db:"reagent_id"`
	BatchNo   string    `json:"batch_no" db:"batch_no"`
	UsedBy    string    `json:"used_by" db:"used_by"`
	Project   string    `json:"project" db:"project"`
	Volume    string    `json:"volume" db:"volume"`
	Notes     string    `json:"notes" db:"notes"`
	UsedAt    time.Time `json:"used_at" db:"used_at"`
	RequestID string    `json:"-" db:"request_id"`
}

type DiscardRequest struct {
	RequestID string `json:"request_id" binding:"required"`
	BatchNo   string `json:"batch_no" binding:"required"`
	DiscardedBy string `json:"discarded_by" binding:"required"`
	Reason    string `json:"reason" binding:"required"`
}

type ProcessingOrder struct {
	ID            int64     `json:"id" db:"id"`
	OrderNo       string    `json:"order_no" db:"order_no"`
	BatchNo       string    `json:"batch_no" db:"batch_no"`
	Type          string    `json:"type" db:"type"`
	Status        string    `json:"status" db:"status"`
	CreatedBy     string    `json:"created_by" db:"created_by"`
	ReviewedBy    string    `json:"reviewed_by,omitempty" db:"reviewed_by"`
	ReviewNotes   string    `json:"review_notes,omitempty" db:"review_notes"`
	ReviewedAt    *time.Time `json:"reviewed_at,omitempty" db:"reviewed_at"`
	NeedsReview   bool               `json:"needs_review" db:"needs_review"`
	CreatedAt     time.Time          `json:"created_at" db:"created_at"`
	RequestID     string             `json:"-" db:"request_id"`
	JudgmentHistory []JudgmentHistory `json:"judgment_history,omitempty"`
}

type JudgmentHistory struct {
	ID          int64     `json:"id" db:"id"`
	OrderID     int64     `json:"order_id" db:"order_id"`
	OrderNo     string    `json:"order_no" db:"order_no"`
	Judgment    string    `json:"judgment" db:"judgment"`
	JudgedBy    string    `json:"judged_by" db:"judged_by"`
	Notes       string    `json:"notes,omitempty" db:"notes"`
	JudgedAt    time.Time `json:"judged_at" db:"judged_at"`
	RequestID   string    `json:"-" db:"request_id"`
}

type JudgmentRequest struct {
	RequestID   string `json:"request_id" binding:"required"`
	OrderNo     string `json:"order_no" binding:"required"`
	Judgment    string `json:"judgment" binding:"required"`
	JudgedBy    string `json:"judged_by" binding:"required"`
	Notes       string `json:"notes"`
}

type SupplementRequest struct {
	RequestID string `json:"request_id" binding:"required"`
	OrderNo   string `json:"order_no" binding:"required"`
	Evidence  string `json:"evidence" binding:"required"`
	SubmittedBy string `json:"submitted_by" binding:"required"`
}

type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

const (
	ErrCodeMissingMaterial = "MISSING_MATERIAL"
	ErrCodeInvalidStatus   = "INVALID_STATUS"
	ErrCodeDuplicate       = "DUPLICATE_REQUEST"
	ErrCodeNeedsReview     = "NEEDS_REVIEW"
	ErrCodeExpired         = "EXPIRED"
	ErrCodeDiscarded       = "DISCARDED"
)
