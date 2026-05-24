package models

import (
	"time"
)

type WaterMeter struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	MeterNo     string    `gorm:"size:50;uniqueIndex" json:"meter_no"`
	UserID      string    `gorm:"size:50" json:"user_id"`
	UserName    string    `gorm:"size:100" json:"user_name"`
	Address     string    `gorm:"size:255" json:"address"`
	InstallDate time.Time `json:"install_date"`
	Status      string    `gorm:"size:20;default:active" json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type MeterReading struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	MeterNo     string    `gorm:"size:50;index" json:"meter_no"`
	ReadingDate time.Time `gorm:"index" json:"reading_date"`
	Reading     float64   `json:"reading"`
	ReadingType string    `gorm:"size:20;default:manual" json:"reading_type"`
	BillCycle   string    `gorm:"size:20;index" json:"bill_cycle"`
	Operator    string    `gorm:"size:50" json:"operator"`
	IsEstimated bool      `gorm:"default:false" json:"is_estimated"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type LeakRecord struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	MeterNo         string    `gorm:"size:50;index" json:"meter_no"`
	LeakStartDate   time.Time `json:"leak_start_date"`
	LeakEndDate     time.Time `json:"leak_end_date"`
	DailyLeakAmount float64   `json:"daily_leak_amount"`
	LeakLocation    string    `gorm:"size:255" json:"leak_location"`
	LeakCause       string    `gorm:"size:255" json:"leak_cause"`
	RepairDate      time.Time `json:"repair_date"`
	IsConfirmed     bool      `gorm:"default:false" json:"is_confirmed"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type TierPrice struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	TierLevel  int       `gorm:"index" json:"tier_level"`
	TierName   string    `gorm:"size:50" json:"tier_name"`
	MinUsage   float64   `json:"min_usage"`
	MaxUsage   float64   `json:"max_usage"`
	PricePerTon  float64   `json:"price_per_ton"`
	EffectiveDate time.Time `json:"effective_date"`
	ExpireDate    time.Time `json:"expire_date"`
	IsActive   bool      `gorm:"default:true" json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

const (
	AppealStatusPending    = "pending"
	AppealStatusProcessing = "processing"
	AppealStatusReviewing  = "reviewing"
	AppealStatusApproved   = "approved"
	AppealStatusRejected   = "rejected"
	AppealStatusWithdrawn  = "withdrawn"
	AppealStatusClosed     = "closed"
	AppealStatusArchived   = "archived"
)

type Appeal struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	AppealNo        string    `gorm:"size:50;uniqueIndex" json:"appeal_no"`
	MeterNo         string    `gorm:"size:50;index" json:"meter_no"`
	UserID          string    `gorm:"size:50" json:"user_id"`
	AppealType      string    `gorm:"size:50" json:"appeal_type"`
	Description     string    `gorm:"type:text" json:"description"`
	AppealDate      time.Time `gorm:"index" json:"appeal_date"`
	StartBillCycle  string    `gorm:"size:20" json:"start_bill_cycle"`
	EndBillCycle    string    `gorm:"size:20" json:"end_bill_cycle"`
	DisputedAmount  float64   `json:"disputed_amount"`
	Status          string    `gorm:"size:20;default:pending;index" json:"status"`
	IsDuplicate     bool      `gorm:"default:false;index" json:"is_duplicate"`
	ParentAppealNo  string    `gorm:"size:50" json:"parent_appeal_no"`
	OriginalBalance float64   `json:"original_balance"`
	AdjustedBalance float64   `json:"adjusted_balance"`
	RefundAmount    float64   `json:"refund_amount"`
	HandlerID       string    `gorm:"size:50" json:"handler_id"`
	HandlerName     string    `gorm:"size:100" json:"handler_name"`
	HandleComment   string    `gorm:"type:text" json:"handle_comment"`
	HandleTime      time.Time `json:"handle_time"`
	CloseTime       time.Time `json:"close_time"`
	IsArchived      bool      `gorm:"default:false" json:"is_archived"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type ReviewReport struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	ReportNo        string    `gorm:"size:50;uniqueIndex" json:"report_no"`
	AppealNo        string    `gorm:"size:50;index" json:"appeal_no"`
	MeterNo         string    `gorm:"size:50" json:"meter_no"`
	ReviewerID      string    `gorm:"size:50" json:"reviewer_id"`
	ReviewerName    string    `gorm:"size:100" json:"reviewer_name"`
	ReviewDate      time.Time `json:"review_date"`
	IsReadingValid  bool      `json:"is_reading_valid"`
	ReadingAnomaly  string    `gorm:"type:text" json:"reading_anomaly"`
	LeakConfirmed   bool      `json:"leak_confirmed"`
	LeakDays        int       `json:"leak_days"`
	LeakAmount      float64   `json:"leak_amount"`
	OriginalUsage   float64   `json:"original_usage"`
	AdjustedUsage   float64   `json:"adjusted_usage"`
	OriginalAmount  float64   `json:"original_amount"`
	AdjustedAmount  float64   `json:"adjusted_amount"`
	TierAdjustments string    `gorm:"type:text" json:"tier_adjustments"`
	ReviewConclusion string   `gorm:"type:text" json:"review_conclusion"`
	ReviewSuggestion string   `gorm:"type:text" json:"review_suggestion"`
	IsManualCorrected bool    `gorm:"default:false" json:"is_manual_corrected"`
	CorrectionReason string   `gorm:"type:text" json:"correction_reason"`
	IsFinal         bool      `gorm:"default:false" json:"is_final"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type AppealAnomaly struct {
	ID         uint   `gorm:"primaryKey" json:"id"`
	AppealNo   string `gorm:"size:50;index" json:"appeal_no"`
	AnomalyType string `gorm:"size:50" json:"anomaly_type"`
	BillCycle  string `gorm:"size:20" json:"bill_cycle"`
	Description string `gorm:"type:text" json:"description"`
	IsResolved bool   `gorm:"default:false" json:"is_resolved"`
}

