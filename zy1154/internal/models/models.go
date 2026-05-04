package models

import (
	"time"
)

type OrderStatus string
type InventoryStatus string
type BalanceStatus string
type CouponStatus string
type SagaStatus string
type SagaStepStatus string
type OutboxStatus string
type CompensationStatus string
type ManualHandlingStatus string

const (
	OrderStatusPending     OrderStatus = "pending"
	OrderStatusCreated     OrderStatus = "created"
	OrderStatusPaid        OrderStatus = "paid"
	OrderStatusFailed      OrderStatus = "failed"
	OrderStatusCancelled   OrderStatus = "cancelled"
	OrderStatusCompensated OrderStatus = "compensated"

	InventoryStatusAvailable InventoryStatus = "available"
	InventoryStatusLocked    InventoryStatus = "locked"
	InventoryStatusDeducted  InventoryStatus = "deducted"
	InventoryStatusReleased  InventoryStatus = "released"

	BalanceStatusAvailable BalanceStatus = "available"
	BalanceStatusFrozen    BalanceStatus = "frozen"
	BalanceStatusDeducted  BalanceStatus = "deducted"
	BalanceStatusReleased  BalanceStatus = "released"

	CouponStatusAvailable CouponStatus = "available"
	CouponStatusLocked    CouponStatus = "locked"
	CouponStatusUsed      CouponStatus = "used"
	CouponStatusReleased  CouponStatus = "released"

	SagaStatusPending    SagaStatus = "pending"
	SagaStatusRunning    SagaStatus = "running"
	SagaStatusCompleted  SagaStatus = "completed"
	SagaStatusFailed     SagaStatus = "failed"
	SagaStatusCompensating SagaStatus = "compensating"
	SagaStatusCompensated SagaStatus = "compensated"
	SagaStatusManualHandling SagaStatus = "manual_handling"

	SagaStepStatusPending   SagaStepStatus = "pending"
	SagaStepStatusRunning   SagaStepStatus = "running"
	SagaStepStatusCompleted SagaStepStatus = "completed"
	SagaStepStatusFailed    SagaStepStatus = "failed"
	SagaStepStatusCompensated SagaStepStatus = "compensated"

	OutboxStatusPending   OutboxStatus = "pending"
	OutboxStatusPublished OutboxStatus = "published"
	OutboxStatusFailed    OutboxStatus = "failed"

	CompensationStatusPending   CompensationStatus = "pending"
	CompensationStatusRunning   CompensationStatus = "running"
	CompensationStatusCompleted CompensationStatus = "completed"
	CompensationStatusFailed    CompensationStatus = "failed"

	ManualHandlingStatusPending   ManualHandlingStatus = "pending"
	ManualHandlingStatusProcessing ManualHandlingStatus = "processing"
	ManualHandlingStatusResolved  ManualHandlingStatus = "resolved"
	ManualHandlingStatusEscalated ManualHandlingStatus = "escalated"
)

