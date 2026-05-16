package model

import (
	"time"
)

type EvidenceStatus string

const (
	StatusSuccess   EvidenceStatus = "success"
	StatusPending   EvidenceStatus = "pending"
	StatusBlocked   EvidenceStatus = "blocked"
	StatusCompensated EvidenceStatus = "compensated"
)

type IsolationAction string

const (
	IsolationNone   IsolationAction = "none"
	IsolationQuarantine IsolationAction = "quarantine"
	IsolationSuspend IsolationAction = "suspend"
	IsolationRelease IsolationAction = "release"
)

type DeviceEvidence struct {
	ID             string          `json:"id" db:"id"`
	DeviceID       string          `json:"device_id" db:"device_id"`
	FirmwareVersion string         `json:"firmware_version" db:"firmware_version"`
	ProofMaterial  *ProofMaterial  `json:"proof_material" db:"-"`
	ProofMaterialRaw string         `json:"-" db:"proof_material_raw"`
	StrategyResult *StrategyResult `json:"strategy_result" db:"-"`
	StrategyResultRaw string        `json:"-" db:"strategy_result_raw"`
	IsolationAction IsolationAction `json:"isolation_action" db:"isolation_action"`
	Status         EvidenceStatus  `json:"status" db:"status"`
	RawInput       string          `json:"raw_input,omitempty" db:"raw_input"`
	Conclusion     string          `json:"conclusion,omitempty" db:"conclusion"`
	CreatedAt      time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at" db:"updated_at"`
	Remark         string          `json:"remark,omitempty" db:"remark"`
	Operator       string          `json:"operator,omitempty" db:"operator"`
}

type ProofMaterial struct {
	Hash         string   `json:"hash"`
	Signatures   []string `json:"signatures"`
	Certificate  string   `json:"certificate"`
	Timestamp    int64    `json:"timestamp"`
	Measurements []string `json:"measurements"`
}

type StrategyResult struct {
	Passed       bool     `json:"passed"`
	Rules        []RuleResult `json:"rules"`
	RiskLevel    string   `json:"risk_level"`
	RecommendedAction string `json:"recommended_action"`
}

type RuleResult struct {
	RuleID   string `json:"rule_id"`
	RuleName string `json:"rule_name"`
	Passed   bool   `json:"passed"`
	Details  string `json:"details"`
}

type EvidenceReport struct {
	ID          string    `json:"id"`
	EvidenceID  string    `json:"evidence_id"`
	DeviceID    string    `json:"device_id"`
	ReportType  string    `json:"report_type"`
	Content     string    `json:"content"`
	GeneratedAt time.Time `json:"generated_at"`
}

type CreateEvidenceRequest struct {
	DeviceID       string          `json:"device_id" binding:"required"`
	FirmwareVersion string         `json:"firmware_version" binding:"required"`
	ProofMaterial  *ProofMaterial  `json:"proof_material" binding:"required"`
	StrategyResult *StrategyResult `json:"strategy_result"`
}

type QueryEvidenceRequest struct {
	DeviceID  string         `json:"device_id"`
	Status    EvidenceStatus `json:"status"`
	StartTime *time.Time     `json:"start_time"`
	EndTime   *time.Time     `json:"end_time"`
	Page      int            `json:"page"`
	PageSize  int            `json:"page_size"`
}

type StatusUpdateRequest struct {
	NewStatus   EvidenceStatus `json:"new_status" binding:"required"`
	IsolationAction IsolationAction `json:"isolation_action"`
	Remark      string         `json:"remark"`
	Operator    string         `json:"operator" binding:"required"`
	Conclusion  string         `json:"conclusion"`
}

type ManualCorrectionRequest struct {
	IsolationAction IsolationAction `json:"isolation_action"`
	Remark      string `json:"remark"`
	Operator    string `json:"operator" binding:"required"`
	OverrideStrategy bool `json:"override_strategy"`
}

type ApiResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}
