package model

import (
	"time"
)

type Environment string

const (
	EnvDev  Environment = "dev"
	EnvTest Environment = "test"
	EnvPre  Environment = "pre"
	EnvProd Environment = "prod"
)

type RiskLevel string

const (
	RiskLow    RiskLevel = "low"
	RiskMedium RiskLevel = "medium"
	RiskHigh   RiskLevel = "high"
	RiskCritical RiskLevel = "critical"
)

type SwitchStatus string

const (
	StatusPending  SwitchStatus = "pending"
	StatusApproved SwitchStatus = "approved"
	StatusExecuted SwitchStatus = "executed"
	StatusRejected SwitchStatus = "rejected"
	StatusFailed   SwitchStatus = "failed"
)

type Operator struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	Department string `json:"department"`
}

type SwitchItem struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Category    string      `json:"category"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

type ApprovalTicket struct {
	ID            string       `json:"id"`
	SwitchID      string       `json:"switch_id"`
	Environment   Environment  `json:"environment"`
	RiskLevel     RiskLevel    `json:"risk_level"`
	Operator      Operator     `json:"operator"`
	ChangeType    string       `json:"change_type"`
	TargetValue   interface{}  `json:"target_value"`
	Status        SwitchStatus `json:"status"`
	IdempotentKey string       `json:"idempotent_key"`
	Reason        string       `json:"reason,omitempty"`
	Approvers     []string     `json:"approvers,omitempty"`
	ApprovedAt    *time.Time   `json:"approved_at,omitempty"`
	ExecutedAt    *time.Time   `json:"executed_at,omitempty"`
	CreatedAt     time.Time    `json:"created_at"`
	UpdatedAt     time.Time    `json:"updated_at"`
}

type ChangeResult struct {
	ID            string      `json:"id"`
	TicketID      string      `json:"ticket_id"`
	SwitchID      string      `json:"switch_id"`
	Environment   Environment `json:"environment"`
	Operator      Operator    `json:"operator"`
	ChangeType    string      `json:"change_type"`
	OldValue      interface{} `json:"old_value"`
	NewValue      interface{} `json:"new_value"`
	Success       bool        `json:"success"`
	ErrorMessage  string      `json:"error_message,omitempty"`
	ExecutedAt    time.Time   `json:"executed_at"`
}

type MisuseReport struct {
	ID            string      `json:"id"`
	TicketID      string      `json:"ticket_id"`
	SwitchID      string      `json:"switch_id"`
	Environment   Environment `json:"environment"`
	Operator      Operator    `json:"operator"`
	RiskLevel     RiskLevel   `json:"risk_level"`
	Reason        string      `json:"reason"`
	ReportedAt    time.Time   `json:"reported_at"`
}

type CreateTicketRequest struct {
	IdempotentKey string      `json:"idempotent_key"`
	SwitchID       string      `json:"switch_id"`
	Environment    Environment `json:"environment"`
	RiskLevel      RiskLevel   `json:"risk_level"`
	OperatorID     string      `json:"operator_id"`
	OperatorName   string      `json:"operator_name"`
	OperatorEmail  string      `json:"operator_email"`
	ChangeType     string      `json:"change_type"`
	TargetValue    interface{} `json:"target_value"`
	Reason         string      `json:"reason"`
}

type ValidateRequest struct {
	TicketID string `json:"ticket_id"`
}

type ApproveRequest struct {
	TicketID   string `json:"ticket_id"`
	ApproverID string `json:"approver_id"`
}

type ExecuteRequest struct {
	TicketID string `json:"ticket_id"`
}

type ApiResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type ErrorResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

type HistoryQuery struct {
	SwitchID    *string     `json:"switch_id,omitempty"`
	OperatorID *string     `json:"operator_id,omitempty"`
	Environment *Environment `json:"environment,omitempty"`
	Status     *SwitchStatus `json:"status,omitempty"`
	StartTime  *time.Time   `json:"start_time,omitempty"`
	EndTime    *time.Time   `json:"end_time,omitempty"`
	Page       int          `json:"page"`
	PageSize   int          `json:"page_size"`
}
