package service

type Inverter struct {
	SN                  string `json:"sn"`
	Model               string `json:"model"`
	Manufacturer        string `json:"manufacturer"`
	ProductionDate      string `json:"production_date"`
	InstallationDate    string `json:"installation_date"`
	Station             string `json:"station"`
	WarrantyPeriodMonths int   `json:"warranty_period_months"`
	CreatedAt           string `json:"created_at"`
}

type FaultCode struct {
	Code              string `json:"code"`
	Description       string `json:"description"`
	IsWarrantyCovered bool   `json:"is_warranty_covered"`
	Severity          string `json:"severity"`
	CreatedAt         string `json:"created_at"`
}

type SparePart struct {
	SN             string `json:"sn"`
	Type           string `json:"type"`
	Model          string `json:"model"`
	Manufacturer   string `json:"manufacturer"`
	ProductionDate string `json:"production_date"`
	Status         string `json:"status"`
	CreatedAt      string `json:"created_at"`
}

type FactoryOrder struct {
	ID           string `json:"id"`
	InverterSN   string `json:"inverter_sn"`
	FaultCode    string `json:"fault_code"`
	SparePartSN  string `json:"spare_part_sn"`
	IssueDate    string `json:"issue_date"`
	Description  string `json:"description"`
	Status       string `json:"status"`
	CreatedAt    string `json:"created_at"`
}

type Replacement struct {
	ID                      string   `json:"id"`
	InverterSN              string   `json:"inverter_sn"`
	NewInverterSN           string   `json:"new_inverter_sn"`
	FaultCode               string   `json:"fault_code"`
	SparePartSN             string   `json:"spare_part_sn"`
	FactoryOrderID          string   `json:"factory_order_id"`
	OldInverterPhotoURL     string   `json:"old_inverter_photo_url"`
	NewInverterPhotoURL     string   `json:"new_inverter_photo_url"`
	FaultPhotoURL           string   `json:"fault_photo_url"`
	WarrantyCertificateURL  string   `json:"warranty_certificate_url"`
	ReplacementDate         string   `json:"replacement_date"`
	Technician              string   `json:"technician"`
	Remark                  string   `json:"remark"`
	Status                  string   `json:"status"`
	VerificationResult      string   `json:"verification_result"`
	ReviewResult            string   `json:"review_result"`
	AcceptanceResult        string   `json:"acceptance_result"`
	CreatedAt               string   `json:"created_at"`
	UpdatedAt               string   `json:"updated_at"`
	StatusLogs              []StatusLog `json:"status_logs"`
	EvidenceChain           []Evidence  `json:"evidence_chain"`
}

type StatusLog struct {
	ID          int    `json:"id"`
	FromStatus  string `json:"from_status"`
	ToStatus    string `json:"to_status"`
	Operator    string `json:"operator"`
	Remark      string `json:"remark"`
	CreatedAt   string `json:"created_at"`
}

type Evidence struct {
	ID           int    `json:"id"`
	EvidenceType string `json:"evidence_type"`
	EvidenceValue string `json:"evidence_value"`
	FileURL      string `json:"file_url"`
	Operator     string `json:"operator"`
	CreatedAt    string `json:"created_at"`
}

type WarrantyReport struct {
	ID           string `json:"id"`
	ReplacementID string `json:"replacement_id"`
	ReportNumber string `json:"report_number"`
	Content      string `json:"content"`
	GeneratedAt  string `json:"generated_at"`
}

type VerificationRequest struct {
	Operator string `json:"operator"`
	Remark   string `json:"remark"`
}

type ReviewRequest struct {
	Operator string `json:"operator"`
	Remark   string `json:"remark"`
	Approved bool   `json:"approved"`
}

type AcceptanceRequest struct {
	Operator string `json:"operator"`
	Remark   string `json:"remark"`
	Approved bool   `json:"approved"`
}

type EvidenceUpdateRequest struct {
	EvidenceType  string `json:"evidence_type"`
	EvidenceValue string `json:"evidence_value"`
	FileURL       string `json:"file_url"`
	Operator      string `json:"operator"`
}

type TraceResult struct {
	Replacement   Replacement   `json:"replacement"`
	Inverter      Inverter      `json:"inverter"`
	NewInverter   *Inverter     `json:"new_inverter,omitempty"`
	FaultCode     FaultCode     `json:"fault_code"`
	SparePart     *SparePart    `json:"spare_part,omitempty"`
	FactoryOrder  *FactoryOrder `json:"factory_order,omitempty"`
	WarrantyReport *WarrantyReport `json:"warranty_report,omitempty"`
	VerificationNotes string     `json:"verification_notes"`
}

type SummaryReport struct {
	TotalReplacements       int            `json:"total_replacements"`
	InWarranty              int            `json:"in_warranty"`
	OutOfWarranty           int            `json:"out_of_warranty"`
	ByStatus                map[string]int `json:"by_status"`
	ByFaultCode             map[string]int `json:"by_fault_code"`
	DuplicateSerialNumbers  []string       `json:"duplicate_serial_numbers"`
	UnacceptedReplacements  []string       `json:"unaccepted_replacements"`
}

type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}
