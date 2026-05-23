package models

import (
	"time"
)

type LiabilityStatus string

const (
	StatusPending     LiabilityStatus = "pending"
	StatusImported    LiabilityStatus = "imported"
	StatusValidated   LiabilityStatus = "validated"
	StatusProcessing  LiabilityStatus = "processing"
	StatusDisputed    LiabilityStatus = "disputed"
	StatusConfirmed   LiabilityStatus = "confirmed"
	StatusRejected    LiabilityStatus = "rejected"
	StatusClosed      LiabilityStatus = "closed"
	StatusRevoked     LiabilityStatus = "revoked"
)

type ExhibitRecord struct {
	ID              int64           `json:"id" db:"id"`
	ExhibitNo       string          `json:"exhibit_no" db:"exhibit_no"`
	ContractNo      string          `json:"contract_no" db:"contract_no"`
	CurrentVersion  int             `json:"current_version" db:"current_version"`
	LiabilityStatus LiabilityStatus `json:"liability_status" db:"liability_status"`
	FinalConclusion string          `json:"final_conclusion" db:"final_conclusion"`
	CreatedAt       time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at" db:"updated_at"`
	CreatedBy       string          `json:"created_by" db:"created_by"`
	UpdatedBy       string          `json:"updated_by" db:"updated_by"`
	IdempotentKey   string          `json:"idempotent_key" db:"idempotent_key"`
}

type ConditionVersion struct {
	ID               int64     `json:"id" db:"id"`
	RecordID         int64     `json:"record_id" db:"record_id"`
	Version          int       `json:"version" db:"version"`
	CheckPoint       string    `json:"check_point" db:"check_point"`
	CheckTime        time.Time `json:"check_time" db:"check_time"`
	ConditionDesc    string    `json:"condition_desc" db:"condition_desc"`
	HasScratch       bool      `json:"has_scratch" db:"has_scratch"`
	ScratchLocation  string    `json:"scratch_location" db:"scratch_location"`
	ScratchSize      string    `json:"scratch_size" db:"scratch_size"`
	InsuranceRemark  string    `json:"insurance_remark" db:"insurance_remark"`
	Handler          string    `json:"handler" db:"handler"`
	TransportNode    string    `json:"transport_node" db:"transport_node"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	PrevVersionID    *int64    `json:"prev_version_id" db:"prev_version_id"`
	ChangeSummary    string    `json:"change_summary" db:"change_summary"`
}
