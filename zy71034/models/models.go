package models

import (
	"time"
)

type Patient struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name"`
	IDCard    string    `json:"id_card"`
	Phone     string    `json:"phone"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Consultation struct {
	ID             string    `json:"id" gorm:"primaryKey"`
	PatientID      string    `json:"patient_id"`
	DoctorID       string    `json:"doctor_id"`
	DoctorName     string    `json:"doctor_name"`
	Department     string    `json:"department"`
	ChiefComplaint string    `json:"chief_complaint"`
	Diagnosis      string    `json:"diagnosis"`
	ConsultTime    time.Time `json:"consult_time"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type Prescription struct {
	ID                 string     `json:"id" gorm:"primaryKey"`
	ConsultationID     string     `json:"consultation_id"`
	PatientID          string     `json:"patient_id"`
	DoctorID           string     `json:"doctor_id"`
	DoctorName         string     `json:"doctor_name"`
	PrescriptionTime   time.Time  `json:"prescription_time"`
	DrugList           string     `json:"drug_list"`
	Dosage             string     `json:"dosage"`
	DoctorAdvice       string     `json:"doctor_advice"`
	Status             string     `json:"status"`
	ValidityHours      int        `json:"validity_hours"`
	PatientConfirmTime *time.Time `json:"patient_confirm_time"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type PharmacistReview struct {
	ID             string    `json:"id" gorm:"primaryKey"`
	PrescriptionID string    `json:"prescription_id"`
	PharmacistID   string    `json:"pharmacist_id"`
	PharmacistName string    `json:"pharmacist_name"`
	ReviewTime     time.Time `json:"review_time"`
	ReviewResult   string    `json:"review_result"`
	ReviewOpinion  string    `json:"review_opinion"`
	IsFirstReview  bool      `json:"is_first_review"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type DrugDispensation struct {
	ID                 string    `json:"id" gorm:"primaryKey"`
	PrescriptionID     string    `json:"prescription_id"`
	PharmacistID       string    `json:"pharmacist_id"`
	PharmacistName     string    `json:"pharmacist_name"`
	DispensationTime   time.Time `json:"dispensation_time"`
	DrugItems          string    `json:"drug_items"`
	IsDuplicate        bool      `json:"is_duplicate"`
	Intercepted        bool      `json:"intercepted"`
	InterceptReason    string    `json:"intercept_reason"`
	InterceptLevel     string    `json:"intercept_level"`
	ManualOverride     bool      `json:"manual_override"`
	OverrideOperatorID string    `json:"override_operator_id"`
	OverrideReason     string    `json:"override_reason"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type PrescriptionReport struct {
	ID                    string     `json:"id" gorm:"primaryKey"`
	PrescriptionID        string     `json:"prescription_id"`
	ConsultationID        string     `json:"consultation_id"`
	PatientID             string     `json:"patient_id"`
	TotalTimeMinutes      int        `json:"total_time_minutes"`
	DoctorAdviceTime      time.Time  `json:"doctor_advice_time"`
	PatientConfirmTime    *time.Time `json:"patient_confirm_time"`
	ReviewTime            *time.Time `json:"review_time"`
	DispensationTime      *time.Time `json:"dispensation_time"`
	HasTimeout            bool       `json:"has_timeout"`
	TimeoutDetails        string     `json:"timeout_details"`
	HasPatientUnconfirmed bool       `json:"has_patient_unconfirmed"`
	HasDuplicateRisk      bool       `json:"has_duplicate_risk"`
	ProcessingSuggestion  string     `json:"processing_suggestion"`
	FinalConclusion       string     `json:"final_conclusion"`
	OperatorID            string     `json:"operator_id"`
	OperatorName          string     `json:"operator_name"`
	ClosedAt              *time.Time `json:"closed_at"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
}

type SupplementRecord struct {
	ID             string    `json:"id" gorm:"primaryKey"`
	PrescriptionID string    `json:"prescription_id"`
	FieldName      string    `json:"field_name"`
	BeforeValue    string    `json:"before_value"`
	AfterValue     string    `json:"after_value"`
	OperatorID     string    `json:"operator_id"`
	OperatorName   string    `json:"operator_name"`
	SupplementTime time.Time `json:"supplement_time"`
	Remark         string    `json:"remark"`
	CreatedAt      time.Time `json:"created_at"`
}

type ProcessingLog struct {
	ID              string    `json:"id" gorm:"primaryKey"`
	PrescriptionID  string    `json:"prescription_id"`
	ActionType      string    `json:"action_type"`
	ActionDetail    string    `json:"action_detail"`
	OperatorID      string    `json:"operator_id"`
	OperatorName    string    `json:"operator_name"`
	IsManualConfirm bool      `json:"is_manual_confirm"`
	CreatedAt       time.Time `json:"created_at"`
}

type ValidationResult struct {
	IsValid             bool        `json:"is_valid"`
	PrescriptionID      string      `json:"prescription_id"`
	TimeoutCheck        CheckResult `json:"timeout_check"`
	PatientConfirmCheck CheckResult `json:"patient_confirm_check"`
	DuplicateCheck      CheckResult `json:"duplicate_check"`
	Suggestions         []string    `json:"suggestions"`
	TotalIssues         int         `json:"total_issues"`
}

type CheckResult struct {
	Passed  bool   `json:"passed"`
	Message string `json:"message"`
	Level   string `json:"level"`
}

const (
	PrescriptionStatusPending   = "pending"
	PrescriptionStatusReviewed  = "reviewed"
	PrescriptionStatusConfirmed = "confirmed"
	PrescriptionStatusDispensed = "dispensed"
	PrescriptionStatusRejected  = "rejected"
	PrescriptionStatusTimeout   = "timeout"
	PrescriptionStatusClosed    = "closed"

	ReviewResultPass    = "pass"
	ReviewResultReject  = "reject"
	ReviewResultPending = "pending"

	ActionTypeCreate     = "create"
	ActionTypeReview     = "review"
	ActionTypeConfirm    = "patient_confirm"
	ActionTypeDispense   = "dispense"
	ActionTypeSupplement = "supplement"
	ActionTypeClose      = "close"
	ActionTypeIntercept  = "intercept"
	ActionTypeOverride   = "override"

	InterceptLevelCritical = "critical"
	InterceptLevelWarning  = "warning"
)
