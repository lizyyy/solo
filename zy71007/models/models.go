package models

import "time"

type RecallStatus string

const (
	StatusPending   RecallStatus = "pending"
	StatusConfirmed RecallStatus = "confirmed"
	StatusRejected  RecallStatus = "rejected"
	StatusResolved  RecallStatus = "resolved"
	StatusWithdrawn RecallStatus = "withdrawn"
)

type Material struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	BatchNumber  string    `gorm:"size:100;uniqueIndex" json:"batch_number"`
	MaterialName string    `gorm:"size:200" json:"material_name"`
	Manufacturer string    `gorm:"size:200" json:"manufacturer"`
	Supplier     string    `gorm:"size:200" json:"supplier"`
	Quantity     int       `json:"quantity"`
	Unit         string    `gorm:"size:50" json:"unit"`
	InboundDate  time.Time `json:"inbound_date"`
	ExpiryDate   time.Time `json:"expiry_date"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Patient struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	PatientID   string    `gorm:"size:50;uniqueIndex" json:"patient_id"`
	Name        string    `gorm:"size:100" json:"name"`
	Gender      string    `gorm:"size:10" json:"gender"`
	Age         int       `json:"age"`
	Phone       string    `gorm:"size:20" json:"phone"`
	Department  string    `gorm:"size:100" json:"department"`
	BedNumber   string    `gorm:"size:50" json:"bed_number"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type DialysisShift struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ShiftCode   string    `gorm:"size:50;uniqueIndex" json:"shift_code"`
	ShiftDate   time.Time `json:"shift_date"`
	ShiftType   string    `gorm:"size:50" json:"shift_type"`
	MachineID   string    `gorm:"size:50" json:"machine_id"`
	Nurse       string    `gorm:"size:100" json:"nurse"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ConsumptionRecord struct {
	ID                uint          `gorm:"primaryKey" json:"id"`
	RecordNo          string        `gorm:"size:100;uniqueIndex" json:"record_no"`
	PatientID         uint          `json:"patient_id"`
	DialysisShiftID   uint          `json:"dialysis_shift_id"`
	MaterialID        uint          `json:"material_id"`
	QuantityUsed      int           `json:"quantity_used"`
	UsageTime         time.Time     `json:"usage_time"`
	Operator          string        `gorm:"size:100" json:"operator"`
	Remark            string        `gorm:"size:500" json:"remark"`
	CreatedAt         time.Time     `json:"created_at"`
	UpdatedAt         time.Time     `json:"updated_at"`
}

type RecallNotice struct {
	ID             uint         `gorm:"primaryKey" json:"id"`
	NoticeNo       string       `gorm:"size:100;uniqueIndex" json:"notice_no"`
	Title          string       `gorm:"size:200" json:"title"`
	BatchNumber    string       `gorm:"size:100" json:"batch_number"`
	Reason         string       `gorm:"size:1000" json:"reason"`
	Publisher      string       `gorm:"size:100" json:"publisher"`
	PublishDate    time.Time    `json:"publish_date"`
	EffectiveDate  time.Time    `json:"effective_date"`
	Status         RecallStatus `gorm:"size:50;default:pending" json:"status"`
	TracedCount    int          `gorm:"default:0" json:"traced_count"`
	ConfirmedCount int          `gorm:"default:0" json:"confirmed_count"`
	CreatedAt      time.Time    `json:"created_at"`
	UpdatedAt      time.Time    `json:"updated_at"`
}

type TraceResult struct {
	ID                  uint         `gorm:"primaryKey" json:"id"`
	TraceKey            string       `gorm:"size:200;uniqueIndex" json:"trace_key"`
	RecallNoticeID      uint         `json:"recall_notice_id"`
	ConsumptionRecordID uint         `json:"consumption_record_id"`
	PatientID           uint         `json:"patient_id"`
	Status              RecallStatus `gorm:"size:50;default:pending" json:"status"`
	TraceTime           time.Time    `json:"trace_time"`
	IsAffected          bool         `gorm:"default:true" json:"is_affected"`
	ReviewedBy          string       `gorm:"size:100" json:"reviewed_by"`
	ReviewedAt          *time.Time   `json:"reviewed_at"`
	ReviewRemark        string       `gorm:"size:500" json:"review_remark"`
	CreatedAt           time.Time    `json:"created_at"`
	UpdatedAt           time.Time    `json:"updated_at"`
}

type ReviewRecord struct {
	ID            uint         `gorm:"primaryKey" json:"id"`
	TraceResultID uint         `json:"trace_result_id"`
	OldStatus     RecallStatus `gorm:"size:50" json:"old_status"`
	NewStatus     RecallStatus `gorm:"size:50" json:"new_status"`
	Reviewer      string       `gorm:"size:100" json:"reviewer"`
	ReviewTime    time.Time    `json:"review_time"`
	Reason        string       `gorm:"size:500" json:"reason"`
	CreatedAt     time.Time    `json:"created_at"`
}

type TraceHistory struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	RecallNoticeID uint      `json:"recall_notice_id"`
	Operator       string    `gorm:"size:100" json:"operator"`
	TraceTime      time.Time `json:"trace_time"`
	AffectedCount  int       `json:"affected_count"`
	NewRecordCount int       `json:"new_record_count"`
	CreatedAt      time.Time `json:"created_at"`
}
	RecallNoticeID  uint      `json:"recall_notice_id"`
	RecallNotice    RecallNotice `gorm:"foreignKey:RecallNoticeID" json:"recall_notice"`
	Operator        string    `gorm:"size:100" json:"operator"`
	TraceTime       time.Time `json:"trace_time"`
	AffectedCount   int       `json:"affected_count"`
	NewRecordCount  int       `json:"new_record_count"`
	CreatedAt       time.Time `json:"created_at"`
}
	ConsumptionID   string       `gorm:"type:varchar(36);index;not null" json:"consumption_id"`
	PatientID       string       `gorm:"type:varchar(36);index;not null" json:"patient_id"`
	BatchNumber     string       `gorm:"type:varchar(100);index;not null" json:"batch_number"`
	ShiftID         string       `gorm:"type:varchar(36);index;not null" json:"shift_id"`
	Status          RecallStatus `gorm:"type:varchar(50);default:pending" json:"status"`
	IsConflict      bool         `gorm:"default:false" json:"is_conflict"`
	ConflictReason  string       `gorm:"type:text" json:"conflict_reason"`
	ManualOverride  bool         `gorm:"default:false" json:"manual_override"`
	OverrideBy      string       `gorm:"type:varchar(100)" json:"override_by"`
	OverrideAt      time.Time    `json:"override_at"`
	OverrideReason  string       `gorm:"type:text" json:"override_reason"`
	Remarks         string       `gorm:"type:text" json:"remarks"`
	Consumption     ConsumptionRecord `gorm:"foreignKey:ConsumptionID" json:"consumption,omitempty"`
	Patient         Patient           `gorm:"foreignKey:PatientID" json:"patient,omitempty"`
	Shift           DialysisShift     `gorm:"foreignKey:ShiftID" json:"shift,omitempty"`
	Recall          RecallNotice      `gorm:"foreignKey:RecallID" json:"recall,omitempty"`
}

type ReviewRecord struct {
	BaseModel
	TraceResultID string    `gorm:"type:varchar(36);index;not null" json:"trace_result_id"`
	Reviewer      string    `gorm:"type:varchar(100);not null" json:"reviewer"`
	ReviewAction  string    `gorm:"type:varchar(50);not null" json:"review_action"`
	OldStatus     string    `gorm:"type:varchar(50)" json:"old_status"`
	NewStatus     string    `gorm:"type:varchar(50)" json:"new_status"`
	ReviewTime    time.Time `gorm:"not null" json:"review_time"`
	Comments      string    `gorm:"type:text" json:"comments"`
	TraceResult   TraceResult `gorm:"foreignKey:TraceResultID" json:"trace_result,omitempty"`
}

type TraceHistory struct {
	BaseModel
	RecallID      string `gorm:"type:varchar(36);index;not null" json:"recall_id"`
	ActionType    string `gorm:"type:varchar(100);not null" json:"action_type"`
	Operator      string `gorm:"type:varchar(100)" json:"operator"`
	ActionTime    time.Time `gorm:"not null" json:"action_time"`
	Description   string `gorm:"type:text" json:"description"`
	AffectedCount int `json:"affected_count"`
}
