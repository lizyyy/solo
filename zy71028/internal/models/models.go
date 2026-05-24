package models

import (
	"time"

	"github.com/google/uuid"
)

type RouteStatus string

const (
	RouteStatusPending   RouteStatus = "pending"
	RouteStatusAssigned  RouteStatus = "assigned"
	RouteStatusDelivering RouteStatus = "delivering"
	RouteStatusCompleted RouteStatus = "completed"
	RouteStatusException RouteStatus = "exception"
	RouteStatusSuspended RouteStatus = "suspended"
)

type VisitResult string

const (
	VisitResultNormal    VisitResult = "normal"
	VisitResultNoAnswer  VisitResult = "no_answer"
	VisitResultAbnormal  VisitResult = "abnormal"
	VisitResultSuspended VisitResult = "suspended"
)

type SuspensionStatus string

const (
	SuspensionPending  SuspensionStatus = "pending"
	SuspensionApproved SuspensionStatus = "approved"
	SuspensionRejected SuspensionStatus = "rejected"
	SuspensionExpired  SuspensionStatus = "expired"
)

type Elderly struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Phone       string    `json:"phone" db:"phone"`
	Address     string    `json:"address" db:"address"`
	HealthNote  string    `json:"health_note,omitempty" db:"health_note"`
	ContactName string    `json:"contact_name" db:"contact_name"`
	ContactPhone string   `json:"contact_phone" db:"contact_phone"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type Volunteer struct {
	ID        string    `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	Phone     string    `json:"phone" db:"phone"`
	Area      string    `json:"area" db:"area"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type MealSuspension struct {
	ID          string           `json:"id" db:"id"`
	ElderlyID   string           `json:"elderly_id" db:"elderly_id"`
	StartDate   string           `json:"start_date" db:"start_date"`
	EndDate     string           `json:"end_date" db:"end_date"`
	Reason      string           `json:"reason" db:"reason"`
	Status      SuspensionStatus `json:"status" db:"status"`
	RequestedBy string           `json:"requested_by" db:"requested_by"`
	ReviewedBy  string           `json:"reviewed_by,omitempty" db:"reviewed_by"`
	ReviewedAt  *time.Time       `json:"reviewed_at,omitempty" db:"reviewed_at"`
	CreatedAt   time.Time        `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at" db:"updated_at"`
}

type DeliveryRoute struct {
	ID          string      `json:"id" db:"id"`
	RequestID   string      `json:"request_id" db:"request_id"`
	ElderlyID   string      `json:"elderly_id" db:"elderly_id"`
	VolunteerID string      `json:"volunteer_id,omitempty" db:"volunteer_id"`
	Date        string      `json:"date" db:"date"`
	Status      RouteStatus `json:"status" db:"status"`
	Notes       string      `json:"notes,omitempty" db:"notes"`
	CreatedAt   time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at" db:"updated_at"`
}

type SafetyVisit struct {
	ID          string      `json:"id" db:"id"`
	RouteID     string      `json:"route_id" db:"route_id"`
	Result      VisitResult `json:"result" db:"result"`
	EvidenceURL string      `json:"evidence_url,omitempty" db:"evidence_url"`
	Notes       string      `json:"notes,omitempty" db:"notes"`
	NeedsFollowUp bool      `json:"needs_follow_up" db:"needs_follow_up"`
	FollowUpStatus string    `json:"follow_up_status,omitempty" db:"follow_up_status"`
	FollowedBy  string      `json:"followed_by,omitempty" db:"followed_by"`
	FollowedAt  *time.Time  `json:"followed_at,omitempty" db:"followed_at"`
	CreatedAt   time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at" db:"updated_at"`
}

type ServiceReport struct {
	ID              string    `json:"id" db:"id"`
	Date            string    `json:"date" db:"date"`
	TotalDeliveries int       `json:"total_deliveries" db:"total_deliveries"`
	CompletedCount  int       `json:"completed_count" db:"completed_count"`
	ExceptionCount  int       `json:"exception_count" db:"exception_count"`
	SuspendedCount  int       `json:"suspended_count" db:"suspended_count"`
	NormalVisits    int       `json:"normal_visits" db:"normal_visits"`
	NoAnswerVisits  int       `json:"no_answer_visits" db:"no_answer_visits"`
	AbnormalVisits  int       `json:"abnormal_visits" db:"abnormal_visits"`
	PendingFollowUps int      `json:"pending_follow_ups" db:"pending_follow_ups"`
	GeneratedAt     time.Time `json:"generated_at" db:"generated_at"`
}

func NewElderly() *Elderly {
	return &Elderly{
		ID:        uuid.New().String(),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

func NewVolunteer() *Volunteer {
	return &Volunteer{
		ID:        uuid.New().String(),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

func NewMealSuspension() *MealSuspension {
	return &MealSuspension{
		ID:        uuid.New().String(),
		Status:    SuspensionPending,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

func NewDeliveryRoute(requestID string) *DeliveryRoute {
	return &DeliveryRoute{
		ID:        uuid.New().String(),
		RequestID: requestID,
		Status:    RouteStatusPending,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

func NewSafetyVisit() *SafetyVisit {
	return &SafetyVisit{
		ID:        uuid.New().String(),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

func NewServiceReport() *ServiceReport {
	return &ServiceReport{
		ID:          uuid.New().String(),
		GeneratedAt: time.Now(),
	}
}