type Order struct {
	ID          string      `gorm:"primaryKey" json:"id"`
	UserID      string      `json:"user_id"`
	ProductID   string      `json:"product_id"`
	Quantity    int         `json:"quantity"`
	TotalAmount float64     `json:"total_amount"`
	Discount    float64     `json:"discount"`
	PayAmount   float64     `json:"pay_amount"`
	CouponID    string      `json:"coupon_id,omitempty"`
	Status      OrderStatus `json:"status"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

type Inventory struct {
	ID        string          `gorm:"primaryKey" json:"id"`
	ProductID string          `json:"product_id"`
	Quantity  int             `json:"quantity"`
	Locked    int             `json:"locked"`
	Status    InventoryStatus `json:"status"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

type InventoryLog struct {
	ID          string          `gorm:"primaryKey" json:"id"`
	ProductID   string          `json:"product_id"`
	OrderID     string          `json:"order_id"`
	Quantity    int             `json:"quantity"`
	BeforeQty   int             `json:"before_qty"`
	AfterQty    int             `json:"after_qty"`
	BeforeLocked int            `json:"before_locked"`
	AfterLocked  int            `json:"after_locked"`
	Operation   string          `json:"operation"`
	Status      InventoryStatus `json:"status"`
	CreatedAt   time.Time       `json:"created_at"`
}

type Balance struct {
	ID        string        `gorm:"primaryKey" json:"id"`
	UserID    string        `json:"user_id"`
	Amount    float64       `json:"amount"`
	Frozen    float64       `json:"frozen"`
	Status    BalanceStatus `json:"status"`
	CreatedAt time.Time     `json:"created_at"`
	UpdatedAt time.Time     `json:"updated_at"`
}

type BalanceLog struct {
	ID          string        `gorm:"primaryKey" json:"id"`
	UserID      string        `json:"user_id"`
	OrderID     string        `json:"order_id"`
	Amount      float64       `json:"amount"`
	BeforeAmount float64      `json:"before_amount"`
	AfterAmount  float64      `json:"after_amount"`
	BeforeFrozen float64      `json:"before_frozen"`
	AfterFrozen  float64      `json:"after_frozen"`
	Operation   string        `json:"operation"`
	Status      BalanceStatus `json:"status"`
	CreatedAt   time.Time     `json:"created_at"`
}

type Coupon struct {
	ID          string        `gorm:"primaryKey" json:"id"`
	Code        string        `json:"code"`
	UserID      string        `json:"user_id,omitempty"`
	Discount    float64       `json:"discount"`
	MinAmount   float64       `json:"min_amount"`
	Status      CouponStatus  `json:"status"`
	OrderID     string        `json:"order_id,omitempty"`
	ValidFrom   time.Time     `json:"valid_from"`
	ValidTo     time.Time     `json:"valid_to"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
}

type SagaInstance struct {
	ID             string      `gorm:"primaryKey" json:"id"`
	OrderID        string      `json:"order_id"`
	Status         SagaStatus  `json:"status"`
	CurrentStep    int         `json:"current_step"`
	TotalSteps     int         `json:"total_steps"`
	RetryCount     int         `json:"retry_count"`
	MaxRetries     int         `json:"max_retries"`
	ErrorMessage   string      `json:"error_message,omitempty"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
}

type SagaStep struct {
	ID             string          `gorm:"primaryKey" json:"id"`
	SagaID         string          `json:"saga_id"`
	StepIndex      int             `json:"step_index"`
	StepName       string          `json:"step_name"`
	ServiceName    string          `json:"service_name"`
	Action         string          `json:"action"`
	Compensation   string          `json:"compensation"`
	Status         SagaStepStatus  `json:"status"`
	RetryCount     int             `json:"retry_count"`
	MaxRetries     int             `json:"max_retries"`
	ExecutionLog   string          `json:"execution_log,omitempty"`
	ErrorMessage   string          `json:"error_message,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

type OutboxEvent struct {
	ID            string       `gorm:"primaryKey" json:"id"`
	AggregateID   string       `json:"aggregate_id"`
	AggregateType string       `json:"aggregate_type"`
	EventType     string       `json:"event_type"`
	Payload       string       `json:"payload"`
	Status        OutboxStatus `json:"status"`
	PublishedAt   *time.Time   `json:"published_at,omitempty"`
	CreatedAt     time.Time    `json:"created_at"`
	UpdatedAt     time.Time    `json:"updated_at"`
}

type CompensationTask struct {
	ID             string              `gorm:"primaryKey" json:"id"`
	SagaID         string              `json:"saga_id"`
	StepID         string              `json:"step_id"`
	StepName       string              `json:"step_name"`
	ServiceName    string              `json:"service_name"`
	Compensation   string              `json:"compensation"`
	Payload        string              `json:"payload"`
	Status         CompensationStatus  `json:"status"`
	RetryCount     int                 `json:"retry_count"`
	MaxRetries     int                 `json:"max_retries"`
	ErrorMessage   string              `json:"error_message,omitempty"`
	LastRetryAt    *time.Time          `json:"last_retry_at,omitempty"`
	CreatedAt      time.Time           `json:"created_at"`
	UpdatedAt      time.Time           `json:"updated_at"`
}

type ManualHandling struct {
	ID              string               `gorm:"primaryKey" json:"id"`
	SagaID          string               `json:"saga_id"`
	OrderID         string               `json:"order_id"`
	IssueType       string               `json:"issue_type"`
	Description     string               `json:"description"`
	Status          ManualHandlingStatus `json:"status"`
	AssignedTo      string               `json:"assigned_to,omitempty"`
	Resolution      string               `json:"resolution,omitempty"`
	ResolvedAt      *time.Time           `json:"resolved_at,omitempty"`
	CreatedAt       time.Time            `json:"created_at"`
	UpdatedAt       time.Time            `json:"updated_at"`
}

type ConsistencyReport struct {
	ReportID      string              `json:"report_id"`
	GeneratedAt   time.Time           `json:"generated_at"`
	TimeRange     TimeRange           `json:"time_range"`
	Summary       ReportSummary       `json:"summary"`
	Orders        []OrderReport       `json:"orders,omitempty"`
	Inconsistents []InconsistentItem  `json:"inconsistents,omitempty"`
	ManualTasks   []ManualTaskReport  `json:"manual_tasks,omitempty"`
}

type TimeRange struct {
	From time.Time `json:"from"`
	To   time.Time `json:"to"`
}

type ReportSummary struct {
	TotalOrders       int `json:"total_orders"`
	SuccessfulOrders  int `json:"successful_orders"`
	FailedOrders      int `json:"failed_orders"`
	CompensatedOrders int `json:"compensated_orders"`
	InconsistentCount int `json:"inconsistent_count"`
	PendingManual     int `json:"pending_manual"`
}

type OrderReport struct {
	OrderID        string        `json:"order_id"`
	OrderStatus    OrderStatus   `json:"order_status"`
	InventoryStatus string       `json:"inventory_status"`
	BalanceStatus  string        `json:"balance_status"`
	CouponStatus   string        `json:"coupon_status"`
	SagaStatus     SagaStatus    `json:"saga_status"`
	IsConsistent   bool          `json:"is_consistent"`
	InconsistencyReason string    `json:"inconsistency_reason,omitempty"`
}

type InconsistentItem struct {
	OrderID       string `json:"order_id"`
	ResourceType  string `json:"resource_type"`
	ExpectedState string `json:"expected_state"`
	ActualState   string `json:"actual_state"`
	Severity      string `json:"severity"`
	Description   string `json:"description"`
}

type ManualTaskReport struct {
	TaskID      string               `json:"task_id"`
	OrderID     string               `json:"order_id"`
	IssueType   string               `json:"issue_type"`
	Status      ManualHandlingStatus `json:"status"`
	Description string               `json:"description"`
	CreatedAt   time.Time            `json:"created_at"`
}

type FailureInjection struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	ServiceName string    `json:"service_name"`
	Operation   string    `json:"operation"`
	FailureType string    `json:"failure_type"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateOrderRequest struct {
	UserID    string  `json:"user_id"`
	ProductID string  `json:"product_id"`
	Quantity  int     `json:"quantity"`
	CouponID  string  `json:"coupon_id,omitempty"`
}

type CreateOrderResponse struct {
	OrderID string     `json:"order_id"`
	SagaID  string     `json:"saga_id"`
	Status  SagaStatus `json:"status"`
}

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}
