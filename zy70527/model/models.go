package model

import (
	"time"
)

type RotationStatus string

const (
	StatusCreated     RotationStatus = "CREATED"
	StatusParallel    RotationStatus = "PARALLEL_VALIDATION"
	StatusValidating  RotationStatus = "VALIDATING"
	StatusSwitching   RotationStatus = "SWITCHING"
	StatusCompleted   RotationStatus = "COMPLETED"
	StatusFailed      RotationStatus = "FAILED"
	StatusManualFix   RotationStatus = "AWAITING_MANUAL_FIX"
)

type Tenant struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CertificateRotation struct {
	ID               string         `json:"id" gorm:"primaryKey"`
	TenantID         string         `json:"tenant_id" gorm:"index"`
	OldCertFingerprint string       `json:"old_cert_fingerprint"`
	OldCertContent   string         `json:"old_cert_content"`
	NewCertFingerprint string       `json:"new_cert_fingerprint"`
	NewCertContent   string         `json:"new_cert_content"`
	WindowStartTime  time.Time      `json:"window_start_time"`
	WindowEndTime    time.Time      `json:"window_end_time"`
	Status           RotationStatus `json:"status"`
	ParallelEnabled  bool           `json:"parallel_enabled"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	CompletedAt      *time.Time     `json:"completed_at,omitempty"`

	Tenant           Tenant           `json:"-" gorm:"foreignKey:TenantID"`
	ValidationSamples []ValidationSample `json:"-" gorm:"foreignKey:RotationID"`
	Reports          []RotationReport `json:"-" gorm:"foreignKey:RotationID"`
}

type ValidationSample struct {
	ID              string    `json:"id" gorm:"primaryKey"`
	RotationID      string    `json:"rotation_id" gorm:"index"`
	Timestamp       time.Time `json:"timestamp"`
	CertUsed        string    `json:"cert_used"`
	CertFingerprint string    `json:"cert_fingerprint"`
	Endpoint        string    `json:"endpoint"`
	Success         bool      `json:"success"`
	SourceIP        string    `json:"source_ip"`
	UserAgent       string    `json:"user_agent"`
	RawRequest      string    `json:"raw_request,omitempty"`
	ValidationRule  string    `json:"validation_rule"`
	ErrorMessage    string    `json:"error_message,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}

type RotationReport struct {
	ID                 string    `json:"id" gorm:"primaryKey"`
	RotationID         string    `json:"rotation_id" gorm:"index"`
	GeneratedAt        time.Time `json:"generated_at"`
	OldCertSuccessRate float64   `json:"old_cert_success_rate"`
	NewCertSuccessRate float64   `json:"new_cert_success_rate"`
	TotalOldSamples    int       `json:"total_old_samples"`
	TotalNewSamples    int       `json:"total_new_samples"`
	Conclusion         string    `json:"conclusion"`
	Recommendation     string    `json:"recommendation"`
	RawData            string    `json:"raw_data"`
	ExportedContent    string    `json:"exported_content,omitempty"`
	CreatedBy          string    `json:"created_by"`
}

type FailedRecord struct {
	ID              string    `json:"id" gorm:"primaryKey"`
	RotationID      string    `json:"rotation_id" gorm:"index"`
	OriginalInput   string    `json:"original_input"`
	ProcessingRules string    `json:"processing_rules"`
	FinalConclusion string    `json:"final_conclusion"`
	ErrorMessage    string    `json:"error_message"`
	StackTrace      string    `json:"stack_trace,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	FixedAt         *time.Time `json:"fixed_at,omitempty"`
	FixedBy         string    `json:"fixed_by,omitempty"`
	FixNotes        string    `json:"fix_notes,omitempty"`
}

type SwitchReceipt struct {
	ID           string    `json:"id" gorm:"primaryKey"`
	RotationID   string    `json:"rotation_id" gorm:"index"`
	TenantID     string    `json:"tenant_id"`
	SwitchTime   time.Time `json:"switch_time"`
	OldCertCount int       `json:"old_cert_count"`
	NewCertCount int       `json:"new_cert_count"`
	SuccessRate  float64   `json:"success_rate"`
	Acknowledged bool      `json:"acknowledged"`
	AckBy        string    `json:"ack_by,omitempty"`
	AckTime      *time.Time `json:"ack_time,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}
