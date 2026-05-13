package model

import "time"

type CreateBudgetRequest struct {
	ServiceID      string        `json:"service_id" binding:"required"`
	ServiceName    string        `json:"service_name"`
	TotalBudget    int           `json:"total_budget" binding:"required,min=1"`
	WindowDuration time.Duration `json:"window_duration" binding:"required"`
	FreezeThreshold int          `json:"freeze_threshold"`
}

type CreateBudgetResponse struct {
	BudgetID       string        `json:"budget_id"`
	ServiceID      string        `json:"service_id"`
	TotalBudget    int           `json:"total_budget"`
	RemainingBudget int          `json:"remaining_budget"`
	Status         ServiceStatus `json:"status"`
	WindowID       string        `json:"window_id"`
}

type DeductBudgetRequest struct {
	RequestID    string       `json:"request_id" binding:"required"`
	BudgetID     string       `json:"budget_id" binding:"required"`
	Source       DeductSource `json:"source" binding:"required"`
	Amount       int          `json:"amount" binding:"required,min=1"`
	ErrorMessage string       `json:"error_message"`
	Endpoint     string       `json:"endpoint"`
}

type DeductBudgetResponse struct {
	Success         bool          `json:"success"`
	DeductEventID   string        `json:"deduct_event_id"`
	RemainingBudget int           `json:"remaining_budget"`
	Status          ServiceStatus `json:"status"`
	WasFrozen       bool          `json:"was_frozen"`
	Message         string        `json:"message"`
}

type CreateExemptionRequest struct {
	DeductEventID    string `json:"deduct_event_id" binding:"required"`
	BudgetID         string `json:"budget_id" binding:"required"`
	Reason           string `json:"reason" binding:"required"`
	RequestedBy      string `json:"requested_by" binding:"required"`
	CompensateAmount int    `json:"compensate_amount" binding:"required,min=1"`
}

type ReviewExemptionRequest struct {
	ExemptionID string          `json:"exemption_id" binding:"required"`
	BudgetID    string          `json:"budget_id" binding:"required"`
	Status      ExemptionStatus `json:"status" binding:"required"`
	ReviewedBy  string          `json:"reviewed_by" binding:"required"`
}

type FreezeServiceRequest struct {
	BudgetID    string       `json:"budget_id" binding:"required"`
	Reason      FreezeReason `json:"reason" binding:"required"`
	Description string       `json:"description"`
	FrozenBy    string       `json:"frozen_by" binding:"required"`
}

type UnfreezeServiceRequest struct {
	BudgetID   string `json:"budget_id" binding:"required"`
	UnfrozenBy string `json:"unfrozen_by" binding:"required"`
}

type BudgetStatusResponse struct {
	BudgetID        string        `json:"budget_id"`
	ServiceID       string        `json:"service_id"`
	TotalBudget     int           `json:"total_budget"`
	RemainingBudget int           `json:"remaining_budget"`
	BudgetUsed      int           `json:"budget_used"`
	UsagePercent    float64       `json:"usage_percent"`
	Status          ServiceStatus `json:"status"`
	IsFrozen        bool          `json:"is_frozen"`
	CurrentWindow   WindowInfo    `json:"current_window"`
}

type WindowInfo struct {
	WindowID   string    `json:"window_id"`
	StartTime  time.Time `json:"start_time"`
	EndTime    time.Time `json:"end_time"`
	TotalCalls int       `json:"total_calls"`
	ErrorCount int       `json:"error_count"`
	Deducted   int       `json:"deducted"`
}

type TimelineResponse struct {
	Entries []TimelineEntry `json:"entries"`
	Total   int             `json:"total"`
}

type ExportRequest struct {
	BudgetID  string     `json:"budget_id"`
	StartTime *time.Time `json:"start_time"`
	EndTime   *time.Time `json:"end_time"`
}

type ExportResponse struct {
	Summary     BudgetSummary    `json:"summary"`
	Deducts     []DeductEvent    `json:"deducts"`
	Exemptions  []Exemption      `json:"exemptions"`
	Freezes     []FreezeAction   `json:"freezes"`
	Windows     []RequestWindow  `json:"windows"`
	Timeline    []TimelineEntry  `json:"timeline"`
}

type BudgetSummary struct {
	BudgetID           string        `json:"budget_id"`
	ServiceID          string        `json:"service_id"`
	TotalBudget        int           `json:"total_budget"`
	RemainingBudget    int           `json:"remaining_budget"`
	TotalDeducted      int           `json:"total_deducted"`
	TotalCompensated   int           `json:"total_compensated"`
	NetUsed            int           `json:"net_used"`
	FreezeCount        int           `json:"freeze_count"`
	ExemptionCount     int           `json:"exemption_count"`
	ExemptionApproved  int           `json:"exemption_approved"`
	WindowCount        int           `json:"window_count"`
	Status             ServiceStatus `json:"status"`
	ExportTime         time.Time     `json:"export_time"`
}

type ErrorResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}
