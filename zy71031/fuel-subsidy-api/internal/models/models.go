package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BaseModel struct {
	ID        uuid.UUID      `gorm:"type:uuid;primary_key" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (base *BaseModel) BeforeCreate(tx *gorm.DB) error {
	if base.ID == uuid.Nil {
		base.ID = uuid.New()
	}
	return nil
}

type Auditor struct {
	BaseModel
	Username string `gorm:"uniqueIndex;size:50;not null" json:"username"`
	Name     string `gorm:"size:50;not null" json:"name"`
	Role     string `gorm:"size:20;not null" json:"role"`
}

type FishingVessel struct {
	BaseModel
	VesselNumber    string    `gorm:"uniqueIndex;size:50;not null" json:"vessel_number"`
	VesselName      string    `gorm:"size:100;not null" json:"vessel_name"`
	OwnerName       string    `gorm:"size:50;not null" json:"owner_name"`
	OwnerIDCard     string    `gorm:"size:30;not null" json:"owner_id_card"`
	ContactPhone    string    `gorm:"size:20" json:"contact_phone"`
	Power           float64   `json:"power"`
	Tonnage         float64   `json:"tonnage"`
	RegistrationOrg string    `gorm:"size:100" json:"registration_org"`
	ValidFrom       time.Time `json:"valid_from"`
	ValidTo         time.Time `json:"valid_to"`
}

type FishingBanPeriod struct {
	BaseModel
	Year        int       `gorm:"index;not null" json:"year"`
	Region      string    `gorm:"size:50;not null" json:"region"`
	StartDate   time.Time `gorm:"not null" json:"start_date"`
	EndDate     time.Time `gorm:"not null" json:"end_date"`
	Description string    `gorm:"size:200" json:"description"`
}

type FuelReceipt struct {
	BaseModel
	ReceiptNumber  string    `gorm:"uniqueIndex;size:100;not null" json:"receipt_number"`
	ReceiptDate    time.Time `gorm:"not null" json:"receipt_date"`
	GasStationName string    `gorm:"size:100;not null" json:"gas_station_name"`
	FuelType       string    `gorm:"size:20;not null" json:"fuel_type"`
	FuelAmount     float64   `gorm:"not null" json:"fuel_amount"`
	UnitPrice      float64   `gorm:"not null" json:"unit_price"`
	TotalAmount    float64   `gorm:"not null" json:"total_amount"`
	VesselNumber   string    `gorm:"size:50;not null" json:"vessel_number"`
	DriverName     string    `gorm:"size:50" json:"driver_name"`
	IsUsed         bool      `gorm:"default:false" json:"is_used"`
	UsedByAppID    *uuid.UUID `gorm:"index" json:"used_by_app_id"`
	UsedAt         *time.Time `json:"used_at"`
}

type Voyage struct {
	BaseModel
	ApplicationID uuid.UUID  `gorm:"index;not null" json:"application_id"`
	VoyageNumber  string     `gorm:"size:50;not null" json:"voyage_number"`
	DepartureDate time.Time  `gorm:"not null" json:"departure_date"`
	ReturnDate    time.Time  `gorm:"not null" json:"return_date"`
	FishingArea   string     `gorm:"size:100;not null" json:"fishing_area"`
	FuelConsumed  float64    `json:"fuel_consumed"`
	CatchWeight   float64    `json:"catch_weight"`
	IsInBanPeriod bool       `gorm:"default:false" json:"is_in_ban_period"`
	CheckResult   string     `gorm:"size:20" json:"check_result"`
	CheckRemark   string     `gorm:"size:500" json:"check_remark"`
}

type AuditStatus string

const (
	StatusReceived     AuditStatus = "received"
	StatusVerifying    AuditStatus = "verifying"
	StatusVerified     AuditStatus = "verified"
	StatusProcessing   AuditStatus = "processing"
	StatusProcessed    AuditStatus = "processed"
	StatusReviewing    AuditStatus = "reviewing"
	StatusReviewPassed AuditStatus = "review_passed"
	StatusClosed       AuditStatus = "closed"
	StatusRejected     AuditStatus = "rejected"
)

type SubsidyApplication struct {
	BaseModel
	ApplicationNo   string      `gorm:"uniqueIndex;size:50;not null" json:"application_no"`
	ApplicationYear int         `gorm:"index;not null" json:"application_year"`
	ApplicantName   string      `gorm:"size:50;not null" json:"applicant_name"`
	ApplicantIDCard string      `gorm:"size:30;not null" json:"applicant_id_card"`
	VesselID        uuid.UUID   `gorm:"index;not null" json:"vessel_id"`
	VesselNumber    string      `gorm:"size:50;not null" json:"vessel_number"`
	Status          AuditStatus `gorm:"size:20;index;not null" json:"status"`
	CurrentStage    string      `gorm:"size:20;not null" json:"current_stage"`
	TotalFuelAmount float64     `json:"total_fuel_amount"`
	SubsidyAmount   float64     `json:"subsidy_amount"`
	SubsidyRate     float64     `json:"subsidy_rate"`
	ReceivedBy      string      `json:"received_by"`
	ReceivedAt      *time.Time  `json:"received_at"`
	VerifiedBy      string      `json:"verified_by"`
	VerifiedAt      *time.Time  `json:"verified_at"`
	ProcessedBy     string      `json:"processed_by"`
	ProcessedAt     *time.Time  `json:"processed_at"`
	ReviewedBy      string      `json:"reviewed_by"`
	ReviewedAt      *time.Time  `json:"reviewed_at"`
	ClosedBy        string      `json:"closed_by"`
	ClosedAt        *time.Time  `json:"closed_at"`
	Remark          string      `gorm:"size:500" json:"remark"`
	DuplicateOf     *uuid.UUID  `gorm:"index" json:"duplicate_of"`
}

type ApplicationReceipt struct {
	BaseModel
	ApplicationID uuid.UUID `gorm:"index;not null" json:"application_id"`
	ReceiptID     uuid.UUID `gorm:"index;not null" json:"receipt_id"`
	ReceiptNumber string    `gorm:"size:100;not null" json:"receipt_number"`
	FuelAmount    float64   `gorm:"not null" json:"fuel_amount"`
}

type AuditLog struct {
	BaseModel
	ApplicationID uuid.UUID   `gorm:"index;not null" json:"application_id"`
	FromStatus    AuditStatus `gorm:"size:20" json:"from_status"`
	ToStatus      AuditStatus `gorm:"size:20;not null" json:"to_status"`
	Stage         string      `gorm:"size:20;not null" json:"stage"`
	Operator      string      `gorm:"size:50;not null" json:"operator"`
	OperatorName  string      `gorm:"size:50;not null" json:"operator_name"`
	Reason        string      `gorm:"size:500;not null" json:"reason"`
	Passed        bool        `json:"passed"`
}

type SubsidyReport struct {
	BaseModel
	ReportNo        string    `gorm:"uniqueIndex;size:50;not null" json:"report_no"`
	ReportType      string    `gorm:"size:20;not null" json:"report_type"`
	ReportYear      int       `gorm:"index;not null" json:"report_year"`
	ReportMonth     int       `json:"report_month"`
	TotalVessels    int       `json:"total_vessels"`
	TotalApps       int       `json:"total_apps"`
	ApprovedApps    int       `json:"approved_apps"`
	RejectedApps    int       `json:"rejected_apps"`
	TotalFuelAmount float64   `json:"total_fuel_amount"`
	TotalSubsidy    float64   `json:"total_subsidy"`
	GeneratedBy     string    `gorm:"size:50;not null" json:"generated_by"`
	GeneratedAt     time.Time `gorm:"not null" json:"generated_at"`
	FilePath        string    `gorm:"size:200" json:"file_path"`
}
