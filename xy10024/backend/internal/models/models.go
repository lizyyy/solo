package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID           uuid.UUID `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	Username     string    `gorm:"uniqueIndex;size:50;not null" json:"username"`
	Email        string    `gorm:"uniqueIndex;size:100;not null" json:"email"`
	PasswordHash string    `gorm:"size:255;not null" json:"-"`
	FullName     string    `gorm:"size:100;not null" json:"full_name"`
	Department   string    `gorm:"size:100" json:"department"`
	Role         string    `gorm:"size:20;not null;default:'user'" json:"role"`
	IsActive     bool      `gorm:"default:true" json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	Version      int64     `gorm:"default:1" json:"version"`
}

type Device struct {
	ID          uuid.UUID  `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	DeviceCode  string     `gorm:"uniqueIndex;size:50;not null" json:"device_code"`
	Name        string     `gorm:"size:100;not null" json:"name"`
	Category    string     `gorm:"size:50;not null" json:"category"`
	Description string     `gorm:"type:text" json:"description"`
	Status      string     `gorm:"size:20;not null;default:'available'" json:"status"`
	Location    string     `gorm:"size:100" json:"location"`
	Condition   string     `gorm:"size:20;default:'good'" json:"condition"`
	CreatedBy   *uuid.UUID `gorm:"type:uuid" json:"created_by"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	Version     int64      `gorm:"default:1" json:"version"`
	LastEventID *uuid.UUID `gorm:"type:uuid" json:"last_event_id"`
}

type BorrowRecord struct {
	ID                uuid.UUID  `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	DeviceID          uuid.UUID  `gorm:"type:uuid;not null;index" json:"device_id"`
	BorrowerID        uuid.UUID  `gorm:"type:uuid;not null;index" json:"borrower_id"`
	Purpose           string     `gorm:"type:text;not null" json:"purpose"`
	ExpectedReturnDate *time.Time `json:"expected_return_date"`
	ActualReturnDate   *time.Time `json:"actual_return_date"`
	BorrowDate        time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"borrow_date"`
	Status            string     `gorm:"size:20;not null;default:'borrowed'" json:"status"`
	Notes             string     `gorm:"type:text" json:"notes"`
	CreatedBy         *uuid.UUID `gorm:"type:uuid" json:"created_by"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
	Version           int64      `gorm:"default:1" json:"version"`
}

type Event struct {
	ID            uuid.UUID                 `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	AggregateType string                    `gorm:"size:50;not null;index:idx_events_aggregate" json:"aggregate_type"`
	AggregateID   uuid.UUID                 `gorm:"type:uuid;not null;index:idx_events_aggregate" json:"aggregate_id"`
	EventType     string                    `gorm:"size:100;not null" json:"event_type"`
	EventVersion  int                       `gorm:"not null;default:1" json:"event_version"`
	Payload       map[string]interface{}    `gorm:"type:jsonb;not null" json:"payload"`
	Metadata      map[string]interface{}    `gorm:"type:jsonb;not null" json:"metadata"`
	CreatedAt     time.Time                 `json:"created_at"`
	CreatedBy     *uuid.UUID                `gorm:"type:uuid" json:"created_by"`
	RequestID     *uuid.UUID                `gorm:"type:uuid;index:idx_events_request" json:"request_id"`
	Sequence      int64                     `gorm:"autoIncrement" json:"sequence"`
}

type AuditLog struct {
	ID           uuid.UUID              `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	UserID       *uuid.UUID             `gorm:"type:uuid;index:idx_audit_logs_user" json:"user_id"`
	Action       string                 `gorm:"size:100;not null" json:"action"`
	ResourceType string                 `gorm:"size:50;index:idx_audit_logs_resource" json:"resource_type"`
	ResourceID   *uuid.UUID             `gorm:"type:uuid;index:idx_audit_logs_resource" json:"resource_id"`
	BeforeState  map[string]interface{} `gorm:"type:jsonb" json:"before_state"`
	AfterState   map[string]interface{} `gorm:"type:jsonb" json:"after_state"`
	IPAddress    string                 `gorm:"size:45" json:"ip_address"`
	UserAgent    string                 `gorm:"type:text" json:"user_agent"`
	RequestID    *uuid.UUID             `json:"request_id"`
	Timestamp    time.Time              `gorm:"not null;index:idx_audit_logs_timestamp;default:CURRENT_TIMESTAMP" json:"timestamp"`
}

type DedupRecord struct {
	IdempotencyKey string                 `gorm:"primary_key;size:100" json:"idempotency_key"`
	RequestID      uuid.UUID              `gorm:"type:uuid;not null" json:"request_id"`
	Response       map[string]interface{} `gorm:"type:jsonb" json:"response"`
	CreatedAt      time.Time              `json:"created_at"`
	ExpiresAt      time.Time              `json:"expires_at"`
}

type Snapshot struct {
	ID              uuid.UUID              `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	AggregateType   string                 `gorm:"size:50;not null;index:idx_snapshots_aggregate" json:"aggregate_type"`
	AggregateID     uuid.UUID              `gorm:"type:uuid;not null;index:idx_snapshots_aggregate" json:"aggregate_id"`
	SnapshotVersion int                    `gorm:"not null" json:"snapshot_version"`
	LastEventID     uuid.UUID              `gorm:"type:uuid;not null" json:"last_event_id"`
	State           map[string]interface{} `gorm:"type:jsonb;not null" json:"state"`
	CreatedAt       time.Time              `json:"created_at"`
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}

func (d *Device) BeforeCreate(tx *gorm.DB) error {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	return nil
}

func (b *BorrowRecord) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}

func (e *Event) BeforeCreate(tx *gorm.DB) error {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	return nil
}
