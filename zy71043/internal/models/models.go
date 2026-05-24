package models

import (
	"time"
)

type WarehouseArea struct {
	ID          int64     `json:"id" db:"id"`
	Code        string    `json:"code" db:"code"`
	Name        string    `json:"name" db:"name"`
	Capacity    int       `json:"capacity" db:"capacity"`
	HumidityMin float64   `json:"humidity_min" db:"humidity_min"`
	HumidityMax float64   `json:"humidity_max" db:"humidity_max"`
	Status      string    `json:"status" db:"status"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type HumiditySample struct {
	ID           int64     `json:"id" db:"id"`
	RequestID    string    `json:"request_id" db:"request_id"`
	AreaID       int64     `json:"area_id" db:"area_id"`
	AreaCode     string    `json:"area_code" db:"area_code"`
	Humidity     float64   `json:"humidity" db:"humidity"`
	Temperature  float64   `json:"temperature" db:"temperature"`
	SampledAt    time.Time `json:"sampled_at" db:"sampled_at"`
	SampledBy    string    `json:"sampled_by" db:"sampled_by"`
	Status       string    `json:"status" db:"status"`
	WindowStart  time.Time `json:"window_start" db:"window_start"`
	WindowEnd    time.Time `json:"window_end" db:"window_end"`
	RiskLevel    string    `json:"risk_level" db:"risk_level"`
	DisposalID   *int64    `json:"disposal_id" db:"disposal_id"`
	ReviewedBy   *string   `json:"reviewed_by" db:"reviewed_by"`
	ReviewedAt   *time.Time `json:"reviewed_at" db:"reviewed_at"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

type FireworksBatch struct {
	ID             int64     `json:"id" db:"id"`
	BatchNo        string    `json:"batch_no" db:"batch_no"`
	ProductName    string    `json:"product_name" db:"product_name"`
	Quantity       int       `json:"quantity" db:"quantity"`
	CurrentAreaID  int64     `json:"current_area_id" db:"current_area_id"`
	CurrentAreaCode string   `json:"current_area_code" db:"current_area_code"`
	Status         string    `json:"status" db:"status"`
	ManufactureDate time.Time `json:"manufacture_date" db:"manufacture_date"`
	ExpiryDate     time.Time `json:"expiry_date" db:"expiry_date"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

type VentilationAction struct {
	ID            int64     `json:"id" db:"id"`
	RequestID     string    `json:"request_id" db:"request_id"`
	AreaID        int64     `json:"area_id" db:"area_id"`
	AreaCode      string    `json:"area_code" db:"area_code"`
	SampleID      int64     `json:"sample_id" db:"sample_id"`
	StartedAt     time.Time `json:"started_at" db:"started_at"`
	EndedAt       *time.Time `json:"ended_at" db:"ended_at"`
	Duration      *int      `json:"duration_minutes" db:"duration_minutes"`
	Operator      string    `json:"operator" db:"operator"`
	BeforeHumidity float64   `json:"before_humidity" db:"before_humidity"`
	AfterHumidity *float64  `json:"after_humidity" db:"after_humidity"`
	Status        string    `json:"status" db:"status"`
	ReviewedBy    *string   `json:"reviewed_by" db:"reviewed_by"`
	ReviewedAt    *time.Time `json:"reviewed_at" db:"reviewed_at"`
	Remark        string    `json:"remark" db:"remark"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

type TransferRecord struct {
	ID              int64     `json:"id" db:"id"`
	RequestID       string    `json:"request_id" db:"request_id"`
	BatchID         int64     `json:"batch_id" db:"batch_id"`
	BatchNo         string    `json:"batch_no" db:"batch_no"`
	FromAreaID      int64     `json:"from_area_id" db:"from_area_id"`
	FromAreaCode    string    `json:"from_area_code" db:"from_area_code"`
	ToAreaID        int64     `json:"to_area_id" db:"to_area_id"`
	ToAreaCode      string    `json:"to_area_code" db:"to_area_code"`
	Quantity        int       `json:"quantity" db:"quantity"`
	Operator        string    `json:"operator" db:"operator"`
	TransferredAt   time.Time `json:"transferred_at" db:"transferred_at"`
	Status          string    `json:"status" db:"status"`
	ReviewedBy      *string   `json:"reviewed_by" db:"reviewed_by"`
	ReviewedAt      *time.Time `json:"reviewed_at" db:"reviewed_at"`
	Remark          string    `json:"remark" db:"remark"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	Undone          bool      `json:"undone" db:"undone"`
	UndoneBy        *string   `json:"undone_by" db:"undone_by"`
	UndoneAt        *time.Time `json:"undone_at" db:"undone_at"`
}

type InspectionRecord struct {
	ID             int64     `json:"id" db:"id"`
	RequestID      string    `json:"request_id" db:"request_id"`
	BatchID        int64     `json:"batch_id" db:"batch_id"`
	BatchNo        string    `json:"batch_no" db:"batch_no"`
	AreaID         int64     `json:"area_id" db:"area_id"`
	AreaCode       string    `json:"area_code" db:"area_code"`
	InspectedAt    time.Time `json:"inspected_at" db:"inspected_at"`
	Inspector      string    `json:"inspector" db:"inspector"`
	PackageCheck   string    `json:"package_check" db:"package_check"`
	HumidityCheck  string    `json:"humidity_check" db:"humidity_check"`
	QualityStatus  string    `json:"quality_status" db:"quality_status"`
	Photos         []string  `json:"photos" db:"photos"`
	Remark         string    `json:"remark" db:"remark"`
	Status         string    `json:"status" db:"status"`
	ReviewedBy     *string   `json:"reviewed_by" db:"reviewed_by"`
	ReviewedAt     *time.Time `json:"reviewed_at" db:"reviewed_at"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

type RiskReport struct {
	ID              int64     `json:"id" db:"id"`
	ReportNo        string    `json:"report_no" db:"report_no"`
	ReportType      string    `json:"report_type" db:"report_type"`
	PeriodStart     time.Time `json:"period_start" db:"period_start"`
	PeriodEnd       time.Time `json:"period_end" db:"period_end"`
	GeneratedAt     time.Time `json:"generated_at" db:"generated_at"`
	GeneratedBy     string    `json:"generated_by" db:"generated_by"`
	TotalSamples    int       `json:"total_samples" db:"total_samples"`
	OverLimitCount  int       `json:"over_limit_count" db:"over_limit_count"`
	TransferCount   int       `json:"transfer_count" db:"transfer_count"`
	InspectionCount int       `json:"inspection_count" db:"inspection_count"`
	VentilationCount int      `json:"ventilation_count" db:"ventilation_count"`
	RiskLevel       string    `json:"risk_level" db:"risk_level"`
	Summary         string    `json:"summary" db:"summary"`
	Recommendations []string  `json:"recommendations" db:"recommendations"`
	Status          string    `json:"status" db:"status"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
}

type IdempotentRequest struct {
	ID           int64     `json:"id" db:"id"`
	RequestID    string    `json:"request_id" db:"request_id"`
	RequestType  string    `json:"request_type" db:"request_type"`
	ResourceType string    `json:"resource_type" db:"resource_type"`
	ResourceID   int64     `json:"resource_id" db:"resource_id"`
	ResponseBody string    `json:"response_body" db:"response_body"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

type AuditLog struct {
	ID           int64     `json:"id" db:"id"`
	Action       string    `json:"action" db:"action"`
	ResourceType string    `json:"resource_type" db:"resource_type"`
	ResourceID   int64     `json:"resource_id" db:"resource_id"`
	Operator     string    `json:"operator" db:"operator"`
	OldValue     string    `json:"old_value" db:"old_value"`
	NewValue     string    `json:"new_value" db:"new_value"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}
