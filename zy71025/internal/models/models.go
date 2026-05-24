package models

import (
	"time"

	"gorm.io/gorm"
)

type Farmer struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Name        string         `gorm:"size:100;not null" json:"name"`
	IDCard      string         `gorm:"size:18;uniqueIndex" json:"id_card"`
	Phone       string         `gorm:"size:20" json:"phone"`
	Village     string         `gorm:"size:100" json:"village"`
	WaterRights []WaterRight   `json:"water_rights,omitempty"`
	Plots       []Plot         `json:"plots,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type Plot struct {
	ID                uint               `gorm:"primaryKey" json:"id"`
	FarmerID          uint               `gorm:"index" json:"farmer_id"`
	PlotNumber        string             `gorm:"size:50;uniqueIndex" json:"plot_number"`
	Area              float64            `gorm:"type:decimal(10,2)" json:"area"`
	Location          string             `gorm:"size:200" json:"location"`
	CropType          string             `gorm:"size:50" json:"crop_type"`
	IrrigationRecords []IrrigationRecord `json:"irrigation_records,omitempty"`
	CreatedAt         time.Time          `json:"created_at"`
	UpdatedAt         time.Time          `json:"updated_at"`
	DeletedAt         gorm.DeletedAt     `gorm:"index" json:"-"`
}

type WaterRight struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	FarmerID   uint           `gorm:"index" json:"farmer_id"`
	Year       int            `gorm:"index" json:"year"`
	Week       int            `gorm:"index" json:"week"`
	TotalQuota float64        `gorm:"type:decimal(10,2)" json:"total_quota"`
	UsedQuota  float64        `gorm:"type:decimal(10,2);default:0" json:"used_quota"`
	Balance    float64        `gorm:"type:decimal(10,2)" json:"balance"`
	Remarks    string         `gorm:"type:text" json:"remarks"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

const (
	TransferStatusPending   = "pending"
	TransferStatusApproved  = "approved"
	TransferStatusRejected  = "rejected"
	TransferStatusCompleted = "completed"
	TransferStatusRevoked   = "revoked"
)

type TransferApplication struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	TransferNo      string         `gorm:"size:50;uniqueIndex" json:"transfer_no"`
	FromFarmerID    uint           `gorm:"index" json:"from_farmer_id"`
	ToFarmerID      uint           `gorm:"index" json:"to_farmer_id"`
	Amount          float64        `gorm:"type:decimal(10,2)" json:"amount"`
	Reason          string         `gorm:"type:text" json:"reason"`
	Status          string         `gorm:"size:20;default:pending" json:"status"`
	Week            int            `json:"week"`
	Year            int            `json:"year"`
	EvidenceChain   string         `gorm:"type:text" json:"evidence_chain"`
	Operator        string         `gorm:"size:50" json:"operator"`
	ApprovalOpinion string         `gorm:"type:text" json:"approval_opinion"`
	ApprovedAt      *time.Time     `json:"approved_at"`
	RevokedAt       *time.Time     `json:"revoked_at"`
	RevokeReason    string         `gorm:"type:text" json:"revoke_reason"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

type IrrigationRecord struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	RecordNo       string         `gorm:"size:50;uniqueIndex" json:"record_no"`
	FarmerID       uint           `gorm:"index" json:"farmer_id"`
	PlotID         uint           `gorm:"index" json:"plot_id"`
	WaterAmount    float64        `gorm:"type:decimal(10,2)" json:"water_amount"`
	IrrigationDate time.Time      `json:"irrigation_date"`
	Week           int            `json:"week"`
	Year           int            `json:"year"`
	Operator       string         `gorm:"size:50" json:"operator"`
	Remarks        string         `gorm:"type:text" json:"remarks"`
	EvidenceChain  string         `gorm:"type:text" json:"evidence_chain"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

type BalanceReport struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	ReportNo       string    `gorm:"size:50;uniqueIndex" json:"report_no"`
	FarmerID       uint      `gorm:"index" json:"farmer_id"`
	Year           int       `json:"year"`
	Week           int       `json:"week"`
	InitialQuota   float64   `gorm:"type:decimal(10,2)" json:"initial_quota"`
	TransferIn     float64   `gorm:"type:decimal(10,2);default:0" json:"transfer_in"`
	TransferOut    float64   `gorm:"type:decimal(10,2);default:0" json:"transfer_out"`
	IrrigationUsed float64   `gorm:"type:decimal(10,2);default:0" json:"irrigation_used"`
	Balance        float64   `gorm:"type:decimal(10,2)" json:"balance"`
	GeneratedAt    time.Time `json:"generated_at"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type ChangeHistory struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	ResourceType string    `gorm:"size:50;index" json:"resource_type"`
	ResourceID   uint      `gorm:"index" json:"resource_id"`
	BeforeValue  string    `gorm:"type:text" json:"before_value"`
	AfterValue   string    `gorm:"type:text" json:"after_value"`
	ChangeReason string    `gorm:"type:text" json:"change_reason"`
	Operator     string    `gorm:"size:50" json:"operator"`
	CreatedAt    time.Time `json:"created_at"`
}
