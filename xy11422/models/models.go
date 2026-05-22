package models

import (
	"time"

	"gorm.io/gorm"
)

type ReceiptSource string

const (
	SourceInspection  ReceiptSource = "inspection"
	SourceRepairQuote ReceiptSource = "repair_quote"
	SourcePhotoList   ReceiptSource = "photo_list"
	SourceSupplier    ReceiptSource = "supplier_statement"
)

type ReceiptStatus string

const (
	StatusSubmitted   ReceiptStatus = "submitted"
	StatusQueued      ReceiptStatus = "queued"
	StatusProcessing  ReceiptStatus = "processing"
	StatusRetryWait   ReceiptStatus = "retry_wait"
	StatusManualWait  ReceiptStatus = "manual_wait"
	StatusDeadLetter  ReceiptStatus = "dead_letter"
	StatusCompensated ReceiptStatus = "compensated"
	StatusClosed      ReceiptStatus = "closed"
)

type FailureType string

const (
	FailureRetryable  FailureType = "retryable"
	FailureManual     FailureType = "manual_required"
	FailurePermanent  FailureType = "permanent"
)

type Receipt struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	ReceiptNo         string         `gorm:"size:64;uniqueIndex;not null" json:"receipt_no"`
	CarVin            string         `gorm:"size:32;index" json:"car_vin"`
	CarPlate          string         `gorm:"size:16" json:"car_plate"`
	Source            ReceiptSource  `gorm:"size:32;index" json:"source"`
	SourceFile        string         `gorm:"size:255" json:"source_file"`
	SourceLine        int            `json:"source_line"`
	RawData           string         `gorm:"type:text" json:"raw_data"`
	StandardData      string         `gorm:"type:text" json:"standard_data"`
	Amount            float64        `json:"amount"`
	ResponsiblePerson string         `gorm:"size:64" json:"responsible_person"`
	CurrentStatus     ReceiptStatus  `gorm:"size:32;index" json:"current_status"`
	RetryCount        int            `json:"retry_count"`
	MaxRetries        int            `json:"max_retries"`
	LastError         string         `gorm:"type:text" json:"last_error"`
	FailureType       FailureType    `gorm:"size:32" json:"failure_type"`
	CompensationAmount float64       `json:"compensation_amount"`
	ClosedBy          string         `gorm:"size:64" json:"closed_by"`
	ClosedAt          *time.Time     `json:"closed_at"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`

	StatusHistory []StatusHistory `gorm:"foreignKey:ReceiptID" json:"status_history,omitempty"`
	RetryTasks    []RetryTask     `gorm:"foreignKey:ReceiptID" json:"retry_tasks,omitempty"`
}

type StatusHistory struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	ReceiptID      uint           `gorm:"index;not null" json:"receipt_id"`
	FromStatus     ReceiptStatus  `gorm:"size:32" json:"from_status"`
	ToStatus       ReceiptStatus  `gorm:"size:32;not null" json:"to_status"`
	Operator       string         `gorm:"size:64;not null" json:"operator"`
	Reason         string         `gorm:"type:text;not null" json:"reason"`
	ChangeTime     time.Time      `gorm:"not null" json:"change_time"`
	AdditionalInfo string         `gorm:"type:text" json:"additional_info"`
	CreatedAt      time.Time      `json:"created_at"`
}

type RetryTask struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	ReceiptID     uint           `gorm:"index;not null" json:"receipt_id"`
	RetryNo       int            `json:"retry_no"`
	ScheduledAt   time.Time      `gorm:"index;not null" json:"scheduled_at"`
	ExecutedAt    *time.Time     `json:"executed_at"`
	Status        string         `gorm:"size:32;index" json:"status"`
	ErrorMsg      string         `gorm:"type:text" json:"error_msg"`
	FailureType   FailureType    `gorm:"size:32" json:"failure_type"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
}

type CompensationRecord struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	ReceiptID         uint           `gorm:"index;not null" json:"receipt_id"`
	ReceiptNo         string         `gorm:"size:64;index" json:"receipt_no"`
	CarVin            string         `gorm:"size:32" json:"car_vin"`
	Amount            float64        `json:"amount"`
	Operator          string         `gorm:"size:64;not null" json:"operator"`
	Reason            string         `gorm:"type:text;not null" json:"reason"`
	CompensationTime  time.Time      `gorm:"not null" json:"compensation_time"`
	AccountNo         string         `gorm:"size:64" json:"account_no"`
	VoucherNo         string         `gorm:"size:64" json:"voucher_no"`
	CreatedAt         time.Time      `json:"created_at"`
}

type ImportRecord struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	SourceFile    string         `gorm:"size:255;index" json:"source_file"`
	Source        ReceiptSource  `gorm:"size:32" json:"source"`
	TotalRows     int            `json:"total_rows"`
	SuccessRows   int            `json:"success_rows"`
	FailedRows    int            `json:"failed_rows"`
	Operator      string         `gorm:"size:64" json:"operator"`
	ImportTime    time.Time      `gorm:"not null" json:"import_time"`
	ErrorLog      string         `gorm:"type:text" json:"error_log"`
	CreatedAt     time.Time      `json:"created_at"`
}

type RetryCategoryStats struct {
	Category    string `json:"category"`
	Count       int    `json:"count"`
	TotalAmount float64 `json:"total_amount"`
}

type DeadLetterStats struct {
	Reason      string `json:"reason"`
	Count       int    `json:"count"`
	TotalAmount float64 `json:"total_amount"`
}
