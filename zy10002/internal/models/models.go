package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type OrderStatus string

const (
	OrderStatusPending    OrderStatus = "PENDING"
	OrderStatusProcessing OrderStatus = "PROCESSING"
	OrderStatusSuccess    OrderStatus = "SUCCESS"
	OrderStatusFailed     OrderStatus = "FAILED"
	OrderStatusRefunded   OrderStatus = "REFUNDED"
)

type Order struct {
	ID              string         `gorm:"primaryKey" json:"id"`
	Amount          float64        `json:"amount"`
	Status          OrderStatus    `json:"status"`
	PaymentMethod   string         `json:"payment_method"`
	CallbackCount   int            `json:"callback_count"`
	LastCallbackAt  *time.Time     `json:"last_callback_at"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (o *Order) BeforeCreate(tx *gorm.DB) error {
	if o.ID == "" {
		o.ID = uuid.New().String()
	}
	return nil
}

type PaymentCallback struct {
	ID             string         `gorm:"primaryKey" json:"id"`
	OrderID        string         `gorm:"index" json:"order_id"`
	TransactionID  string         `json:"transaction_id"`
	Amount         float64        `json:"amount"`
	Status         string         `json:"status"`
	RawData        string         `json:"raw_data"`
	IsDuplicate    bool           `json:"is_duplicate"`
	ProcessedAt    time.Time      `json:"processed_at"`
	CreatedAt      time.Time      `json:"created_at"`
}

func (p *PaymentCallback) BeforeCreate(tx *gorm.DB) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	return nil
}

type Event struct {
	ID           string    `gorm:"primaryKey" json:"id"`
	EventType    string    `gorm:"index" json:"event_type"`
	EntityID     string    `gorm:"index" json:"entity_id"`
	EntityType   string    `json:"entity_type"`
	OldValue     string    `json:"old_value"`
	NewValue     string    `json:"new_value"`
	Source       string    `json:"source"`
	Timestamp    time.Time `gorm:"index" json:"timestamp"`
	IsReplay     bool      `gorm:"default:false" json:"is_replay"`
}

func (e *Event) BeforeCreate(tx *gorm.DB) error {
	if e.ID == "" {
		e.ID = uuid.New().String()
	}
	return nil
}

type StateSnapshot struct {
	ID           string    `gorm:"primaryKey" json:"id"`
	EntityType   string    `gorm:"index" json:"entity_type"`
	EntityID     string    `gorm:"index" json:"entity_id"`
	State        string    `json:"state"`
	Timestamp    time.Time `gorm:"index" json:"timestamp"`
}

func (s *StateSnapshot) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	return nil
}

type ChaosMetric struct {
	ID            string    `gorm:"primaryKey" json:"id"`
	MetricType    string    `gorm:"index" json:"metric_type"`
	Value         float64   `json:"value"`
	Description   string    `json:"description"`
	Timestamp     time.Time `gorm:"index" json:"timestamp"`
}

func (m *ChaosMetric) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}
