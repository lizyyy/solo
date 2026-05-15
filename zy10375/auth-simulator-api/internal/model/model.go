package model

import (
	"time"
)

type SimulationStatus string

const (
	StatusCreated    SimulationStatus = "CREATED"
	StatusValidating SimulationStatus = "VALIDATING"
	StatusSuccess    SimulationStatus = "SUCCESS"
	StatusFailed     SimulationStatus = "FAILED"
	StatusActivated  SimulationStatus = "ACTIVATED"
)

type RiskLevel string

const (
	RiskLevelLow    RiskLevel = "LOW"
	RiskLevelMedium RiskLevel = "MEDIUM"
	RiskLevelHigh   RiskLevel = "HIGH"
)

type Partner struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Code        string    `json:"code"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

type PermissionScope struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Code        string   `json:"code"`
	Description string   `json:"description"`
	Resources   []string `json:"resources"`
	ParentID    string   `json:"parent_id,omitempty"`
}

type ResourceSample struct {
	ID          string      `json:"id"`
	ScopeCode   string      `json:"scope_code"`
	ResourceURI string      `json:"resource_uri"`
	Method      string      `json:"method"`
	SampleData  interface{} `json:"sample_data"`
	Description string      `json:"description"`
}

type RiskAlert struct {
	ID        string    `json:"id"`
	Level     RiskLevel `json:"level"`
	Code      string    `json:"code"`
	Message   string    `json:"message"`
	Detail    string    `json:"detail"`
	Suggestion string   `json:"suggestion"`
}

type ActivationCredential struct {
	ID             string    `json:"id"`
	SimulationID   string    `json:"simulation_id"`
	Token          string    `json:"token"`
	ExpiredAt      time.Time `json:"expired_at"`
	ActivatedAt    time.Time `json:"activated_at,omitempty"`
	ActivationIP   string    `json:"activation_ip,omitempty"`
}

type SimulationResult struct {
	ID                string              `json:"id"`
	IdempotencyKey    string              `json:"idempotency_key"`
	PartnerID         string              `json:"partner_id"`
	RequestedScopes   []string            `json:"requested_scopes"`
	ResolvedScopes    []PermissionScope   `json:"resolved_scopes,omitempty"`
	ResourceSamples   []ResourceSample    `json:"resource_samples,omitempty"`
	RiskAlerts        []RiskAlert         `json:"risk_alerts,omitempty"`
	Status            SimulationStatus    `json:"status"`
	ErrorCode         string              `json:"error_code,omitempty"`
	ErrorMessage      string              `json:"error_message,omitempty"`
	ErrorDetail       string              `json:"error_detail,omitempty"`
	Credential        *ActivationCredential `json:"credential,omitempty"`
	CreatedAt         time.Time           `json:"created_at"`
	UpdatedAt         time.Time           `json:"updated_at"`
}

type CreateSimulationRequest struct {
	IdempotencyKey string   `json:"idempotency_key" binding:"required"`
	PartnerID      string   `json:"partner_id" binding:"required"`
	RequestedScopes []string `json:"requested_scopes" binding:"required,min=1"`
}

type ValidateSimulationRequest struct {
	SimulationID string `json:"simulation_id" binding:"required"`
}

type ActivateSimulationRequest struct {
	SimulationID string `json:"simulation_id" binding:"required"`
}

type ApiResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type ErrorResponse struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Detail  interface{} `json:"detail,omitempty"`
}

type QueryHistoryRequest struct {
	PartnerID  string           `form:"partner_id"`
	Status     SimulationStatus `form:"status"`
	Page       int              `form:"page,default=1"`
	PageSize   int              `form:"page_size,default=10"`
	StartTime  time.Time        `form:"start_time"`
	EndTime    time.Time        `form:"end_time"`
}

type HistoryResponse struct {
	Total   int64              `json:"total"`
	Page    int                `json:"page"`
	PageSize int                `json:"page_size"`
	Items   []SimulationResult `json:"items"`
}
