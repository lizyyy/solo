package models

import (
	"time"
)

type RoadSection struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"size:100;not null" json:"name"`
	Code        string    `gorm:"size:50;unique;not null" json:"code"`
	SaltDemand  float64   `gorm:"not null" json:"salt_demand"`
	Status      string    `gorm:"size:20;default:'normal'" json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type SaltDepot struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"size:100;not null" json:"name"`
	Code        string    `gorm:"size:50;unique;not null" json:"code"`
	Location    string    `gorm:"size:200" json:"location"`
	Capacity    float64   `gorm:"not null" json:"capacity"`
	CurrentStock float64  `gorm:"not null;default:0" json:"current_stock"`
	LowThreshold float64  `gorm:"not null;default:10" json:"low_threshold"`
	WarningSent bool      `gorm:"default:false" json:"warning_sent"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Vehicle struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	PlateNumber string    `gorm:"size:20;unique;not null" json:"plate_number"`
	Capacity    float64   `gorm:"not null" json:"capacity"`
	DriverName  string    `gorm:"size:50" json:"driver_name"`
	Status      string    `gorm:"size:20;default:'idle'" json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type WeatherLevel struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Level       int       `gorm:"unique;not null" json:"level"`
	Name        string    `gorm:"size:50;not null" json:"name"`
	Description string    `gorm:"size:200" json:"description"`
	SaltRatio   float64   `gorm:"not null" json:"salt_ratio"`
	CreatedAt   time.Time `json:"created_at"`
}

type RoadClosure struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	RoadSectionID uint      `gorm:"not null" json:"road_section_id"`
	RoadSection   RoadSection `gorm:"foreignKey:RoadSectionID" json:"road_section,omitempty"`
	Reason        string    `gorm:"size:200;not null" json:"reason"`
	StartTime     time.Time `gorm:"not null" json:"start_time"`
	EndTime       *time.Time `json:"end_time"`
	Status        string    `gorm:"size:20;default:'active'" json:"status"`
	CreatedBy     string    `gorm:"size:50" json:"created_by"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type DispatchBatch struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	BatchNo         string    `gorm:"size:50;unique;not null" json:"batch_no"`
	WeatherLevelID  uint      `json:"weather_level_id"`
	WeatherLevel    WeatherLevel `gorm:"foreignKey:WeatherLevelID" json:"weather_level,omitempty"`
	Status          string    `gorm:"size:20;default:'pending'" json:"status"`
	TotalSaltAmount float64   `json:"total_salt_amount"`
	CreatedBy       string    `gorm:"size:50" json:"created_by"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	CompletedAt     *time.Time `json:"completed_at"`
}

type DispatchItem struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	DispatchBatchID uint      `gorm:"not null" json:"dispatch_batch_id"`
	SaltDepotID     uint      `gorm:"not null" json:"salt_depot_id"`
	SaltDepot       SaltDepot `gorm:"foreignKey:SaltDepotID" json:"salt_depot,omitempty"`
	VehicleID       uint      `gorm:"not null" json:"vehicle_id"`
	Vehicle         Vehicle   `gorm:"foreignKey:VehicleID" json:"vehicle,omitempty"`
	RoadSectionID   uint      `gorm:"not null" json:"road_section_id"`
	RoadSection     RoadSection `gorm:"foreignKey:RoadSectionID" json:"road_section,omitempty"`
	SaltAmount      float64   `gorm:"not null" json:"salt_amount"`
	Status          string    `gorm:"size:20;default:'pending'" json:"status"`
	HasAnomaly      bool      `gorm:"default:false" json:"has_anomaly"`
	AnomalyType     string    `gorm:"size:50" json:"anomaly_type"`
	AnomalyDesc     string    `gorm:"size:500" json:"anomaly_desc"`
	DispatchedAt    *time.Time `json:"dispatched_at"`
	ArrivedAt       *time.Time `json:"arrived_at"`
	ReceivedBy      string    `gorm:"size:50" json:"received_by"`
	ReceiptTime     *time.Time `json:"receipt_time"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type StockLog struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	SaltDepotID uint      `gorm:"not null" json:"salt_depot_id"`
	ChangeType  string    `gorm:"size:20;not null" json:"change_type"`
	Amount      float64   `gorm:"not null" json:"amount"`
	BeforeStock float64   `gorm:"not null" json:"before_stock"`
	AfterStock  float64   `gorm:"not null" json:"after_stock"`
	RefType     string    `gorm:"size:50" json:"ref_type"`
	RefID       uint      `json:"ref_id"`
	Remark      string    `gorm:"size:200" json:"remark"`
	CreatedBy   string    `gorm:"size:50" json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
}

type RouteStatusLog struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	DispatchItemID uint      `gorm:"not null" json:"dispatch_item_id"`
	Status         string    `gorm:"size:20;not null" json:"status"`
	Location       string    `gorm:"size:200" json:"location"`
	Remark         string    `gorm:"size:500" json:"remark"`
	CreatedBy      string    `gorm:"size:50" json:"created_by"`
	CreatedAt      time.Time `json:"created_at"`
}

type Receipt struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	DispatchItemID uint      `gorm:"not null;unique" json:"dispatch_item_id"`
	DispatchItem   DispatchItem `gorm:"foreignKey:DispatchItemID" json:"dispatch_item,omitempty"`
	ReceiptNo      string    `gorm:"size:50;unique;not null" json:"receipt_no"`
	ReceivedAmount float64   `gorm:"not null" json:"received_amount"`
	ReceiverName   string    `gorm:"size:50;not null" json:"receiver_name"`
	ReceiverSign   string    `gorm:"size:200" json:"receiver_sign"`
	Remark         string    `gorm:"size:500" json:"remark"`
	CreatedAt      time.Time `json:"created_at"`
}

type DispatchReport struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	ReportNo        string    `gorm:"size:50;unique;not null" json:"report_no"`
	DispatchBatchID uint      `gorm:"not null" json:"dispatch_batch_id"`
	DispatchBatch   DispatchBatch `gorm:"foreignKey:DispatchBatchID" json:"dispatch_batch,omitempty"`
	TotalItems      int       `json:"total_items"`
	CompletedItems  int       `json:"completed_items"`
	AnomalyItems    int       `json:"anomaly_items"`
	TotalSaltUsed   float64   `json:"total_salt_used"`
	ReportContent   string    `gorm:"type:text" json:"report_content"`
	GeneratedBy     string    `gorm:"size:50" json:"generated_by"`
	CreatedAt       time.Time `json:"created_at"`
}

type OperationLog struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	Operator   string    `gorm:"size:50" json:"operator"`
	Action     string    `gorm:"size:100;not null" json:"action"`
	Module     string    `gorm:"size:50" json:"module"`
	RefType    string    `gorm:"size:50" json:"ref_type"`
	RefID      uint      `json:"ref_id"`
	BeforeData string    `gorm:"type:text" json:"before_data"`
	AfterData  string    `gorm:"type:text" json:"after_data"`
	IPAddress  string    `gorm:"size:50" json:"ip_address"`
	CreatedAt  time.Time `json:"created_at"`
}
