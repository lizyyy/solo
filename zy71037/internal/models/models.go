package models

import "time"

type Stall struct {
	ID            string    `json:"id"`
	Code          string    `json:"code"`
	Name          string    `json:"name"`
	PowerCapacity int       `json:"power_capacity"`
	HasExhaust    bool      `json:"has_exhaust"`
	Zone          string    `json:"zone"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Vendor struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Phone          string    `json:"phone,omitempty"`
	Category       string    `json:"category"`
	PowerUsage     int       `json:"power_usage"`
	RequiresExhaust bool     `json:"requires_exhaust"`
	Score          int       `json:"score"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type Complaint struct {
	ID             string     `json:"id"`
	VendorID       string     `json:"vendor_id"`
	Type           string     `json:"type"`
	Description    string     `json:"description,omitempty"`
	Severity       string     `json:"severity"`
	PointsDeducted int        `json:"points_deducted"`
	Status         string     `json:"status"`
	ReportedBy     string     `json:"reported_by,omitempty"`
	ReportedAt     time.Time  `json:"reported_at"`
	ResolvedAt     *time.Time `json:"resolved_at,omitempty"`
}

type RotationCycle struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	StartDate string    `json:"start_date"`
	EndDate   string    `json:"end_date"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	CreatedBy string    `json:"created_by,omitempty"`
}

type StallAssignment struct {
	ID               string     `json:"id"`
	CycleID          string     `json:"cycle_id"`
	VendorID         string     `json:"vendor_id"`
	StallID          string     `json:"stall_id"`
	Status           string     `json:"status"`
	AssignedAt       time.Time  `json:"assigned_at"`
	ValidatedAt      *time.Time `json:"validated_at,omitempty"`
	ValidationResult string     `json:"validation_result,omitempty"`
	Notes            string     `json:"notes,omitempty"`
}

type SwapRequest struct {
	ID                string     `json:"id"`
	CycleID           string     `json:"cycle_id"`
	RequestingVendorID string    `json:"requesting_vendor_id"`
	TargetVendorID    string     `json:"target_vendor_id"`
	RequestingStallID string     `json:"requesting_stall_id"`
	TargetStallID     string     `json:"target_stall_id"`
	Status            string     `json:"status"`
	Reason            string     `json:"reason,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	ApprovedAt        *time.Time `json:"approved_at,omitempty"`
	ApprovedBy        string     `json:"approved_by,omitempty"`
	ResolvedAt        *time.Time `json:"resolved_at,omitempty"`
}

type AuditLog struct {
	ID         string    `json:"id"`
	EntityType string    `json:"entity_type"`
	EntityID   string    `json:"entity_id"`
	Action     string    `json:"action"`
	OldValue   string    `json:"old_value,omitempty"`
	NewValue   string    `json:"new_value,omitempty"`
	Operator   string    `json:"operator,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Code    string `json:"code"`
}

type ValidationResult struct {
	Valid   bool              `json:"valid"`
	Errors  []ValidationError `json:"errors,omitempty"`
	Warnings []ValidationError `json:"warnings,omitempty"`
}

type RotationReport struct {
	CycleID       string                     `json:"cycle_id"`
	CycleName     string                     `json:"cycle_name"`
	TotalVendors  int                        `json:"total_vendors"`
	TotalStalls   int                        `json:"total_stalls"`
	Assignments   []StallAssignmentDetail    `json:"assignments"`
	Complaints    []ComplaintSummary         `json:"complaints"`
	SwapRequests  []SwapRequestSummary       `json:"swap_requests"`
	Validation    ValidationResult           `json:"validation"`
	GeneratedAt   time.Time                  `json:"generated_at"`
}

type StallAssignmentDetail struct {
	StallAssignment
	VendorName    string `json:"vendor_name"`
	VendorCategory string `json:"vendor_category"`
	StallCode     string `json:"stall_code"`
	StallName     string `json:"stall_name"`
	StallZone     string `json:"stall_zone"`
}

type ComplaintSummary struct {
	Complaint
	VendorName string `json:"vendor_name"`
}

type SwapRequestSummary struct {
	SwapRequest
	RequestingVendorName string `json:"requesting_vendor_name"`
	TargetVendorName     string `json:"target_vendor_name"`
	RequestingStallCode  string `json:"requesting_stall_code"`
	TargetStallCode      string `json:"target_stall_code"`
}

type ApiResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Errors  interface{} `json:"errors,omitempty"`
}
