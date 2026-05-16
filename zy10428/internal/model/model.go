package model

import (
	"time"
)

type ProxyRule struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	PathPattern string    `json:"path_pattern"`
	Method      string    `json:"method"`
	RewriteTo   string    `json:"rewrite_to"`
	Headers     JSON      `json:"headers" gorm:"type:json"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type SampleRequest struct {
	ID           string    `json:"id" gorm:"primaryKey"`
	Path         string    `json:"path"`
	Method       string    `json:"method"`
	Headers      JSON      `json:"headers" gorm:"type:json"`
	Body         string    `json:"body"`
	ExpectedPath string    `json:"expected_path"`
	ExpectedCode int       `json:"expected_code"`
	Source       string    `json:"source"`
	CreatedAt    time.Time `json:"created_at"`
}

type ShadowBatch struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name"`
	RuleIDs     JSON      `json:"rule_ids" gorm:"type:json"`
	Status      string    `json:"status"`
	TotalCount  int       `json:"total_count"`
	PassCount   int       `json:"pass_count"`
	FailCount   int       `json:"fail_count"`
	StartedAt   time.Time `json:"started_at"`
	CompletedAt time.Time `json:"completed_at"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type HitResult struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	BatchID     string    `json:"batch_id"`
	RequestID   string    `json:"request_id"`
	RuleID      string    `json:"rule_id"`
	IsHit       bool      `json:"is_hit"`
	ActualPath  string    `json:"actual_path"`
	ActualCode  int       `json:"actual_code"`
	IsPass      bool      `json:"is_pass"`
	HasDiff     bool      `json:"is_diff"`
	DiffReason  string    `json:"diff_reason"`
	RawRequest  string    `json:"raw_request"`
	RawResponse string    `json:"raw_response"`
	IsCorrected bool      `json:"is_corrected"`
	Remark      string    `json:"remark"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type DiffReason struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	ResultID    string    `json:"result_id"`
	Field       string    `json:"field"`
	Expected    string    `json:"expected"`
	Actual      string    `json:"actual"`
	Severity    string    `json:"severity"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

type TestReport struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	BatchID     string    `json:"batch_id"`
	Content     string    `json:"content"`
	Format      string    `json:"format"`
	FilePath    string    `json:"file_path"`
	CreatedAt   time.Time `json:"created_at"`
}

type JSON string
