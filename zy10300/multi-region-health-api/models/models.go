package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type HealthStatus string

const (
	HealthStatusHealthy   HealthStatus = "healthy"
	HealthStatusDegraded  HealthStatus = "degraded"
	HealthStatusUnhealthy HealthStatus = "unhealthy"
	HealthStatusUnknown   HealthStatus = "unknown"
)

type DegradeStatus string

const (
	DegradeStatusNormal     DegradeStatus = "normal"
	DegradeStatusWarning    DegradeStatus = "warning"
	DegradeStatusDegrading  DegradeStatus = "degrading"
	DegradeStatusDegraded   DegradeStatus = "degraded"
	DegradeStatusRecovering DegradeStatus = "recovering"
)

type Region struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"uniqueIndex;not null" json:"name"`
	Code        string    `gorm:"uniqueIndex;not null" json:"code"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (r *Region) BeforeCreate(tx *gorm.DB) error {
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	return nil
}

type Service struct {
	ID          string       `gorm:"primaryKey" json:"id"`
	RegionID    string       `gorm:"index;not null" json:"region_id"`
	Name        string       `gorm:"not null" json:"name"`
	Code        string       `gorm:"not null" json:"code"`
	Description string       `json:"description"`
	HealthStatus HealthStatus `gorm:"default:unknown" json:"health_status"`
	DegradeStatus DegradeStatus `gorm:"default:normal" json:"degrade_status"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`

	Region Region `gorm:"foreignKey:RegionID" json:"-"`
}

func (s *Service) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	return nil
}

type ProbeResult struct {
	ID          string       `gorm:"primaryKey" json:"id"`
	ServiceID   string       `gorm:"index;not null" json:"service_id"`
	RequestID   string       `gorm:"uniqueIndex;not null" json:"request_id"`
	ProbeType   string       `json:"probe_type"`
	RawStatus   string       `json:"raw_status"`
	NormalizedStatus HealthStatus `json:"normalized_status"`
	Metrics     string       `json:"metrics"`
	ErrorMsg    string       `json:"error_msg"`
	Timestamp   time.Time    `gorm:"index" json:"timestamp"`
	CreatedAt   time.Time    `json:"created_at"`

	Service Service `gorm:"foreignKey:ServiceID" json:"-"`
}

func (p *ProbeResult) BeforeCreate(tx *gorm.DB) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	return nil
}

type Dependency struct {
	ID           string `gorm:"primaryKey" json:"id"`
	ServiceID    string `gorm:"index;not null" json:"service_id"`
	DependentServiceID string `gorm:"index;not null" json:"dependent_service_id"`
	DependencyType string `json:"dependency_type"`
	IsCritical   bool   `json:"is_critical"`
	CreatedAt    time.Time `json:"created_at"`

	Service         Service `gorm:"foreignKey:ServiceID" json:"-"`
	DependentService Service `gorm:"foreignKey:DependentServiceID" json:"-"`
}

func (d *Dependency) BeforeCreate(tx *gorm.DB) error {
	if d.ID == "" {
		d.ID = uuid.New().String()
	}
	return nil
}

type DegradeAction struct {
	ID          string       `gorm:"primaryKey" json:"id"`
	ServiceID   string       `gorm:"index;not null" json:"service_id"`
	RequestID   string       `gorm:"uniqueIndex;not null" json:"request_id"`
	ActionType  string       `json:"action_type"`
	Description string       `json:"description"`
	PreviousStatus DegradeStatus `json:"previous_status"`
	NewStatus    DegradeStatus `json:"new_status"`
	Reason       string       `json:"reason"`
	TriggeredBy  string       `json:"triggered_by"`
	Timestamp    time.Time    `json:"timestamp"`
	CreatedAt    time.Time    `json:"created_at"`

	Service Service `gorm:"foreignKey:ServiceID" json:"-"`
}

func (d *DegradeAction) BeforeCreate(tx *gorm.DB) error {
	if d.ID == "" {
		d.ID = uuid.New().String()
	}
	return nil
}

type RecoveryRecord struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	ServiceID   string    `gorm:"index;not null" json:"service_id"`
	RequestID   string    `gorm:"uniqueIndex;not null" json:"request_id"`
	DegradeActionID string `json:"degrade_action_id"`
	ConfirmedBy string    `json:"confirmed_by"`
	ConfirmType string    `json:"confirm_type"`
	Description string    `json:"description"`
	IsSuccess   bool      `json:"is_success"`
	Timestamp   time.Time `json:"timestamp"`
	CreatedAt   time.Time `json:"created_at"`

	Service Service `gorm:"foreignKey:ServiceID" json:"-"`
	DegradeAction DegradeAction `gorm:"foreignKey:DegradeActionID" json:"-"`
}

func (r *RecoveryRecord) BeforeCreate(tx *gorm.DB) error {
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	return nil
}

type HealthSummary struct {
	RegionID       string       `json:"region_id"`
	RegionName     string       `json:"region_name"`
	TotalServices  int          `json:"total_services"`
	HealthyCount   int          `json:"healthy_count"`
	DegradedCount  int          `json:"degraded_count"`
	UnhealthyCount int          `json:"unhealthy_count"`
	UnknownCount   int          `json:"unknown_count"`
	OverallStatus  HealthStatus `json:"overall_status"`
	LastUpdated    time.Time    `json:"last_updated"`
}
