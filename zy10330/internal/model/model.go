package model

import (
	"time"

	"github.com/google/uuid"
)

type Status string

const (
	StatusDraft     Status = "DRAFT"
	StatusTesting   Status = "TESTING"
	StatusGray      Status = "GRAY"
	StatusPublished Status = "PUBLISHED"
	StatusRollback  Status = "ROLLBACK"
	StatusRevoked   Status = "REVOKED"
)

type StrategyPackage struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	CreatedBy   string    `json:"created_by"`
}

type RuleVersion struct {
	ID            string                 `json:"id"`
	PackageID     string                 `json:"package_id"`
	Version       string                 `json:"version"`
	RuleContent   map[string]interface{} `json:"rule_content"`
	Status        Status                 `json:"status"`
	GrayRange     *GrayRange             `json:"gray_range,omitempty"`
	RollbackPoint *RollbackPoint         `json:"rollback_point,omitempty"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
	CreatedBy     string                 `json:"created_by"`
	Remark        string                 `json:"remark,omitempty"`
}

type GrayRange struct {
	UserIDs    []string `json:"user_ids,omitempty"`
	UserGroups []string `json:"user_groups,omitempty"`
	Percentage int      `json:"percentage,omitempty"`
	Regions    []string `json:"regions,omitempty"`
}

type RollbackPoint struct {
	VersionID   string    `json:"version_id"`
	Snapshot    string    `json:"snapshot"`
	CreatedAt   time.Time `json:"created_at"`
	CreatedBy   string    `json:"created_by"`
	Description string    `json:"description"`
}

type HitRequest struct {
	ID          string                 `json:"id"`
	RequestID   string                 `json:"request_id"`
	PackageID   string                 `json:"package_id"`
	VersionID   string                 `json:"version_id"`
	Input       map[string]interface{} `json:"input"`
	HitResult   bool                   `json:"hit_result"`
	HitRules    []string               `json:"hit_rules,omitempty"`
	Explanation *ExplanationResult     `json:"explanation,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UserID      string                 `json:"user_id,omitempty"`
}

type ExplanationResult struct {
	RuleID      string                 `json:"rule_id"`
	RuleName    string                 `json:"rule_name"`
	Conditions  []ConditionResult      `json:"conditions"`
	FinalResult bool                   `json:"final_result"`
	Details     map[string]interface{} `json:"details,omitempty"`
}

type ConditionResult struct {
	Field    string      `json:"field"`
	Operator string      `json:"operator"`
	Expected interface{} `json:"expected"`
	Actual   interface{} `json:"actual"`
	Matched  bool        `json:"matched"`
}

type AuditLog struct {
	ID         string                 `json:"id"`
	EntityType string                 `json:"entity_type"`
	EntityID   string                 `json:"entity_id"`
	Action     string                 `json:"action"`
	Before     map[string]interface{} `json:"before,omitempty"`
	After      map[string]interface{} `json:"after,omitempty"`
	Operator   string                 `json:"operator"`
	OperatedAt time.Time              `json:"operated_at"`
	Remark     string                 `json:"remark,omitempty"`
}

func NewID() string {
	return uuid.New().String()
}

func Now() time.Time {
	return time.Now().UTC()
}
