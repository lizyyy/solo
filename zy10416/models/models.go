package models

import (
	"time"
)

type BrowserMatrix struct {
	Browser string `json:"browser" gorm:"index"`
	Version string `json:"version"`
	OS      string `json:"os"`
}

type FailedCase struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	ExemptionID uint      `json:"exemption_id" gorm:"index"`
	TestCase    string    `json:"test_case"`
	Description string    `json:"description"`
	Screenshot  string    `json:"screenshot,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type ExemptionStatus string

const (
	StatusPending   ExemptionStatus = "pending"
	StatusApproved  ExemptionStatus = "approved"
	StatusRejected  ExemptionStatus = "rejected"
	StatusExpired   ExemptionStatus = "expired"
	StatusReviewing ExemptionStatus = "reviewing"
)

type CompatibilityConclusion string

const (
	ConclusionPass     CompatibilityConclusion = "pass"
	ConclusionFail     CompatibilityConclusion = "fail"
	ConclusionExempted CompatibilityConclusion = "exempted"
)

type Exemption struct {
	ID                   uint                   `json:"id" gorm:"primaryKey"`
	PagePath             string                 `json:"page_path" gorm:"index;uniqueIndex:idx_page_browser"`
	BrowserMatrix        BrowserMatrix          `json:"browser_matrix" gorm:"embedded;uniqueIndex:idx_page_browser"`
	FailedCases          []FailedCase           `json:"failed_cases,omitempty" gorm:"foreignKey:ExemptionID"`
	Applicant            string                 `json:"applicant"`
	ApplicantEmail       string                 `json:"applicant_email"`
	Reason               string                 `json:"reason"`
	DurationDays         int                    `json:"duration_days"`
	ExpireAt             time.Time              `json:"expire_at" gorm:"index"`
	Status               ExemptionStatus        `json:"status" gorm:"index"`
	Reviewer             string                 `json:"reviewer,omitempty"`
	ReviewComment        string                 `json:"review_comment,omitempty"`
	ReviewedAt           *time.Time             `json:"reviewed_at,omitempty"`
	CompatibilityConclusion CompatibilityConclusion `json:"compatibility_conclusion"`
	RawInput             string                 `json:"raw_input,omitempty"`
	ExceptionNote        string                 `json:"exception_note,omitempty"`
	CreatedAt            time.Time              `json:"created_at"`
	UpdatedAt            time.Time              `json:"updated_at"`
}

type CreateExemptionRequest struct {
	PagePath       string        `json:"page_path" validate:"required"`
	BrowserMatrix  BrowserMatrix `json:"browser_matrix" validate:"required"`
	FailedCases    []FailedCase  `json:"failed_cases"`
	Applicant      string        `json:"applicant" validate:"required"`
	ApplicantEmail string        `json:"applicant_email" validate:"required,email"`
	Reason         string        `json:"reason" validate:"required"`
	DurationDays   int           `json:"duration_days" validate:"required,min=1,max=365"`
}

type UpdateStatusRequest struct {
	Status        ExemptionStatus `json:"status" validate:"required"`
	Reviewer      string          `json:"reviewer"`
	ReviewComment string          `json:"review_comment"`
}

type ManualCorrectionRequest struct {
	PagePath               string                 `json:"page_path"`
	BrowserMatrix          *BrowserMatrix          `json:"browser_matrix"`
	Reason                 string                 `json:"reason"`
	DurationDays           *int                    `json:"duration_days"`
	CompatibilityConclusion *CompatibilityConclusion `json:"compatibility_conclusion"`
}

type QueryFilter struct {
	PagePath   string          `json:"page_path,omitempty"`
	Browser    string          `json:"browser,omitempty"`
	Status     ExemptionStatus `json:"status,omitempty"`
	Applicant  string          `json:"applicant,omitempty"`
	IsExpired  *bool           `json:"is_expired,omitempty"`
	Page       int             `json:"page"`
	PageSize   int             `json:"page_size"`
}

type PaginatedResponse struct {
	Data       []Exemption `json:"data"`
	Total      int64       `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
	TotalPages int         `json:"total_pages"`
}

type ExportRecord struct {
	ID                      uint                   `json:"id"`
	PagePath                string                 `json:"page_path"`
	Browser                 string                 `json:"browser"`
	Version                 string                 `json:"version"`
	OS                      string                 `json:"os"`
	FailedCaseCount         int                    `json:"failed_case_count"`
	Applicant               string                 `json:"applicant"`
	Reason                  string                 `json:"reason"`
	DurationDays            int                    `json:"duration_days"`
	ExpireAt                string                 `json:"expire_at"`
	Status                  ExemptionStatus        `json:"status"`
	CompatibilityConclusion CompatibilityConclusion `json:"compatibility_conclusion"`
	CreatedAt               string                 `json:"created_at"`
}
