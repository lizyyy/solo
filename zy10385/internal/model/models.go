package model

import (
	"time"
)

type Status string

const (
	StatusDraft       Status = "DRAFT"
	StatusPending     Status = "PENDING"
	StatusChecking    Status = "CHECKING"
	StatusApproved    Status = "APPROVED"
	StatusRejected    Status = "REJECTED"
	StatusCancelled   Status = "CANCELLED"
)

type CheckItemStatus string

const (
	CheckItemPending  CheckItemStatus = "PENDING"
	CheckItemPassed   CheckItemStatus = "PASSED"
	CheckItemFailed   CheckItemStatus = "FAILED"
)

type ServiceApplication struct {
	ID               string            `json:"id"`
	ServiceName      string            `json:"service_name"`
	ServiceOwner     string            `json:"service_owner"`
	Description      string            `json:"description"`
	Status           Status            `json:"status"`
	Dependencies     []Dependency      `json:"dependencies"`
	PermissionCreds  []PermissionCred  `json:"permission_creds"`
	QuotaRequirements []QuotaRequirement `json:"quota_requirements"`
	Alerts           []AlertItem       `json:"alerts"`
	AdmissionResult  *AdmissionResult  `json:"admission_result"`
	CreatedAt        time.Time         `json:"created_at"`
	UpdatedAt        time.Time         `json:"updated_at"`
	Version          int               `json:"version"`
}

type Dependency struct {
	ID             string    `json:"id"`
	AppID          string    `json:"app_id"`
	APIName        string    `json:"api_name"`
	APIEndpoint    string    `json:"api_endpoint"`
	APIMethod      string    `json:"api_method"`
	Description    string    `json:"description"`
	Registered     bool      `json:"registered"`
	RegisteredAt   time.Time `json:"registered_at"`
}

type PermissionCred struct {
	ID           string    `json:"id"`
	AppID        string    `json:"app_id"`
	CredType     string    `json:"cred_type"`
	CredID       string    `json:"cred_id"`
	Valid        bool      `json:"valid"`
	ExpireAt     time.Time `json:"expire_at"`
	CheckStatus  CheckItemStatus `json:"check_status"`
	CheckMessage string    `json:"check_message"`
}

type QuotaRequirement struct {
	ID            string    `json:"id"`
	AppID         string    `json:"app_id"`
	QuotaType     string    `json:"quota_type"`
	Requested     int64     `json:"requested"`
	Available     int64     `json:"available"`
	CheckStatus   CheckItemStatus `json:"check_status"`
	CheckMessage  string    `json:"check_message"`
}

type AlertItem struct {
	ID           string    `json:"id"`
	AppID        string    `json:"app_id"`
	AlertType    string    `json:"alert_type"`
	Severity     string    `json:"severity"`
	Message      string    `json:"message"`
	CheckStatus  CheckItemStatus `json:"check_status"`
	Resolved     bool      `json:"resolved"`
}

type AdmissionResult struct {
	ID            string    `json:"id"`
	AppID         string    `json:"app_id"`
	Conclusion    string    `json:"conclusion"`
	Approved      bool      `json:"approved"`
	ReportContent string    `json:"report_content"`
	ReviewedBy    string    `json:"reviewed_by"`
	ReviewedAt    time.Time `json:"reviewed_at"`
}

type HistoryRecord struct {
	ID         string    `json:"id"`
	AppID      string    `json:"app_id"`
	OldStatus  Status    `json:"old_status"`
	NewStatus  Status    `json:"new_status"`
	Operator   string    `json:"operator"`
	Remark     string    `json:"remark"`
	CreatedAt  time.Time `json:"created_at"`
}

type CreateApplicationRequest struct {
	ServiceName       string             `json:"service_name" binding:"required"`
	ServiceOwner      string             `json:"service_owner" binding:"required"`
	Description       string             `json:"description"`
	Dependencies      []DependencyRequest `json:"dependencies"`
}

type DependencyRequest struct {
	APIName     string `json:"api_name" binding:"required"`
	APIEndpoint string `json:"api_endpoint" binding:"required"`
	APIMethod   string `json:"api_method" binding:"required"`
	Description string `json:"description"`
}

type CheckResult struct {
	Passed  bool   `json:"passed"`
	Message string `json:"message"`
	Details string `json:"details"`
}
