package models

import "time"

type LiabilityStatus string

const (
	StatusPending    LiabilityStatus = "pending"
	StatusImported   LiabilityStatus = "imported"
	StatusValidated  LiabilityStatus = "validated"
	StatusProcessing LiabilityStatus = "processing"
	StatusDisputed   LiabilityStatus = "disputed"
	StatusConfirmed  LiabilityStatus = "confirmed"
	StatusRejected   LiabilityStatus = "rejected"
	StatusClosed     LiabilityStatus = "closed"
	StatusRevoked    LiabilityStatus = "revoked"
)

type ExhibitRecord struct {
	ID              int64           `json:"id"`
	ExhibitNo       string          `json:"exhibit_no"`
	ContractNo      string          `json:"contract_no"`
	CurrentVersion  int             `json:"current_version"`
	LiabilityStatus LiabilityStatus `json:"liability_status"`
	FinalConclusion string          `json:"final_conclusion"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
	CreatedBy       string          `json:"created_by"`
	UpdatedBy       string          `json:"updated_by"`
	IdempotentKey   string          `json:"idempotent_key"`
}

type ConditionVersion struct {
	ID              int64     `json:"id"`
	RecordID        int64     `json:"record_id"`
	Version         int       `json:"version"`
	CheckPoint      string    `json:"check_point"`
	CheckTime       time.Time `json:"check_time"`
	ConditionDesc   string    `json:"condition_desc"`
	HasScratch      bool      `json:"has_scratch"`
	ScratchLocation string    `json:"scratch_location"`
	ScratchSize     string    `json:"scratch_size"`
	InsuranceRemark string    `json:"insurance_remark"`
	Handler         string    `json:"handler"`
	TransportNode   string    `json:"transport_node"`
	CreatedAt       time.Time `json:"created_at"`
	PrevVersionID   *int64    `json:"prev_version_id"`
	ChangeSummary   string    `json:"change_summary"`
}

type PhotoEvidence struct {
	ID           int64      `json:"id"`
	VersionID    int64      `json:"version_id"`
	RecordID     int64      `json:"record_id"`
	PhotoHash    string     `json:"photo_hash"`
	PhotoURL     string     `json:"photo_url"`
	Provider     string     `json:"provider"`
	ProviderType string     `json:"provider_type"`
	PhotoTime    *time.Time `json:"photo_time"`
	TimeVerified bool       `json:"time_verified"`
	Description  string     `json:"description"`
	Sequence     int        `json:"sequence"`
	CreatedAt    time.Time  `json:"created_at"`
}

type VersionDiff struct {
	ID           int64     `json:"id"`
	RecordID     int64     `json:"record_id"`
	OldVersionID int64     `json:"old_version_id"`
	NewVersionID int64     `json:"new_version_id"`
	FieldName    string    `json:"field_name"`
	OldValue     string    `json:"old_value"`
	NewValue     string    `json:"new_value"`
	DiffType     string    `json:"diff_type"`
	ChangedBy    string    `json:"changed_by"`
	CreatedAt    time.Time `json:"created_at"`
}

type LiabilityConclusion struct {
	ID              int64           `json:"id"`
	RecordID        int64           `json:"record_id"`
	VersionID       int64           `json:"version_id"`
	LiableParty     string          `json:"liable_party"`
	LiableReason    string          `json:"liable_reason"`
	ConfidenceLevel float64         `json:"confidence_level"`
	Status          LiabilityStatus `json:"status"`
	Reviewer        string          `json:"reviewer"`
	ReviewTime      *time.Time      `json:"review_time"`
	ReviewComment   string          `json:"review_comment"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

type OperationLog struct {
	ID          int64     `json:"id"`
	RecordID    int64     `json:"record_id"`
	Operation   string    `json:"operation"`
	Operator    string    `json:"operator"`
	BeforeState string    `json:"before_state"`
	AfterState  string    `json:"after_state"`
	Remark      string    `json:"remark"`
	CreatedAt   time.Time `json:"created_at"`
}
