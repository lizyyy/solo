package model

import (
	"time"

	"github.com/google/uuid"
)

type BaseModel struct {
	ID        string    `json:"id" gorm:"primaryKey;type:varchar(36)"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (b *BaseModel) BeforeCreate() error {
	if b.ID == "" {
		b.ID = uuid.New().String()
	}
	return nil
}

type PartnerStatus string

const (
	PartnerStatusActive   PartnerStatus = "ACTIVE"
	PartnerStatusInactive PartnerStatus = "INACTIVE"
)

type Partner struct {
	BaseModel
	Name         string        `json:"name" gorm:"type:varchar(128);not null;uniqueIndex"`
	Code         string        `json:"code" gorm:"type:varchar(64);not null;uniqueIndex"`
	Description  string        `json:"description" gorm:"type:text"`
	Status       PartnerStatus `json:"status" gorm:"type:varchar(32);not null"`
	ContactName  string        `json:"contact_name" gorm:"type:varchar(64)"`
	ContactEmail string        `json:"contact_email" gorm:"type:varchar(128)"`
	ContactPhone string        `json:"contact_phone" gorm:"type:varchar(32)"`
	Extra        string        `json:"extra" gorm:"type:text"`
}

type CertStatus string

const (
	CertStatusPending      CertStatus = "PENDING"
	CertStatusValidating   CertStatus = "VALIDATING"
	CertStatusValidationOK CertStatus = "VALIDATION_OK"
	CertStatusGray         CertStatus = "GRAY"
	CertStatusEnabled      CertStatus = "ENABLED"
	CertStatusDisabled     CertStatus = "DISABLED"
	CertStatusExpired      CertStatus = "EXPIRED"
	CertStatusRollback     CertStatus = "ROLLBACK"
)

type ClientCertificate struct {
	BaseModel
	PartnerID         string     `json:"partner_id" gorm:"type:varchar(36);not null;index"`
	SerialNumber      string     `json:"serial_number" gorm:"type:varchar(128);not null;uniqueIndex"`
	Subject           string     `json:"subject" gorm:"type:varchar(512);not null"`
	Issuer            string     `json:"issuer" gorm:"type:varchar(512);not null"`
	NotBefore         time.Time  `json:"not_before"`
	NotAfter          time.Time  `json:"not_after"`
	Fingerprint       string     `json:"fingerprint" gorm:"type:varchar(128);not null;uniqueIndex"`
	Status            CertStatus `json:"status" gorm:"type:varchar(32);not null"`
	CertContent       string     `json:"-" gorm:"type:text"`
	PrivateKeyContent string     `json:"-" gorm:"type:text"`
	Version           int        `json:"version" gorm:"default:1"`
	IsCurrent         bool       `json:"is_current" gorm:"default:false"`
	IsRollback        bool       `json:"is_rollback" gorm:"default:false"`
	GrayPercent       int        `json:"gray_percent" gorm:"default:0"`
	Remark            string     `json:"remark" gorm:"type:text"`
}

type RenewalWindowStatus string

const (
	RenewalWindowStatusOpen   RenewalWindowStatus = "OPEN"
	RenewalWindowStatusClosed RenewalWindowStatus = "CLOSED"
)

type RenewalWindow struct {
	BaseModel
	PartnerID      string              `json:"partner_id" gorm:"type:varchar(36);not null;index"`
	CertID         string              `json:"cert_id" gorm:"type:varchar(36);not null;index"`
	WindowStart    time.Time           `json:"window_start"`
	WindowEnd      time.Time           `json:"window_end"`
	Status         RenewalWindowStatus `json:"status" gorm:"type:varchar(32);not null"`
	ReminderSent   bool                `json:"reminder_sent" gorm:"default:false"`
	ReminderSentAt *time.Time          `json:"reminder_sent_at"`
	Remark         string              `json:"remark" gorm:"type:text"`
}

type ReminderStatus string

const (
	ReminderStatusPending ReminderStatus = "PENDING"
	ReminderStatusSent    ReminderStatus = "SENT"
)

type RenewalReminder struct {
	BaseModel
	PartnerID     string         `json:"partner_id" gorm:"type:varchar(36);not null;index"`
	CertID        string         `json:"cert_id" gorm:"type:varchar(36);not null;index"`
	CertSubject   string         `json:"cert_subject" gorm:"type:varchar(512)"`
	ExpireAt      time.Time      `json:"expire_at"`
	RemindAt      time.Time      `json:"remind_at"`
	Status        ReminderStatus `json:"status" gorm:"type:varchar(32);not null"`
	SentBy        string         `json:"sent_by" gorm:"type:varchar(64)"`
	SentAt        *time.Time     `json:"sent_at"`
	ReminderCount int            `json:"reminder_count" gorm:"default:0"`
	Remark        string         `json:"remark" gorm:"type:text"`
}

type VerificationStatus string

const (
	VerificationStatusPending VerificationStatus = "PENDING"
	VerificationStatusSuccess VerificationStatus = "SUCCESS"
	VerificationStatusFailed  VerificationStatus = "FAILED"
)

type VerificationRequest struct {
	BaseModel
	PartnerID          string             `json:"partner_id" gorm:"type:varchar(36);not null;index"`
	NewCertID          string             `json:"new_cert_id" gorm:"type:varchar(36);not null;index"`
	OldCertID          string             `json:"old_cert_id" gorm:"type:varchar(36);not null;index"`
	RequestID          string             `json:"request_id" gorm:"type:varchar(64);not null;uniqueIndex"`
	Status             VerificationStatus `json:"status" gorm:"type:varchar(32);not null"`
	VerificationType   string             `json:"verification_type" gorm:"type:varchar(64)"`
	VerificationData   string             `json:"verification_data" gorm:"type:text"`
	VerificationResult string             `json:"verification_result" gorm:"type:text"`
	VerifiedAt         *time.Time         `json:"verified_at"`
	Verifier           string             `json:"verifier" gorm:"type:varchar(64)"`
	RetryCount         int                `json:"retry_count" gorm:"default:0"`
	Remark             string             `json:"remark" gorm:"type:text"`
}

type RollbackRecord struct {
	BaseModel
	PartnerID        string    `json:"partner_id" gorm:"type:varchar(36);not null;index"`
	CurrentCertID    string    `json:"current_cert_id" gorm:"type:varchar(36);not null;index"`
	RollbackCertID   string    `json:"rollback_cert_id" gorm:"type:varchar(36);not null;index"`
	RollbackReason   string    `json:"rollback_reason" gorm:"type:text;not null"`
	RollbackOperator string    `json:"rollback_operator" gorm:"type:varchar(64);not null"`
	RollbackAt       time.Time `json:"rollback_at"`
	IsSuccess        bool      `json:"is_success" gorm:"default:true"`
	Remark           string    `json:"remark" gorm:"type:text"`
}

type EnablementType string

const (
	EnablementTypeGray     EnablementType = "GRAY"
	EnablementTypeFull     EnablementType = "FULL"
	EnablementTypeRollback EnablementType = "ROLLBACK"
)

type EnablementRecord struct {
	BaseModel
	PartnerID      string         `json:"partner_id" gorm:"type:varchar(36);not null;index"`
	CertID         string         `json:"cert_id" gorm:"type:varchar(36);not null;index"`
	EnablementType EnablementType `json:"enablement_type" gorm:"type:varchar(32);not null"`
	GrayPercent    int            `json:"gray_percent" gorm:"default:0"`
	Operator       string         `json:"operator" gorm:"type:varchar(64);not null"`
	EnableAt       time.Time      `json:"enable_at"`
	PreviousStatus CertStatus     `json:"previous_status" gorm:"type:varchar(32)"`
	NewStatus      CertStatus     `json:"new_status" gorm:"type:varchar(32)"`
	ChangeReason   string         `json:"change_reason" gorm:"type:text"`
	Extra          string         `json:"extra" gorm:"type:text"`
}

type IdempotentRequest struct {
	BaseModel
	RequestID    string    `json:"request_id" gorm:"type:varchar(128);not null;uniqueIndex"`
	RequestType  string    `json:"request_type" gorm:"type:varchar(64);not null"`
	RequestData  string    `json:"request_data" gorm:"type:text"`
	ResponseData string    `json:"response_data" gorm:"type:text"`
	ProcessedAt  time.Time `json:"processed_at"`
}
