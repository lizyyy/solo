package model

import (
	"time"
)

type MatchCondition struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	RuleID    string    `json:"rule_id"`
	Type      string    `json:"type"` 
	Key       string    `json:"key"`
	Operator  string    `json:"operator"`
	Value     string    `json:"value"`
	CreatedAt time.Time `json:"created_at"`
}

type UpstreamService struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name"`
	Host      string    `json:"host"`
	Port      int       `json:"port"`
	Weight    int       `json:"weight"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type RouteRule struct {
	ID          string           `json:"id" gorm:"primaryKey"`
	Name        string           `json:"name"`
	Description string           `json:"description"`
	Priority    int              `json:"priority"`
	Enabled     bool             `json:"enabled"`
	Conditions  []MatchCondition `json:"conditions" gorm:"foreignKey:RuleID"`
	UpstreamID  string           `json:"upstream_id"`
	Upstream    UpstreamService  `json:"upstream" gorm:"foreignKey:UpstreamID"`
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
}

type RequestSample struct {
	ID        string            `json:"id" gorm:"primaryKey"`
	Name      string            `json:"name"`
	Method    string            `json:"method"`
	Path      string            `json:"path"`
	Headers   map[string]string `json:"headers" gorm:"serializer:json"`
	Query     map[string]string `json:"query" gorm:"serializer:json"`
	CreatedAt time.Time         `json:"created_at"`
}

type ConflictRule struct {
	ID             string    `json:"id" gorm:"primaryKey"`
	RuleID1        string    `json:"rule_id_1"`
	RuleID2        string    `json:"rule_id_2"`
	ConflictType   string    `json:"conflict_type"`
	Description    string    `json:"description"`
	ResolutionHint string    `json:"resolution_hint"`
	DetectedAt     time.Time `json:"detected_at"`
}

type TrialStatus string

const (
	TrialStatusPending   TrialStatus = "pending"
	TrialStatusRunning   TrialStatus = "running"
	TrialStatusCompleted TrialStatus = "completed"
	TrialStatusFailed    TrialStatus = "failed"
)

type TrialResult struct {
	ID               string      `json:"id" gorm:"primaryKey"`
	RequestID        string      `json:"request_id"`
	RequestSample    RequestSample `json:"request_sample" gorm:"foreignKey:RequestID"`
	MatchedRuleID    *string     `json:"matched_rule_id"`
	MatchedRule      *RouteRule  `json:"matched_rule" gorm:"foreignKey:MatchedRuleID"`
	Status           TrialStatus `json:"status"`
	ConflictDetected bool        `json:"conflict_detected"`
	Conflicts        []ConflictRule `json:"conflicts" gorm:"many2many:trial_conflicts;"`
	Explanation      string      `json:"explanation"`
	Error            string      `json:"error"`
	DurationMs       int64       `json:"duration_ms"`
	CreatedAt        time.Time   `json:"created_at"`
	CompletedAt      *time.Time  `json:"completed_at"`
}

type TrialRequest struct {
	ID             string   `json:"id" gorm:"primaryKey"`
	IdempotencyKey string   `json:"idempotency_key" gorm:"uniqueIndex"`
	RequestSampleID string  `json:"request_sample_id"`
	RuleIDs        []string `json:"rule_ids" gorm:"serializer:json"`
	Status         TrialStatus `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
}

type ErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}
