package model

import (
	"time"

	"github.com/google/uuid"
)

type ServiceStatus string

const (
	ServiceStatusActive   ServiceStatus = "active"
	ServiceStatusFrozen   ServiceStatus = "frozen"
	ServiceStatusDegraded ServiceStatus = "degraded"
)

type ExemptionStatus string

const (
	ExemptionStatusPending  ExemptionStatus = "pending"
	ExemptionStatusApproved ExemptionStatus = "approved"
	ExemptionStatusRejected ExemptionStatus = "rejected"
)

type DeductSource string

const (
	DeductSourceAPIError  DeductSource = "api_error"
	DeductSourceTimeout   DeductSource = "timeout"
	DeductSourceRateLimit DeductSource = "rate_limit"
)

type FreezeReason string

const (
	FreezeReasonBudgetExhausted FreezeReason = "budget_exhausted"
	FreezeReasonManual          FreezeReason = "manual"
	FreezeReasonSecurity        FreezeReason = "security"
)

type TimelineAction string

const (
	TimelineActionBudgetCreated    TimelineAction = "budget_created"
	TimelineActionBudgetUpdated    TimelineAction = "budget_updated"
	TimelineActionDeductApplied    TimelineAction = "deduct_applied"
	TimelineActionExemptionCreated TimelineAction = "exemption_created"
	TimelineActionExemptionApproved TimelineAction = "exemption_approved"
	TimelineActionExemptionRejected TimelineAction = "exemption_rejected"
	TimelineActionServiceFrozen    TimelineAction = "service_frozen"
	TimelineActionServiceUnfrozen  TimelineAction = "service_unfrozen"
	TimelineActionWindowRolled     TimelineAction = "window_rolled"
)

type ServiceInterface struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Endpoint    string        `json:"endpoint"`
	Method      string        `json:"method"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
}

type ErrorBudget struct {
	ID             string        `json:"id"`
	ServiceID      string        `json:"service_id"`
	TotalBudget    int           `json:"total_budget"`
	RemainingBudget int          `json:"remaining_budget"`
	WindowDuration time.Duration `json:"window_duration"`
	FreezeThreshold int          `json:"freeze_threshold"`
	Status         ServiceStatus `json:"status"`
	CurrentWindowID string        `json:"current_window_id"`
	CreatedAt      time.Time     `json:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at"`
}

type RequestWindow struct {
	ID         string    `json:"id"`
	BudgetID   string    `json:"budget_id"`
	StartTime  time.Time `json:"start_time"`
	EndTime    time.Time `json:"end_time"`
	TotalCalls int       `json:"total_calls"`
	ErrorCount int       `json:"error_count"`
	Deducted   int       `json:"deducted"`
	IsActive   bool      `json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type DeductEvent struct {
	ID             string       `json:"id"`
	BudgetID       string       `json:"budget_id"`
	WindowID       string       `json:"window_id"`
	RequestID      string       `json:"request_id"`
	Source         DeductSource `json:"source"`
	Amount         int          `json:"amount"`
	ErrorMessage   string       `json:"error_message"`
	Endpoint       string       `json:"endpoint"`
	Timestamp      time.Time    `json:"timestamp"`
	ExemptionID    *string      `json:"exemption_id,omitempty"`
	IsCompensated  bool         `json:"is_compensated"`
	CompensationID *string      `json:"compensation_id,omitempty"`
}

type Exemption struct {
	ID             string          `json:"id"`
	DeductEventID  string          `json:"deduct_event_id"`
	BudgetID       string          `json:"budget_id"`
	Reason         string          `json:"reason"`
	RequestedBy    string          `json:"requested_by"`
	ApprovedBy     *string         `json:"approved_by,omitempty"`
	Status         ExemptionStatus `json:"status"`
	CompensateAmount int           `json:"compensate_amount"`
	RequestedAt    time.Time       `json:"requested_at"`
	ReviewedAt     *time.Time      `json:"reviewed_at,omitempty"`
}

type FreezeAction struct {
	ID            string       `json:"id"`
	BudgetID      string       `json:"budget_id"`
	Reason        FreezeReason `json:"reason"`
	Description   string       `json:"description"`
	FrozenBy      string       `json:"frozen_by"`
	UnfrozenBy    *string      `json:"unfrozen_by,omitempty"`
	IsFrozen      bool         `json:"is_frozen"`
	FrozenAt      time.Time    `json:"frozen_at"`
	UnfrozenAt    *time.Time   `json:"unfrozen_at,omitempty"`
}

type TimelineEntry struct {
	ID         string         `json:"id"`
	BudgetID   string         `json:"budget_id"`
	Action     TimelineAction `json:"action"`
	EntityID   string         `json:"entity_id"`
	EntityType string         `json:"entity_type"`
	Details    map[string]interface{} `json:"details"`
	CreatedAt  time.Time      `json:"created_at"`
}

type Compensation struct {
	ID            string    `json:"id"`
	BudgetID      string    `json:"budget_id"`
	DeductEventID string    `json:"deduct_event_id"`
	ExemptionID   string    `json:"exemption_id"`
	Amount        int       `json:"amount"`
	Reason        string    `json:"reason"`
	PerformedBy   string    `json:"performed_by"`
	CreatedAt     time.Time `json:"created_at"`
}

func NewID() string {
	return uuid.New().String()
}

func Now() time.Time {
	return time.Now().UTC()
}
