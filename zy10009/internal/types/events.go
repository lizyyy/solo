package types

import (
	"time"

	"github.com/google/uuid"
)

type EventType string

const (
	EventTypeStockDeducted    EventType = "stock_deducted"
	EventTypeOrderCreated     EventType = "order_created"
	EventTypeOrderFailed      EventType = "order_failed"
	EventTypeCompensationStarted EventType = "compensation_started"
	EventTypeCompensationSuccess EventType = "compensation_success"
	EventTypeCompensationFailed  EventType = "compensation_failed"
	EventTypeStockRollback    EventType = "stock_rollback"
	EventTypeConnectionPoolExhausted EventType = "connection_pool_exhausted"
	EventTypeMessageBacklog   EventType = "message_backlog"
	EventTypeGoroutineLeak    EventType = "goroutine_leak"
	EventTypeDBLockWait       EventType = "db_lock_wait"
	EventTypeCacheDirty       EventType = "cache_dirty"
	EventTypeConfigDrift      EventType = "config_drift"
	EventTypeStateChange      EventType = "state_change"
)

type EventStatus string

const (
	EventStatusPending   EventStatus = "pending"
	EventStatusSuccess   EventStatus = "success"
	EventStatusFailed    EventStatus = "failed"
	EventStatusRetrying  EventStatus = "retrying"
)

type Event struct {
	ID        uuid.UUID              `json:"id"`
	Type      EventType              `json:"type"`
	Status    EventStatus            `json:"status"`
	OrderID   *string                `json:"order_id,omitempty"`
	ProductID *string                `json:"product_id,omitempty"`
	Payload   map[string]interface{} `json:"payload"`
	Timestamp time.Time              `json:"timestamp"`
	Duration  *int64                 `json:"duration_ms,omitempty"`
	Error     *string                `json:"error,omitempty"`
	Retry     int                    `json:"retry"`
	Sequence  int64                  `json:"sequence"`
}

type OrderStatus string

const (
	OrderStatusPending      OrderStatus = "pending"
	OrderStatusCreated      OrderStatus = "created"
	OrderStatusFailed       OrderStatus = "failed"
	OrderStatusCompensating OrderStatus = "compensating"
	OrderStatusRolledBack   OrderStatus = "rolled_back"
	OrderStatusCompleted    OrderStatus = "completed"
)

type Order struct {
	ID         string                 `json:"id"`
	ProductID  string                 `json:"product_id"`
	Quantity   int                    `json:"quantity"`
	Status     OrderStatus            `json:"status"`
	Amount     float64                `json:"amount"`
	Payload    map[string]interface{} `json:"payload"`
	CreatedAt  time.Time              `json:"created_at"`
	UpdatedAt  time.Time              `json:"updated_at"`
	RetryCount int                    `json:"retry_count"`
}

type Stock struct {
	ProductID  string    `json:"product_id"`
	Quantity   int       `json:"quantity"`
	Reserved   int       `json:"reserved"`
	UpdatedAt  time.Time `json:"updated_at"`
	Version    int       `json:"version"`
}

type SystemState struct {
	Timestamp       time.Time         `json:"timestamp"`
	StockSnapshot   map[string]Stock  `json:"stock_snapshot"`
	OrderSnapshot   map[string]Order  `json:"order_snapshot"`
	ConnectionPool  ConnectionPoolState `json:"connection_pool"`
	MessageQueue    MessageQueueState `json:"message_queue"`
	GoroutineCount  int               `json:"goroutine_count"`
	CacheHits       int64             `json:"cache_hits"`
	CacheMisses     int64             `json:"cache_misses"`
	ActiveLocks     int               `json:"active_locks"`
	ConfigVersion   int               `json:"config_version"`
}

type ConnectionPoolState struct {
	TotalConns     int `json:"total_conns"`
	ActiveConns    int `json:"active_conns"`
	IdleConns      int `json:"idle_conns"`
	MaxConns       int `json:"max_conns"`
	WaitCount      int64 `json:"wait_count"`
	WaitDurationMs int64 `json:"wait_duration_ms"`
}

type MessageQueueState struct {
	PendingCount    int `json:"pending_count"`
	ProcessingCount int `json:"processing_count"`
	FailedCount     int `json:"failed_count"`
	TotalProcessed  int64 `json:"total_processed"`
	BacklogPressure float64 `json:"backlog_pressure"`
}

type CompensationTask struct {
	ID          uuid.UUID `json:"id"`
	OrderID     string    `json:"order_id"`
	ProductID   string    `json:"product_id"`
	Quantity    int       `json:"quantity"`
	Status      EventStatus `json:"status"`
	RetryCount  int       `json:"retry_count"`
	MaxRetries  int       `json:"max_retries"`
	NextRetry   time.Time `json:"next_retry"`
	LastError   *string   `json:"last_error"`
	CreatedAt   time.Time `json:"created_at"`
}

type FaultConfig struct {
	Enabled              bool  `json:"enabled"`
	ConnectionPoolExhausted *FaultConfigItem `json:"connection_pool_exhausted,omitempty"`
	MessageBacklog       *FaultConfigItem `json:"message_backlog,omitempty"`
	GoroutineLeak        *FaultConfigItem `json:"goroutine_leak,omitempty"`
	DBLockWait           *FaultConfigItem `json:"db_lock_wait,omitempty"`
	CacheDirtyData       *FaultConfigItem `json:"cache_dirty_data,omitempty"`
	ConfigDrift          *FaultConfigItem `json:"config_drift,omitempty"`
}

type FaultConfigItem struct {
	Enabled      bool    `json:"enabled"`
	DurationSec  int     `json:"duration_seconds,omitempty"`
	BacklogThreshold int `json:"backlog_threshold,omitempty"`
	LeakRate     float64 `json:"leak_rate,omitempty"`
	LockTimeoutMs int    `json:"lock_timeout_ms,omitempty"`
	WaitProbability float64 `json:"wait_probability,omitempty"`
	DirtyProbability float64 `json:"dirty_probability,omitempty"`
	DriftIntervalSec int `json:"drift_interval_seconds,omitempty"`
}

type ReplayRequest struct {
	StartSequence int64 `json:"start_sequence"`
	EndSequence   int64 `json:"end_sequence"`
	Speed         float64 `json:"speed"`
}

type TimelineRequest struct {
	StartTime  *time.Time `json:"start_time,omitempty"`
	EndTime    *time.Time `json:"end_time,omitempty"`
	EventTypes []EventType `json:"event_types,omitempty"`
	OrderID    *string    `json:"order_id,omitempty"`
	Limit      int        `json:"limit"`
	Offset     int        `json:"offset"`
}

type TimelineResponse struct {
	Events     []Event `json:"events"`
	TotalCount int64   `json:"total_count"`
	HasMore    bool    `json:"has_more"`
}
