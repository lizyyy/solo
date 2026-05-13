package models

import (
	"time"
)

type RuleStatus string

const (
	RuleStatusPending  RuleStatus = "pending"
	RuleStatusActive   RuleStatus = "active"
	RuleStatusPaused   RuleStatus = "paused"
	RuleStatusExpired  RuleStatus = "expired"
	RuleStatusRecovered RuleStatus = "recovered"
)

type SamplingRule struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	RequestID   string     `gorm:"uniqueIndex;size:64" json:"request_id"`
	RuleName    string     `gorm:"size:128" json:"rule_name"`
	PathPattern string     `gorm:"size:256" json:"path_pattern"`
	TenantTags  string     `gorm:"size:512" json:"tenant_tags"`
	SampleRate  float64    `json:"sample_rate"`
	WindowStart time.Time  `json:"window_start"`
	WindowEnd   time.Time  `json:"window_end"`
	MaxHits     int        `json:"max_hits"`
	CurrentHits int        `json:"current_hits"`
	Status      RuleStatus `gorm:"size:32;default:pending" json:"status"`
	AutoRecover bool       `json:"auto_recover"`
	RecoverAt   *time.Time `json:"recover_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type HitRecord struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	RuleID     uint      `gorm:"index" json:"rule_id"`
	RequestID  string    `gorm:"size:64" json:"request_id"`
	TenantTag  string    `gorm:"size:128" json:"tenant_tag"`
	Path       string    `gorm:"size:256" json:"path"`
	Sampled    bool      `json:"sampled"`
	HitAt      time.Time `gorm:"index" json:"hit_at"`
	CreatedAt  time.Time `json:"created_at"`
}

type HistoryRecord struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	RuleID      uint      `gorm:"index" json:"rule_id"`
	Operation   string    `gorm:"size:64" json:"operation"`
	OldStatus   string    `gorm:"size:32" json:"old_status,omitempty"`
	NewStatus   string    `gorm:"size:32" json:"new_status,omitempty"`
	Operator    string    `gorm:"size:128" json:"operator"`
	Description string    `gorm:"size:512" json:"description,omitempty"`
	OperatedAt  time.Time `gorm:"index" json:"operated_at"`
	CreatedAt   time.Time `json:"created_at"`
}

type CreateRuleRequest struct {
	RequestID   string    `json:"request_id" binding:"required"`
	RuleName    string    `json:"rule_name" binding:"required"`
	PathPattern string    `json:"path_pattern" binding:"required"`
	TenantTags  []string  `json:"tenant_tags"`
	SampleRate  float64   `json:"sample_rate" binding:"required,min=0,max=1"`
	WindowStart time.Time `json:"window_start" binding:"required"`
	WindowEnd   time.Time `json:"window_end" binding:"required"`
	MaxHits     int       `json:"max_hits" binding:"required,min=1"`
	AutoRecover bool      `json:"auto_recover"`
	Operator    string    `json:"operator" binding:"required"`
}

type ValidateRuleRequest struct {
	RuleID     uint   `json:"rule_id" binding:"required"`
	RequestID  string `json:"request_id" binding:"required"`
	TenantTag  string `json:"tenant_tag" binding:"required"`
	Path       string `json:"path" binding:"required"`
}

type UpdateStatusRequest struct {
	RuleID     uint   `json:"rule_id" binding:"required"`
	NewStatus  string `json:"new_status" binding:"required"`
	Operator   string `json:"operator" binding:"required"`
	Description string `json:"description"`
}

type ErrorResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Detail  string `json:"detail,omitempty"`
}

type SuccessResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}
