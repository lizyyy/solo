package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ParameterItem struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	ServiceName string    `gorm:"index;not null" json:"service_name"`
	ParamKey    string    `gorm:"index;not null" json:"param_key"`
	ParamType   string    `gorm:"not null" json:"param_type"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type AllowedRange struct {
	ID              string    `gorm:"primaryKey" json:"id"`
	ParameterItemID string    `gorm:"index;not null" json:"parameter_item_id"`
	MinValue        string    `json:"min_value"`
	MaxValue        string    `json:"max_value"`
	EnumValues      string    `json:"enum_values"`
	Pattern         string    `json:"pattern"`
	IsActive        bool      `gorm:"default:true" json:"is_active"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type CallingService struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	ServiceName string    `gorm:"uniqueIndex;not null" json:"service_name"`
	Description string    `json:"description"`
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type RiskLevel string

const (
	RiskLow    RiskLevel = "LOW"
	RiskMedium RiskLevel = "MEDIUM"
	RiskHigh   RiskLevel = "HIGH"
	RiskCritical RiskLevel = "CRITICAL"
)

type ChangeStatus string

const (
	StatusPending    ChangeStatus = "PENDING"
	StatusValidated  ChangeStatus = "VALIDATED"
	StatusApproved   ChangeStatus = "APPROVED"
	StatusActive     ChangeStatus = "ACTIVE"
	StatusRolledBack ChangeStatus = "ROLLED_BACK"
	StatusFailed     ChangeStatus = "FAILED"
	StatusRejected   ChangeStatus = "REJECTED"
)

type ChangeRequest struct {
	ID                 string       `gorm:"primaryKey" json:"id"`
	RequestID          string       `gorm:"uniqueIndex;not null" json:"request_id"`
	ServiceName        string       `gorm:"index;not null" json:"service_name"`
	ParamKey           string       `gorm:"index;not null" json:"param_key"`
	OldValue           string       `json:"old_value"`
	NewValue           string       `json:"new_value"`
	RequestedBy        string       `json:"requested_by"`
	RiskLevel          RiskLevel    `gorm:"index;not null" json:"risk_level"`
	Status             ChangeStatus `gorm:"index;not null" json:"status"`
	ValidationResult   string       `json:"validation_result"`
	ValidationPassed   *bool        `json:"validation_passed"`
	ApprovedBy         string       `json:"approved_by"`
	ApprovedAt         *time.Time   `json:"approved_at"`
	EffectiveAt        *time.Time   `json:"effective_at"`
	AutoRollbackAt     *time.Time   `json:"auto_rollback_at"`
	RollbackReason     string       `json:"rollback_reason"`
	FailureReason      string       `json:"failure_reason"`
	RejectionReason    string       `json:"rejection_reason"`
	CreatedAt          time.Time    `json:"created_at"`
	UpdatedAt          time.Time    `json:"updated_at"`
}

type EffectiveResult struct {
	ID              string       `gorm:"primaryKey" json:"id"`
	ChangeRequestID string       `gorm:"uniqueIndex;not null" json:"change_request_id"`
	ServiceName     string       `gorm:"index;not null" json:"service_name"`
	ParamKey        string       `gorm:"index;not null" json:"param_key"`
	Value           string       `json:"value"`
	Status          ChangeStatus `gorm:"index;not null" json:"status"`
	EffectiveAt     time.Time    `json:"effective_at"`
	ExpiredAt       *time.Time   `json:"expired_at"`
	CreatedAt       time.Time    `json:"created_at"`
	UpdatedAt       time.Time    `json:"updated_at"`
}

type RollbackRecord struct {
	ID                  string    `gorm:"primaryKey" json:"id"`
	ChangeRequestID     string    `gorm:"index;not null" json:"change_request_id"`
	RollbackType        string    `gorm:"not null" json:"rollback_type"`
	PreviousValue       string    `json:"previous_value"`
	RolledBackValue     string    `json:"rolled_back_value"`
	RolledBackBy        string    `json:"rolled_back_by"`
	RollbackReason      string    `json:"rollback_reason"`
	IsAutomatic         bool      `gorm:"default:false" json:"is_automatic"`
	RolledBackAt        time.Time `json:"rolled_back_at"`
	CreatedAt           time.Time `json:"created_at"`
}

type AuditLog struct {
	ID              string    `gorm:"primaryKey" json:"id"`
	ChangeRequestID string    `gorm:"index;not null" json:"change_request_id"`
	Action          string    `gorm:"index;not null" json:"action"`
	OldStatus       string    `json:"old_status"`
	NewStatus       string    `json:"new_status"`
	PerformedBy     string    `json:"performed_by"`
	Details         string    `json:"details"`
	CreatedAt       time.Time `json:"created_at"`
}

func (pi *ParameterItem) BeforeCreate(tx *gorm.DB) error {
	if pi.ID == "" {
		pi.ID = uuid.New().String()
	}
	return nil
}

func (ar *AllowedRange) BeforeCreate(tx *gorm.DB) error {
	if ar.ID == "" {
		ar.ID = uuid.New().String()
	}
	return nil
}

func (cs *CallingService) BeforeCreate(tx *gorm.DB) error {
	if cs.ID == "" {
		cs.ID = uuid.New().String()
	}
	return nil
}

func (cr *ChangeRequest) BeforeCreate(tx *gorm.DB) error {
	if cr.ID == "" {
		cr.ID = uuid.New().String()
	}
	if cr.RequestID == "" {
		cr.RequestID = "CR-" + uuid.New().String()[:8]
	}
	return nil
}

func (er *EffectiveResult) BeforeCreate(tx *gorm.DB) error {
	if er.ID == "" {
		er.ID = uuid.New().String()
	}
	return nil
}

func (rr *RollbackRecord) BeforeCreate(tx *gorm.DB) error {
	if rr.ID == "" {
		rr.ID = uuid.New().String()
	}
	return nil
}

func (al *AuditLog) BeforeCreate(tx *gorm.DB) error {
	if al.ID == "" {
		al.ID = uuid.New().String()
	}
	return nil
}
