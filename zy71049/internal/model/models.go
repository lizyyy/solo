package model

import (
	"time"
)

type Order struct {
	ID           string    `json:"id" db:"id"`
	OrderNo      string    `json:"order_no" db:"order_no"`
	CustomerName string    `json:"customer_name" db:"customer_name"`
	ProductName  string    `json:"product_name" db:"product_name"`
	Quantity     int       `json:"quantity" db:"quantity"`
	Status       string    `json:"status" db:"status"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

type Paper struct {
	ID         string    `json:"id" db:"id"`
	Name       string    `json:"name" db:"name"`
	Type       string    `json:"type" db:"type"`
	Weight     int       `json:"weight" db:"weight"`
	Size       string    `json:"size" db:"size"`
	IsApproved bool      `json:"is_approved" db:"is_approved"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

type ProofVersion struct {
	ID              string    `json:"id" db:"id"`
	OrderID         string    `json:"order_id" db:"order_id"`
	VersionNo       int       `json:"version_no" db:"version_no"`
	PaperID         string    `json:"paper_id" db:"paper_id"`
	Status          string    `json:"status" db:"status"`
	IsColorApproved bool      `json:"is_color_approved" db:"is_color_approved"`
	IsPaperApproved bool      `json:"is_paper_approved" db:"is_paper_approved"`
	IsFinalVersion  bool      `json:"is_final_version" db:"is_final_version"`
	Notes           string    `json:"notes" db:"notes"`
	CreatedBy       string    `json:"created_by" db:"created_by"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
}

type ColorValue struct {
	ID             string `json:"id" db:"id"`
	ProofVersionID string `json:"proof_version_id" db:"proof_version_id"`
	ColorType      string `json:"color_type" db:"color_type"`
	ColorName      string `json:"color_name" db:"color_name"`
	CValue         int    `json:"c_value" db:"c_value"`
	MValue         int    `json:"m_value" db:"m_value"`
	YValue         int    `json:"y_value" db:"y_value"`
	KValue         int    `json:"k_value" db:"k_value"`
	HexValue       string `json:"hex_value" db:"hex_value"`
	IsOutOfGamut   bool   `json:"is_out_of_gamut" db:"is_out_of_gamut"`
}

type Confirmation struct {
	ID             string    `json:"id" db:"id"`
	ProofVersionID string    `json:"proof_version_id" db:"proof_version_id"`
	Confirmer      string    `json:"confirmer" db:"confirmer"`
	ConfirmType    string    `json:"confirm_type" db:"confirm_type"`
	Result         string    `json:"result" db:"result"`
	Comments       string    `json:"comments" db:"comments"`
	ConfirmedAt    time.Time `json:"confirmed_at" db:"confirmed_at"`
}

type ChangeLog struct {
	ID             string    `json:"id" db:"id"`
	ProofVersionID string    `json:"proof_version_id" db:"proof_version_id"`
	FieldName      string    `json:"field_name" db:"field_name"`
	OldValue       string    `json:"old_value" db:"old_value"`
	NewValue       string    `json:"new_value" db:"new_value"`
	ChangedBy      string    `json:"changed_by" db:"changed_by"`
	ChangeType     string    `json:"change_type" db:"change_type"`
	ChangedAt      time.Time `json:"changed_at" db:"changed_at"`
}

type ProductionReport struct {
	ID             string    `json:"id" db:"id"`
	OrderID        string    `json:"order_id" db:"order_id"`
	ProofVersionID string    `json:"proof_version_id" db:"proof_version_id"`
	ReportNo       string    `json:"report_no" db:"report_no"`
	ProductionDate string    `json:"production_date" db:"production_date"`
	ActualQuantity int       `json:"actual_quantity" db:"actual_quantity"`
	Result         string    `json:"result" db:"result"`
	GeneratedBy    string    `json:"generated_by" db:"generated_by"`
	GeneratedAt    time.Time `json:"generated_at" db:"generated_at"`
}

type Handler struct {
	ID        string    `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	Role      string    `json:"role" db:"role"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

const (
	OrderStatusPending   = "pending"
	OrderStatusApproved  = "approved"
	OrderStatusProducing = "producing"
	OrderStatusCompleted = "completed"
	OrderStatusRejected  = "rejected"
)

const (
	VersionStatusDraft       = "draft"
	VersionStatusSubmitted   = "submitted"
	VersionStatusReviewing   = "reviewing"
	VersionStatusAutoPass    = "auto_pass"
	VersionStatusAutoFail    = "auto_fail"
	VersionStatusApproved    = "approved"
	VersionStatusRejected    = "rejected"
	VersionStatusNeedSupplement = "need_supplement"
	VersionStatusFinalized   = "finalized"
)

const (
	ConfirmTypeColor  = "color"
	ConfirmTypePaper  = "paper"
	ConfirmTypeFinal  = "final"
)

const (
	ConfirmResultApprove = "approve"
	ConfirmResultReject  = "reject"
)

const (
	ChangeTypeCreate    = "create"
	ChangeTypeUpdate    = "update"
	ChangeTypeSupplement = "supplement"
)

const (
	ReportResultSuccess = "success"
	ReportResultFailed  = "failed"
)
