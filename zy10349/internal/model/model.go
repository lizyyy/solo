package model

import (
	"time"
)

type StrategyStatus string

const (
	StrategyStatusEnabled  StrategyStatus = "enabled"
	StrategyStatusDisabled StrategyStatus = "disabled"
)

type OperationType string

const (
	OperationTypeRead  OperationType = "read"
	OperationTypeWrite OperationType = "write"
)

type HitStatus string

const (
	HitStatusPending  HitStatus = "pending"
	HitStatusCorrect  HitStatus = "correct"
	HitStatusIncorrect HitStatus = "incorrect"
	HitStatusRevoked  HitStatus = "revoked"
)

type CorrectionAction string

const (
	CorrectionActionNone    CorrectionAction = "none"
	CorrectionActionAdjust  CorrectionAction = "adjust"
	CorrectionActionBlock   CorrectionAction = "block"
	CorrectionActionManual  CorrectionAction = "manual"
)

type Strategy struct {
	ID            string            `json:"id" db:"id"`
	Path          string            `json:"path" db:"path"`
	Method        string            `json:"method" db:"method"`
	QueryParams   map[string]string `json:"query_params" db:"query_params"`
	OperationType OperationType     `json:"operation_type" db:"operation_type"`
	DBRole        string            `json:"db_role" db:"db_role"`
	Description   string            `json:"description" db:"description"`
	Status        StrategyStatus    `json:"status" db:"status"`
	Priority      int               `json:"priority" db:"priority"`
	CreatedAt     time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at" db:"updated_at"`
}

type HitRecord struct {
	ID               string           `json:"id" db:"id"`
	RequestID        string           `json:"request_id" db:"request_id"`
	StrategyID       string           `json:"strategy_id" db:"strategy_id"`
	Path             string           `json:"path" db:"path"`
	Method           string           `json:"method" db:"method"`
	QueryParams      map[string]string `json:"query_params" db:"query_params"`
	MatchedOperation OperationType    `json:"matched_operation" db:"matched_operation"`
	ActualOperation  OperationType    `json:"actual_operation" db:"actual_operation"`
	DBRoleUsed       string           `json:"db_role_used" db:"db_role_used"`
	Status           HitStatus        `json:"status" db:"status"`
	CorrectionAction CorrectionAction `json:"correction_action" db:"correction_action"`
	CorrectionNote   string           `json:"correction_note" db:"correction_note"`
	CorrectedBy      string           `json:"corrected_by" db:"corrected_by"`
	CorrectedAt      *time.Time       `json:"corrected_at" db:"corrected_at"`
	CreatedAt        time.Time        `json:"created_at" db:"created_at"`
}

type SplitReport struct {
	TotalHits          int            `json:"total_hits"`
	CorrectHits        int            `json:"correct_hits"`
	IncorrectHits      int            `json:"incorrect_hits"`
	PendingHits        int            `json:"pending_hits"`
	RevokedHits        int            `json:"revoked_hits"`
	AccuracyRate       float64        `json:"accuracy_rate"`
	StrategyBreakdown  map[string]int `json:"strategy_breakdown"`
	OperationBreakdown map[string]int `json:"operation_breakdown"`
	TimeRange          struct {
		Start time.Time `json:"start"`
		End   time.Time `json:"end"`
	} `json:"time_range"`
}

type CreateStrategyRequest struct {
	Path          string            `json:"path" binding:"required"`
	Method        string            `json:"method" binding:"required"`
	QueryParams   map[string]string `json:"query_params"`
	OperationType OperationType     `json:"operation_type" binding:"required"`
	DBRole        string            `json:"db_role" binding:"required"`
	Description   string            `json:"description"`
	Priority      int               `json:"priority"`
}

type UpdateStrategyStatusRequest struct {
	Status StrategyStatus `json:"status" binding:"required"`
}

type ProcessRequest struct {
	Path        string            `json:"path" binding:"required"`
	Method      string            `json:"method" binding:"required"`
	QueryParams map[string]string `json:"query_params"`
	RequestID   string            `json:"request_id"`
}

type ProcessResponse struct {
	RequestID        string        `json:"request_id"`
	HitRecordID      string        `json:"hit_record_id"`
	Matched          bool          `json:"matched"`
	StrategyID       string        `json:"strategy_id,omitempty"`
	OperationType    OperationType `json:"operation_type"`
	DBRole           string        `json:"db_role"`
	Status           HitStatus     `json:"status"`
	NeedCorrection   bool          `json:"need_correction"`
	Message          string        `json:"message"`
}

type CorrectionRequest struct {
	Action CorrectionAction `json:"action" binding:"required"`
	Note   string           `json:"note"`
	UserID string           `json:"user_id" binding:"required"`
}

type AdvanceStatusRequest struct {
	Status   HitStatus `json:"status" binding:"required"`
	UserID   string    `json:"user_id" binding:"required"`
	Note     string    `json:"note"`
}

type QueryHitRecordsRequest struct {
	StrategyID string     `json:"strategy_id"`
	Status     HitStatus  `json:"status"`
	Path       string     `json:"path"`
	StartTime  *time.Time `json:"start_time"`
	EndTime    *time.Time `json:"end_time"`
	Page       int        `json:"page"`
	PageSize   int        `json:"page_size"`
}

type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Total      int64       `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
	TotalPages int         `json:"total_pages"`
}

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}
