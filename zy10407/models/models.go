package models

import (
	"time"
)

type ResponseStatus string

const (
	StatusSuccess   ResponseStatus = "SUCCESS"
	StatusPending   ResponseStatus = "PENDING_REVIEW"
	StatusBlocked   ResponseStatus = "BLOCKED"
	StatusCompensated ResponseStatus = "COMPENSATED"
)

type Service struct {
	ID          int64     `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
	IsActive    bool      `json:"is_active" db:"is_active"`
}

type SamplingRule struct {
	ID             int64                  `json:"id" db:"id"`
	ServiceName    string                 `json:"service_name" db:"service_name"`
	RuleName       string                 `json:"rule_name" db:"rule_name"`
	Description    string                 `json:"description" db:"description"`
	Priority       int                    `json:"priority" db:"priority"`
	SampleRate     float64                `json:"sample_rate" db:"sample_rate"`
	Tags           map[string]string      `json:"tags" db:"tags"`
	Status         string                 `json:"status" db:"status"`
	IdempotencyKey string                 `json:"idempotency_key" db:"idempotency_key"`
	CreatedAt      time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time              `json:"updated_at" db:"updated_at"`
	EffectiveStart *time.Time             `json:"effective_start" db:"effective_start"`
	EffectiveEnd   *time.Time             `json:"effective_end" db:"effective_end"`
}

type Budget struct {
	ID                int64     `json:"id" db:"id"`
	ServiceName       string    `json:"service_name" db:"service_name"`
	TotalBudget       int64     `json:"total_budget" db:"total_budget"`
	UsedBudget        int64     `json:"used_budget" db:"used_budget"`
	RemainingBudget   int64     `json:"remaining_budget" db:"remaining_budget"`
	CompensatedBudget int64     `json:"compensated_budget" db:"compensated_budget"`
	BudgetPeriod      string    `json:"budget_period" db:"budget_period"`
	StartDate         time.Time `json:"start_date" db:"start_date"`
	EndDate           time.Time `json:"end_date" db:"end_date"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time `json:"updated_at" db:"updated_at"`
}

type BudgetDeductRequest struct {
	TraceID        string            `json:"trace_id"`
	Tags           map[string]string `json:"tags"`
	DeductCount    int64             `json:"deduct_count"`
	IdempotencyKey string            `json:"idempotency_key"`
	Reason         string            `json:"reason"`
}

type BudgetDeductResponse struct {
	Status          ResponseStatus `json:"status"`
	Success         bool           `json:"success"`
	Message         string         `json:"message"`
	RemainingBudget int64          `json:"remaining_budget"`
	DeductedAmount  int64          `json:"deducted_amount"`
	TransactionID   string         `json:"transaction_id"`
}

type AdjustmentRequest struct {
	ID              int64     `json:"id" db:"id"`
	ServiceName     string    `json:"service_name" db:"service_name"`
	AdjustmentType  string    `json:"adjustment_type" db:"adjustment_type"`
	AdjustmentValue int64     `json:"adjustment_value" db:"adjustment_value"`
	Reason          string    `json:"reason" db:"reason"`
	Applicant       string    `json:"applicant" db:"applicant"`
	Approver        string    `json:"approver" db:"approver"`
	Status          string    `json:"status" db:"status"`
	IdempotencyKey  string    `json:"idempotency_key" db:"idempotency_key"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	ApprovedAt      *time.Time `json:"approved_at" db:"approved_at"`
}

type BudgetTransaction struct {
	ID              int64     `json:"id" db:"id"`
	ServiceName     string    `json:"service_name" db:"service_name"`
	TransactionType string    `json:"transaction_type" db:"transaction_type"`
	Amount          int64     `json:"amount" db:"amount"`
	TraceID         string    `json:"trace_id" db:"trace_id"`
	Tags            string    `json:"tags" db:"tags"`
	Reason          string    `json:"reason" db:"reason"`
	IdempotencyKey  string    `json:"idempotency_key" db:"idempotency_key"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
}

type ExceptionLog struct {
	ID                int64     `json:"id" db:"id"`
	ServiceName       string    `json:"service_name" db:"service_name"`
	Operation         string    `json:"operation" db:"operation"`
	RawInput          string    `json:"raw_input" db:"raw_input"`
	ErrorType         string    `json:"error_type" db:"error_type"`
	ErrorMessage      string    `json:"error_message" db:"error_message"`
	ProcessingConclusion string `json:"processing_conclusion" db:"processing_conclusion"`
	ResolutionStatus  string    `json:"resolution_status" db:"resolution_status"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
	ResolvedAt        *time.Time `json:"resolved_at" db:"resolved_at"`
}

type BudgetReport struct {
	ServiceName       string    `json:"service_name"`
	ReportPeriod      string    `json:"report_period"`
	TotalBudget       int64     `json:"total_budget"`
	UsedBudget        int64     `json:"used_budget"`
	RemainingBudget   int64     `json:"remaining_budget"`
	CompensatedBudget int64     `json:"compensated_budget"`
	UtilizationRate   float64   `json:"utilization_rate"`
	AdjustmentCount   int       `json:"adjustment_count"`
	ExceptionCount    int       `json:"exception_count"`
	GeneratedAt       time.Time `json:"generated_at"`
	TopTraces         []TraceSummary `json:"top_traces"`
}

type TraceSummary struct {
	TraceID string `json:"trace_id"`
	Count   int64  `json:"count"`
}

type ManualCorrectionRequest struct {
	CorrectionType  string `json:"correction_type"`
	AdjustmentValue int64  `json:"adjustment_value"`
	Reason          string `json:"reason"`
	Operator        string `json:"operator"`
}

type ApiResponse struct {
	Status    ResponseStatus `json:"status"`
	Message   string         `json:"message"`
	Data      interface{}    `json:"data,omitempty"`
	ErrorCode string         `json:"error_code,omitempty"`
}
