package model

import (
	"time"
)

type Role string

const (
	RoleDataEntry Role = "data_entry"
	RoleReviewer  Role = "reviewer"
	RoleSupervisor Role = "supervisor"
	RoleReadOnly  Role = "read_only"
)

type User struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	Username  string    `gorm:"uniqueIndex" json:"username"`
	Password  string    `json:"-"`
	Role      Role      `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type VisitorAppointment struct {
	ID                string    `gorm:"primaryKey" json:"id"`
	BatchID           string    `gorm:"index" json:"batch_id"`
	VisitorName       string    `json:"visitor_name"`
	VisitorIDCard     string    `json:"visitor_id_card"`
	VisitorPhone      string    `json:"visitor_phone"`
	LicensePlate      string    `json:"license_plate"`
	VisitDate         time.Time `gorm:"index" json:"visit_date"`
	VisitEndDate      time.Time `json:"visit_end_date"`
	VisitReason       string    `json:"visit_reason"`
	VisitorCompany    string    `json:"visitor_company"`
	HostName          string    `json:"host_name"`
	HostDepartment    string    `json:"host_department"`
	AccessArea        string    `json:"access_area"`
	Status            string    `gorm:"index" json:"status"`
	IsFrozen          bool      `gorm:"index" json:"is_frozen"`
	FrozenAt          *time.Time `json:"frozen_at,omitempty"`
	FrozenBy          string    `json:"frozen_by,omitempty"`
	CreatedBy         string    `json:"created_by"`
	ReviewedBy        string    `json:"reviewed_by,omitempty"`
	ReviewedAt        *time.Time `json:"reviewed_at,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type GateRecord struct {
	ID                string    `gorm:"primaryKey" json:"id"`
	BatchID           string    `gorm:"index" json:"batch_id"`
	GateName          string    `json:"gate_name"`
	PassDirection     string    `json:"pass_direction"`
	PassTime          time.Time `gorm:"index" json:"pass_time"`
	LicensePlate      string    `json:"license_plate"`
	VisitorName       string    `json:"visitor_name"`
	VisitorIDCard     string    `json:"visitor_id_card"`
	Temperature       float64   `json:"temperature"`
	StaffName         string    `json:"staff_name"`
	ImagePath         string    `json:"image_path,omitempty"`
	Status            string    `json:"status"`
	MatchedApptID     string    `gorm:"index" json:"matched_appt_id,omitempty"`
	MatchStatus       string    `json:"match_status"`
	Reconciled        bool      `gorm:"index" json:"reconciled"`
	CreatedBy         string    `json:"created_by"`
	CreatedAt         time.Time `json:"created_at"`
}

type TempPlateImage struct {
	ID                string    `gorm:"primaryKey" json:"id"`
	BatchID           string    `gorm:"index" json:"batch_id"`
	ImageFileName     string    `json:"image_file_name"`
	ImageHash         string    `gorm:"index" json:"image_hash"`
	LicensePlate      string    `gorm:"index" json:"license_plate"`
	RecognizedPlate   string    `json:"recognized_plate"`
	RecognitionConf   float64   `json:"recognition_confidence"`
	CaptureTime       time.Time `gorm:"index" json:"capture_time"`
	CaptureGate       string    `json:"capture_gate"`
	Status            string    `json:"status"`
	MatchedGateID     string    `json:"matched_gate_id,omitempty"`
	MatchStatus       string    `json:"match_status"`
	Reconciled        bool      `gorm:"index" json:"reconciled"`
	CreatedBy         string    `json:"created_by"`
	CreatedAt         time.Time `json:"created_at"`
}

type ReconciliationResult struct {
	ID                string    `gorm:"primaryKey" json:"id"`
	BatchID           string    `gorm:"index" json:"batch_id"`
	ReconcileDate     time.Time `gorm:"index" json:"reconcile_date"`
	TotalAppointments int       `json:"total_appointments"`
	TotalGateRecords  int       `json:"total_gate_records"`
	TotalPlateImages  int       `json:"total_plate_images"`
	MatchedCount      int       `json:"matched_count"`
	UnmatchedCount    int       `json:"unmatched_count"`
	CrossDayRiskCount int       `json:"cross_day_risk_count"`
	ExpiredNotRevoked int       `json:"expired_not_revoked"`
	Status            string    `json:"status"`
	ReportPath        string    `json:"report_path,omitempty"`
	CreatedBy         string    `json:"created_by"`
	CreatedAt         time.Time `json:"created_at"`
}

type ImportFailure struct {
	ID                string    `gorm:"primaryKey" json:"id"`
	BatchID           string    `gorm:"index" json:"batch_id"`
	SourceType        string    `json:"source_type"`
	RowNumber         int       `json:"row_number"`
	RawData           string    `json:"raw_data"`
	FailureReason     string    `json:"failure_reason"`
	FieldErrors       string    `json:"field_errors"`
	CreatedAt         time.Time `json:"created_at"`
}

type AuditLog struct {
	ID                string    `gorm:"primaryKey" json:"id"`
	UserID            string    `gorm:"index" json:"user_id"`
	Username          string    `json:"username"`
	Role              string    `json:"role"`
	Action            string    `gorm:"index" json:"action"`
	ResourceType      string    `json:"resource_type"`
	ResourceID        string    `json:"resource_id"`
	OldValue          string    `json:"old_value,omitempty"`
	NewValue          string    `json:"new_value,omitempty"`
	IPAddress         string    `json:"ip_address"`
	UserAgent         string    `json:"user_agent"`
	CreatedAt         time.Time `gorm:"index" json:"created_at"`
}

type Batch struct {
	ID                string    `gorm:"primaryKey" json:"id"`
	Name              string    `json:"name"`
	Source            string    `json:"source"`
	Status            string    `gorm:"index" json:"status"`
	IsFrozen          bool      `gorm:"index" json:"is_frozen"`
	FrozenAt          *time.Time `json:"frozen_at,omitempty"`
	FrozenBy          string    `json:"frozen_by,omitempty"`
	TotalRecords      int       `json:"total_records"`
	FailedRecords     int       `json:"failed_records"`
	CreatedBy         string    `json:"created_by"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}