type BillRecord struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	BillNo         string    `gorm:"size:50;uniqueIndex" json:"bill_no"`
	MeterNo        string    `gorm:"size:50;index" json:"meter_no"`
	BillCycle      string    `gorm:"size:20;index" json:"bill_cycle"`
	StartReading   float64   `json:"start_reading"`
	EndReading     float64   `json:"end_reading"`
	Usage          float64   `json:"usage"`
	Tier1Usage     float64   `json:"tier1_usage"`
	Tier2Usage     float64   `json:"tier2_usage"`
	Tier3Usage     float64   `json:"tier3_usage"`
	TotalAmount    float64   `json:"total_amount"`
	IsAdjusted     bool      `gorm:"default:false" json:"is_adjusted"`
	AdjustedAmount float64   `json:"adjusted_amount"`
	AdjustReason   string    `json:"adjust_reason"`
	BillDate       time.Time `json:"bill_date"`
	DueDate        time.Time `json:"due_date"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type BatchSubmitRequest struct {
	Operator     string      `json:"operator"`
	Appeals      []Appeal    `json:"appeals"`
}

type BatchSubmitResponse struct {
	SuccessCount int           `json:"success_count"`
	FailCount    int           `json:"fail_count"`
	Results      []SubmitResult `json:"results"`
}

type SubmitResult struct {
	AppealNo string `json:"appeal_no"`
	Success  bool   `json:"success"`
	Message  string `json:"message"`
	Status   string `json:"status"`
}

type AppealDetail struct {
	Appeal    Appeal         `json:"appeal"`
	Meter     WaterMeter     `json:"meter"`
	Readings  []MeterReading `json:"readings"`
	Leaks     []LeakRecord   `json:"Leaks"`
	Report    *ReviewReport  `json:"report,omitempty"`
	Bills     []BillRecord   `json:"bills"`
	Anomalies []AppealAnomaly `json:"anomalies"`
}

type RecalculateResult struct {
	OriginalTotal float64 `json:"original_total"`
	AdjustedTotal float64 `json:"adjusted_total"`
	RefundAmount  float64 `json:"refund_amount"`
	BillDetails   []BillAdjustDetail `json:"bill_details"`
}

type BillAdjustDetail struct {
	BillCycle      string  `json:"bill_cycle"`
	OriginalUsage  float64 `json:"original_usage"`
	AdjustedUsage  float64 `json:"adjusted_usage"`
	LeakDeduction  float64 `json:"leak_deduction"`
	OriginalAmount float64 `json:"original_amount"`
	AdjustedAmount float64 `json:"adjusted_amount"`
	Difference     float64 `json:"difference"`
}

type ExportRequest struct {
	AppealNos  []string `json:"appeal_nos"`
	StartDate  string   `json:"start_date"`
	EndDate    string   `json:"end_date"`
	Status     string   `json:"status"`
	ExportType string   `json:"export_type"`
}

type ExportRecord struct {
	AppealNo       string  `json:"appeal_no"`
	MeterNo        string  `json:"meter_no"`
	UserName       string  `json:"user_name"`
	Address        string  `json:"address"`
	AppealType     string  `json:"appeal_type"`
	AppealDate     string  `json:"appeal_date"`
	Status         string  `json:"status"`
	DisputedAmount float64 `json:"disputed_amount"`
	RefundAmount   float64 `json:"refund_amount"`
	ReviewResult   string  `json:"review_result"`
	CloseDate      string  `json:"close_date"`
}
