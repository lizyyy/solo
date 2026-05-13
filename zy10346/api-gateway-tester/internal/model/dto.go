package model

import "time"

type CreateRouteRuleRequest struct {
	Name        string                 `json:"name" validate:"required"`
	Description string                 `json:"description"`
	Priority    int                    `json:"priority" validate:"min=0"`
	Enabled     bool                   `json:"enabled"`
	Conditions  []CreateConditionRequest `json:"conditions"`
	UpstreamID  string                 `json:"upstream_id" validate:"required"`
}

type CreateConditionRequest struct {
	Type     string `json:"type" validate:"required,oneof=path method header query"`
	Key      string `json:"key"`
	Operator string `json:"operator" validate:"required,oneof=equals contains starts_with ends_with regex"`
	Value    string `json:"value" validate:"required"`
}

type CreateUpstreamRequest struct {
	Name   string `json:"name" validate:"required"`
	Host   string `json:"host" validate:"required,hostname"`
	Port   int    `json:"port" validate:"required,min=1,max=65535"`
	Weight int    `json:"weight" validate:"min=1,max=100"`
}

type CreateRequestSampleRequest struct {
	Name    string            `json:"name" validate:"required"`
	Method  string            `json:"method" validate:"required,oneof=GET POST PUT DELETE PATCH HEAD OPTIONS"`
	Path    string            `json:"path" validate:"required"`
	Headers map[string]string `json:"headers"`
	Query   map[string]string `json:"query"`
}

type StartTrialRequest struct {
	IdempotencyKey  string   `json:"idempotency_key" validate:"required"`
	RequestSampleID string   `json:"request_sample_id" validate:"required"`
	RuleIDs         []string `json:"rule_ids"`
}

type TrialHistoryQuery struct {
	Status    *TrialStatus `json:"status,omitempty"`
	StartTime *time.Time   `json:"start_time,omitempty"`
	EndTime   *time.Time   `json:"end_time,omitempty"`
	Page      int          `json:"page" validate:"min=1"`
	PageSize  int          `json:"page_size" validate:"min=1,max=100"`
}

type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Total      int64       `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
	TotalPages int         `json:"total_pages"`
}

type ExportRequest struct {
	Format    string       `json:"format" validate:"required,oneof=json csv"`
	TrialIDs  []string     `json:"trial_ids"`
}

type RuleExplanation struct {
	RuleID      string   `json:"rule_id"`
	RuleName    string   `json:"rule_name"`
	Priority    int      `json:"priority"`
	Explanation string   `json:"explanation"`
	MatchScore  float64  `json:"match_score"`
	MatchedConditions []string `json:"matched_conditions"`
}
