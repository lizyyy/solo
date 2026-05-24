package models

import "time"

type Refrigerator struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Location  string    `json:"location"`
	CreatedAt time.Time `json:"created_at"`
}

type Vaccine struct {
	BatchNumber  string    `json:"batch_number"`
	Name         string    `json:"name"`
	Manufacturer string    `json:"manufacturer"`
	ExpiryDate   time.Time `json:"expiry_date"`
	TotalDoses   int       `json:"total_doses"`
	CreatedAt    time.Time `json:"created_at"`
}

type VaccineInventory struct {
	ID             string    `json:"id"`
	BatchNumber    string    `json:"batch_number"`
	RefrigeratorID string    `json:"refrigerator_id"`
	DosesCount     int       `json:"doses_count"`
	Status         string    `json:"status"`
	ReceivedAt     time.Time `json:"received_at"`
}

type TemperatureRecord struct {
	ID             string    `json:"id"`
	RefrigeratorID string    `json:"refrigerator_id"`
	Temperature    float64   `json:"temperature"`
	RecordedAt     time.Time `json:"recorded_at"`
	RecordedBy     string    `json:"recorded_by"`
	EvidenceID     string    `json:"evidence_id"`
}

type OpenRecord struct {
	ID             string     `json:"id"`
	InventoryID    string     `json:"inventory_id"`
	BatchNumber    string     `json:"batch_number"`
	OpenedAt       time.Time  `json:"opened_at"`
	OpenedBy       string     `json:"opened_by"`
	DosesUsed      int        `json:"doses_used"`
	Status         string     `json:"status"`
	ClosedAt       *time.Time `json:"closed_at"`
	ClosedBy       *string    `json:"closed_by"`
	EvidenceID     string     `json:"evidence_id"`
}

type TransferRecord struct {
	ID                 string    `json:"id"`
	BatchNumber        string    `json:"batch_number"`
	FromRefrigeratorID string    `json:"from_refrigerator_id"`
	ToRefrigeratorID   string    `json:"to_refrigerator_id"`
	DosesCount         int       `json:"doses_count"`
	TransferredAt      time.Time `json:"transferred_at"`
	TransferredBy      string    `json:"transferred_by"`
	Reason             string    `json:"reason"`
	EvidenceID         string    `json:"evidence_id"`
}

type DiscardRecord struct {
	ID           string     `json:"id"`
	BatchNumber  string     `json:"batch_number"`
	InventoryID  *string    `json:"inventory_id"`
	OpenRecordID *string    `json:"open_record_id"`
	DosesCount   int        `json:"doses_count"`
	Reason       string     `json:"reason"`
	DiscardedAt  time.Time  `json:"discarded_at"`
	DiscardedBy  string     `json:"discarded_by"`
	Confirmed    bool       `json:"confirmed"`
	ConfirmedAt  *time.Time `json:"confirmed_at"`
	ConfirmedBy  *string    `json:"confirmed_by"`
	EvidenceID   string     `json:"evidence_id"`
}

type VaccinationRecord struct {
	ID              string    `json:"id"`
	BatchNumber     string    `json:"batch_number"`
	OpenRecordID    string    `json:"open_record_id"`
	PatientID       string    `json:"patient_id"`
	VaccinatedAt    time.Time `json:"vaccinated_at"`
	DoctorSignature string    `json:"doctor_signature"`
	EvidenceID      string    `json:"evidence_id"`
}

type EvidenceChain struct {
	ID           string    `json:"id"`
	BusinessKey  string    `json:"business_key"`
	BusinessType string    `json:"business_type"`
	EvidenceType string    `json:"evidence_type"`
	EvidenceData string    `json:"evidence_data"`
	SubmittedBy  string    `json:"submitted_by"`
	SubmittedAt  time.Time `json:"submitted_at"`
	Version      int       `json:"version"`
}

type BusinessResult struct {
	ID                string     `json:"id"`
	BusinessKey       string     `json:"business_key"`
	BusinessType      string     `json:"business_type"`
	ResultStatus      string     `json:"result_status"`
	ResultData        string     `json:"result_data"`
	CalculatedAt      time.Time  `json:"calculated_at"`
	RecalculatedCount int        `json:"recalculated_count"`
	LastRecalculatedAt *time.Time `json:"last_recalculated_at"`
}

type ColdChainReport struct {
	ID             string    `json:"id"`
	ReportType     string    `json:"report_type"`
	BatchNumber    *string   `json:"batch_number"`
	RefrigeratorID *string   `json:"refrigerator_id"`
	StartDate      time.Time `json:"start_date"`
	EndDate        time.Time `json:"end_date"`
	ReportData     string    `json:"report_data"`
	GeneratedAt    time.Time `json:"generated_at"`
	GeneratedBy    string    `json:"generated_by"`
}

type SubmissionRequest struct {
	BusinessKey    string      `json:"business_key" binding:"required"`
	BusinessType   string      `json:"business_type" binding:"required"`
	EvidenceType   string      `json:"evidence_type" binding:"required"`
	EvidenceData   interface{} `json:"evidence_data"`
	SubmittedBy    string      `json:"submitted_by" binding:"required"`
	AutoEvaluate   bool        `json:"auto_evaluate"`
}

type ColdChainValidation struct {
	Valid            bool      `json:"valid"`
	Breakpoints      []Breakpoint `json:"breakpoints"`
	MinTemp          float64   `json:"min_temp"`
	MaxTemp          float64   `json:"max_temp"`
	AvgTemp          float64   `json:"avg_temp"`
	ValidationWindow struct {
		Start time.Time `json:"start"`
		End   time.Time `json:"end"`
	} `json:"validation_window"`
}

type Breakpoint struct {
	Time        time.Time `json:"time"`
	Temperature float64   `json:"temperature"`
	Reason      string    `json:"reason"`
}

type OpenVialStatus struct {
	OpenRecordID   string    `json:"open_record_id"`
	Status         string    `json:"status"`
	OpenedAt       time.Time `json:"opened_at"`
	TimeOpen       string    `json:"time_open"`
	MaxAllowedTime string    `json:"max_allowed_time"`
	Expired        bool      `json:"expired"`
	DosesRemaining int       `json:"doses_remaining"`
	DosesUsed      int       `json:"doses_used"`
}

type TransferTrail struct {
	Transfers    []TransferRecord `json:"transfers"`
	CurrentFridge string          `json:"current_fridge"`
	TotalTransfers int            `json:"total_transfers"`
}
