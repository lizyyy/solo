package domain

import (
	"time"
)

type Product struct {
	ID          int64     `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Price       float64   `json:"price"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Inventory struct {
	ID            int64     `json:"id" gorm:"primaryKey"`
	ProductID     int64     `json:"product_id" gorm:"uniqueIndex"`
	AvailableQty  int       `json:"available_qty"`
	ReservedQty   int       `json:"reserved_qty"`
	Version       int64     `json:"version" gorm:"version"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type OrderStatus string

const (
	OrderStatusPending   OrderStatus = "pending"
	OrderStatusCreated   OrderStatus = "created"
	OrderStatusPaid      OrderStatus = "paid"
	OrderStatusShipped   OrderStatus = "shipped"
	OrderStatusCompleted OrderStatus = "completed"
	OrderStatusFailed    OrderStatus = "failed"
	OrderStatusCancelled OrderStatus = "cancelled"
	OrderStatusCompensating OrderStatus = "compensating"
)

type Order struct {
	ID             int64       `json:"id" gorm:"primaryKey"`
	OrderNo        string      `json:"order_no" gorm:"uniqueIndex"`
	UserID         int64       `json:"user_id"`
	ProductID      int64       `json:"product_id"`
	Quantity       int         `json:"quantity"`
	Amount         float64     `json:"amount"`
	Status         OrderStatus `json:"status"`
	PaymentID      int64       `json:"payment_id,omitempty"`
	CompensationID string      `json:"compensation_id,omitempty"`
	RetryCount     int         `json:"retry_count"`
	LastError      string      `json:"last_error,omitempty"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
}

type PaymentStatus string

const (
	PaymentStatusPending   PaymentStatus = "pending"
	PaymentStatusSuccess   PaymentStatus = "success"
	PaymentStatusFailed    PaymentStatus = "failed"
	PaymentStatusRefunded  PaymentStatus = "refunded"
)

type Payment struct {
	ID           int64         `json:"id" gorm:"primaryKey"`
	OrderID      int64         `json:"order_id" gorm:"uniqueIndex"`
	UserID       int64         `json:"user_id"`
	Amount       float64       `json:"amount"`
	Status       PaymentStatus `json:"status"`
	TransactionNo string       `json:"transaction_no,omitempty"`
	LastError    string        `json:"last_error,omitempty"`
	CreatedAt    time.Time     `json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
}

type CompensationStatus string

const (
	CompensationStatusPending   CompensationStatus = "pending"
	CompensationStatusRunning   CompensationStatus = "running"
	CompensationStatusSuccess   CompensationStatus = "success"
	CompensationStatusFailed    CompensationStatus = "failed"
	CompensationStatusRetrying  CompensationStatus = "retrying"
)

type CompensationTask struct {
	ID             string              `json:"id" gorm:"primaryKey"`
	OrderID        int64               `json:"order_id"`
	Status         CompensationStatus  `json:"status"`
	Steps          []CompensationStep  `json:"steps" gorm:"type:json"`
	CurrentStep    int                 `json:"current_step"`
	RetryCount     int                 `json:"retry_count"`
	MaxRetries     int                 `json:"max_retries"`
	LastError      string              `json:"last_error,omitempty"`
	NextRetryAt    *time.Time          `json:"next_retry_at,omitempty"`
	CreatedAt      time.Time           `json:"created_at"`
	UpdatedAt      time.Time           `json:"updated_at"`
}

type CompensationStep struct {
	Name         string              `json:"name"`
	Status       CompensationStatus  `json:"status"`
	Attempts     int                 `json:"attempts"`
	LastError    string              `json:"last_error,omitempty"`
	ExecutedAt   *time.Time          `json:"executed_at,omitempty"`
}

type TransactionContext struct {
	TraceID         string
	CorrelationID   string
	OrderID         int64
	OrderNo         string
	ProductID       int64
	Quantity        int
	UserID          int64
	Amount          float64
	Events          []string
	StartTime       time.Time
}

type CreateOrderRequest struct {
	UserID    int64 `json:"user_id" binding:"required"`
	ProductID int64 `json:"product_id" binding:"required"`
	Quantity  int   `json:"quantity" binding:"required,min=1"`
}

type CreateOrderResponse struct {
	Success bool        `json:"success"`
	Order   *Order      `json:"order,omitempty"`
	TraceID string      `json:"trace_id"`
	Error   string      `json:"error,omitempty"`
}
