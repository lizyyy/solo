package models

import (
	"time"
)

type Base struct {
	ID        string    `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	Code      string    `json:"code" db:"code"`
	City      string    `json:"city" db:"city"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CrewMember struct {
	ID         string    `json:"id" db:"id"`
	Name       string    `json:"name" db:"name"`
	EmployeeNo string    `json:"employee_no" db:"employee_no"`
	BaseID     string    `json:"base_id" db:"base_id"`
	BaseName   string    `json:"base_name,omitempty" db:"base_name"`
	Position   string    `json:"position" db:"position"`
	Phone      string    `json:"phone" db:"phone"`
	Email      string    `json:"email" db:"email"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

type FlightSegment struct {
	ID               string    `json:"id" db:"id"`
	FlightNo         string    `json:"flight_no" db:"flight_no"`
	DepartureCity    string    `json:"departure_city" db:"departure_city"`
	ArrivalCity      string    `json:"arrival_city" db:"arrival_city"`
	DepartureTime    time.Time `json:"departure_time" db:"departure_time"`
	ArrivalTime      time.Time `json:"arrival_time" db:"arrival_time"`
	ActualDeparture  time.Time `json:"actual_departure" db:"actual_departure"`
	ActualArrival    time.Time `json:"actual_arrival" db:"actual_arrival"`
	DelayMinutes     int       `json:"delay_minutes" db:"delay_minutes"`
	FlightDate       string    `json:"flight_date" db:"flight_date"`
	CrewID           string    `json:"crew_id" db:"crew_id"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time `json:"updated_at" db:"updated_at"`
}

type Application struct {
	ID                    string    `json:"id" db:"id"`
	CrewID                string    `json:"crew_id" db:"crew_id"`
	CrewName              string    `json:"crew_name,omitempty" db:"crew_name"`
	FlightSegmentID       string    `json:"flight_segment_id" db:"flight_segment_id"`
	FlightNo              string    `json:"flight_no" db:"flight_no"`
	FlightDate            string    `json:"flight_date" db:"flight_date"`
	DepartureTime         time.Time `json:"departure_time" db:"departure_time"`
	ArrivalTime           time.Time `json:"arrival_time" db:"arrival_time"`
	DelayMinutes          int       `json:"delay_minutes" db:"delay_minutes"`
	CompensationType      string    `json:"compensation_type" db:"compensation_type"`
	CompensationHours     float64   `json:"compensation_hours" db:"compensation_hours"`
	Status                string    `json:"status" db:"status"`
	IdempotencyKey        string    `json:"idempotency_key" db:"idempotency_key"`
	IsCrossBase           bool      `json:"is_cross_base" db:"is_cross_base"`
	RestHoursAfterLanding float64   `json:"rest_hours_after_landing" db:"rest_hours_after_landing"`
	RestCheckPassed       bool      `json:"rest_check_passed" db:"rest_check_passed"`
	MatchScore            float64   `json:"match_score" db:"match_score"`
	LeaderApprovedBy      string    `json:"leader_approved_by,omitempty" db:"leader_approved_by"`
	LeaderApprovedAt      time.Time `json:"leader_approved_at,omitempty" db:"leader_approved_at"`
	SupervisorApprovedBy  string    `json:"supervisor_approved_by,omitempty" db:"supervisor_approved_by"`
	SupervisorApprovedAt  time.Time `json:"supervisor_approved_at,omitempty" db:"supervisor_approved_at"`
	RejectedBy            string    `json:"rejected_by,omitempty" db:"rejected_by"`
	RejectedAt            time.Time `json:"rejected_at,omitempty" db:"rejected_at"`
	RejectReason          string    `json:"reject_reason,omitempty" db:"reject_reason"`
	Remarks               string    `json:"remarks,omitempty" db:"remarks"`
	CreatedAt             time.Time `json:"created_at" db:"created_at"`
	UpdatedAt             time.Time `json:"updated_at" db:"updated_at"`
}

type CompensationSummary struct {
	ID               string    `json:"id" db:"id"`
	CrewID           string    `json:"crew_id" db:"crew_id"`
	CrewName         string    `json:"crew_name,omitempty" db:"crew_name"`
	PeriodStart      time.Time `json:"period_start" db:"period_start"`
	PeriodEnd        time.Time `json:"period_end" db:"period_end"`
	TotalHours       float64   `json:"total_hours" db:"total_hours"`
	ApprovedHours    float64   `json:"approved_hours" db:"approved_hours"`
	PendingHours     float64   `json:"pending_hours" db:"pending_hours"`
	RejectedHours    float64   `json:"rejected_hours" db:"rejected_hours"`
	ApplicationCount int       `json:"application_count" db:"application_count"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time `json:"updated_at" db:"updated_at"`
}

type ProcessingLog struct {
	ID            string    `json:"id" db:"id"`
	ApplicationID string    `json:"application_id" db:"application_id"`
	Action        string    `json:"action" db:"action"`
	OldStatus     string    `json:"old_status,omitempty" db:"old_status"`
	NewStatus     string    `json:"new_status,omitempty" db:"new_status"`
	OperatorID    string    `json:"operator_id,omitempty" db:"operator_id"`
	OperatorName  string    `json:"operator_name,omitempty" db:"operator_name"`
	Details       string    `json:"details,omitempty" db:"details"`
	IPAddress     string    `json:"ip_address,omitempty" db:"ip_address"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

type CreateApplicationRequest struct {
	CrewID            string    `json:"crew_id" binding:"required"`
	FlightNo          string    `json:"flight_no" binding:"required"`
	FlightDate        string    `json:"flight_date" binding:"required"`
	DepartureCity     string    `json:"departure_city"`
	DepartureTime     time.Time `json:"departure_time" binding:"required"`
	ArrivalTime       time.Time `json:"arrival_time" binding:"required"`
	DelayMinutes      int       `json:"delay_minutes"`
	CompensationType  string    `json:"compensation_type" binding:"required"`
	CompensationHours float64   `json:"compensation_hours" binding:"required,gt=0"`
	Remarks           string    `json:"remarks"`
}

type ApprovalRequest struct {
	ApproverID   string `json:"approver_id" binding:"required"`
	ApproverName string `json:"approver_name" binding:"required"`
	RejectReason string `json:"reject_reason"`
}
