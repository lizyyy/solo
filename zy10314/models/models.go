package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CircuitState string

const (
	StateClosed   CircuitState = "CLOSED"
	StateOpen     CircuitState = "OPEN"
	StateHalfOpen CircuitState = "HALF_OPEN"
)

type CallResult string

const (
	ResultSuccess CallResult = "SUCCESS"
	ResultFailure CallResult = "FAILURE"
	ResultTimeout CallResult = "TIMEOUT"
)

type ExternalAPI struct {
	ID          string `gorm:"primaryKey"`
	Name        string `gorm:"index;not null"`
	Endpoint    string `gorm:"not null"`
	Method      string `gorm:"not null"`
	Description string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type BusinessCaller struct {
	ID          string `gorm:"primaryKey"`
	Name        string `gorm:"index;not null"`
	SystemCode  string `gorm:"uniqueIndex;not null"`
	Description string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type CircuitThreshold struct {
	ID                string `gorm:"primaryKey"`
	ExternalAPIID     string `gorm:"index;not null"`
	BusinessCallerID  string `gorm:"index;not null"`
	FailureThreshold  int    `gorm:"not null;default:5"`
	HalfOpenMaxCalls  int    `gorm:"not null;default:3"`
	SleepWindowSeconds int   `gorm:"not null;default:30"`
	MinimumRequests   int    `gorm:"not null;default:10"`
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type CircuitBreaker struct {
	ID                string       `gorm:"primaryKey"`
	ExternalAPIID     string       `gorm:"index;not null"`
	BusinessCallerID  string       `gorm:"index;not null"`
	State             CircuitState `gorm:"not null;default:CLOSED"`
	FailureCount      int          `gorm:"not null;default:0"`
	SuccessCount      int          `gorm:"not null;default:0"`
	TotalRequests     int          `gorm:"not null;default:0"`
	LastFailureTime   *time.Time
	LastStateChange   time.Time    `gorm:"not null"`
	HalfOpenCallCount int          `gorm:"not null;default:0"`
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type ProbeResult struct {
	ID               string     `gorm:"primaryKey"`
	CircuitBreakerID string     `gorm:"index;not null"`
	ProbeTime        time.Time  `gorm:"not null"`
	Result           CallResult `gorm:"not null"`
	DurationMs       int64
	ErrorMessage     string
	ResponseCode     int
	CreatedAt        time.Time
}

type HalfOpenRequest struct {
	ID               string     `gorm:"primaryKey"`
	CircuitBreakerID string     `gorm:"index;not null"`
	RequestID        string     `gorm:"uniqueIndex;not null"`
	RequestTime      time.Time  `gorm:"not null"`
	Result           *CallResult
	ResponseTime     *time.Time
	DurationMs       *int64
	ErrorMessage     string
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type RecoveryConclusion struct {
	ID               string       `gorm:"primaryKey"`
	CircuitBreakerID string       `gorm:"index;not null"`
	ConclusionType   string       `gorm:"not null"`
	PreviousState    CircuitState `gorm:"not null"`
	NewState         CircuitState `gorm:"not null"`
	Reason           string       `gorm:"not null"`
	Operator         string
	ConclusionTime   time.Time `gorm:"not null"`
	CreatedAt        time.Time
}

type ArbitrationLog struct {
	ID               string       `gorm:"primaryKey"`
	CircuitBreakerID string       `gorm:"index;not null"`
	RequestID        string       `gorm:"index;not null"`
	Action           string       `gorm:"not null"`
	PreviousState    CircuitState
	NewState         CircuitState
	Details          string
	Operator         string
	LogTime          time.Time `gorm:"not null"`
	CreatedAt        time.Time
}

type RequestDeduplication struct {
	ID             string `gorm:"primaryKey"`
	RequestID      string `gorm:"uniqueIndex;not null"`
	RequestHash    string `gorm:"index;not null"`
	ExternalAPIID  string `gorm:"index;not null"`
	BusinessCallerID string `gorm:"index;not null"`
	Processed      bool   `gorm:"not null;default:false"`
	ResponseData   string
	CreatedAt      time.Time `gorm:"index"`
}

func (e *ExternalAPI) BeforeCreate(tx *gorm.DB) error {
	if e.ID == "" {
		e.ID = uuid.NewString()
	}
	return nil
}

func (b *BusinessCaller) BeforeCreate(tx *gorm.DB) error {
	if b.ID == "" {
		b.ID = uuid.NewString()
	}
	return nil
}

func (c *CircuitThreshold) BeforeCreate(tx *gorm.DB) error {
	if c.ID == "" {
		c.ID = uuid.NewString()
	}
	return nil
}

func (c *CircuitBreaker) BeforeCreate(tx *gorm.DB) error {
	if c.ID == "" {
		c.ID = uuid.NewString()
	}
	return nil
}

func (p *ProbeResult) BeforeCreate(tx *gorm.DB) error {
	if p.ID == "" {
		p.ID = uuid.NewString()
	}
	return nil
}

func (h *HalfOpenRequest) BeforeCreate(tx *gorm.DB) error {
	if h.ID == "" {
		h.ID = uuid.NewString()
	}
	return nil
}

func (r *RecoveryConclusion) BeforeCreate(tx *gorm.DB) error {
	if r.ID == "" {
		r.ID = uuid.NewString()
	}
	return nil
}

func (a *ArbitrationLog) BeforeCreate(tx *gorm.DB) error {
	if a.ID == "" {
		a.ID = uuid.NewString()
	}
	return nil
}

func (r *RequestDeduplication) BeforeCreate(tx *gorm.DB) error {
	if r.ID == "" {
		r.ID = uuid.NewString()
	}
	return nil
}
