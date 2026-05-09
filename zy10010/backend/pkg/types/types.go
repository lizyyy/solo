package types

import (
	"time"
)

type EventType string

const (
	EventTypeConnectionCreated   EventType = "connection_created"
	EventTypeConnectionClosed    EventType = "connection_closed"
	EventTypeConnectionPoolExhausted EventType = "connection_pool_exhausted"
	EventTypeMessageSent         EventType = "message_sent"
	EventTypeMessageReceived     EventType = "message_received"
	EventTypeMessageQueued       EventType = "message_queued"
	EventTypeMessageOrderError   EventType = "message_order_error"
	EventTypeGoroutineLeaked     EventType = "goroutine_leaked"
	EventTypeGoroutineCreated    EventType = "goroutine_created"
	EventTypeDbLockWait          EventType = "db_lock_wait"
	EventTypeDbLockAcquired      EventType = "db_lock_acquired"
	EventTypeDbLockReleased      EventType = "db_lock_released"
	EventTypeCacheDirty          EventType = "cache_dirty"
	EventTypeCacheUpdated        EventType = "cache_updated"
	EventTypeCacheStale          EventType = "cache_stale"
	EventTypeConfigChanged       EventType = "config_changed"
	EventTypeConfigDrift         EventType = "config_drift"
	EventTypeReconnectAttempt    EventType = "reconnect_attempt"
	EventTypeReconnected         EventType = "reconnected"
	EventTypeSystemStateSnapshot EventType = "system_state_snapshot"
	EventTypeRecoveryStarted     EventType = "recovery_started"
	EventTypeRecoveryCompleted   EventType = "recovery_completed"
)

type EventSeverity string

const (
	SeverityInfo    EventSeverity = "info"
	SeverityWarning EventSeverity = "warning"
	SeverityError   EventSeverity = "error"
	SeverityCritical EventSeverity = "critical"
)

type Event struct {
	ID        string                 `json:"id"`
	Type      EventType              `json:"type"`
	Severity  EventSeverity          `json:"severity"`
	Timestamp time.Time              `json:"timestamp"`
	Source    string                 `json:"source"`
	Message   string                 `json:"message"`
	Data      map[string]interface{} `json:"data,omitempty"`
}

type ConnectionState struct {
	ID             string    `json:"id"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
	LastActiveAt   time.Time `json:"last_active_at"`
	MessageCount   int       `json:"message_count"`
	ReconnectCount int       `json:"reconnect_count"`
}

type MessageState struct {
	ID         string    `json:"id"`
	Content    string    `json:"content"`
	Sequence   int64     `json:"sequence"`
	Status     string    `json:"status"`
	SentAt     time.Time `json:"sent_at"`
	ReceivedAt time.Time `json:"received_at"`
	DelayMs    int64     `json:"delay_ms"`
}

type GoroutineState struct {
	ID           int64     `json:"id"`
	Name         string    `json:"name"`
	CreatedAt    time.Time `json:"created_at"`
	Status       string    `json:"status"`
	IsLeaked     bool      `json:"is_leaked"`
	ExpectedEnd  time.Time `json:"expected_end,omitempty"`
}

type DbLockState struct {
	Resource   string    `json:"resource"`
	HolderID   string    `json:"holder_id"`
	AcquiredAt time.Time `json:"acquired_at"`
	Waiters    []string  `json:"waiters"`
}

type CacheState struct {
	Key         string      `json:"key"`
	Value       interface{} `json:"value"`
	Version     int64       `json:"version"`
	LastUpdated time.Time   `json:"last_updated"`
	IsDirty     bool        `json:"is_dirty"`
	TTL         time.Duration `json:"ttl"`
}

type ConfigState struct {
	Key           string      `json:"key"`
	Value         interface{} `json:"value"`
	Source        string      `json:"source"`
	LastUpdated   time.Time   `json:"last_updated"`
	ExpectedValue interface{} `json:"expected_value,omitempty"`
	HasDrift      bool        `json:"has_drift"`
}

type SystemState struct {
	Timestamp   time.Time            `json:"timestamp"`
	Connections []ConnectionState    `json:"connections"`
	Messages    []MessageState       `json:"messages"`
	Goroutines  []GoroutineState     `json:"goroutines"`
	DbLocks     []DbLockState        `json:"db_locks"`
	Cache       []CacheState         `json:"cache"`
	Config      []ConfigState        `json:"config"`
	Metrics     SystemMetrics        `json:"metrics"`
}

type SystemMetrics struct {
	ActiveConnections   int   `json:"active_connections"`
	ConnectionPoolSize  int   `json:"connection_pool_size"`
	ConnectionPoolUsage int   `json:"connection_pool_usage"`
	MessageQueueSize    int   `json:"message_queue_size"`
	MessageProcessed    int   `json:"message_processed"`
	ActiveGoroutines    int   `json:"active_goroutines"`
	LeakedGoroutines    int   `json:"leaked_goroutines"`
	DbLockWaitTimeMs    int64 `json:"db_lock_wait_time_ms"`
	CacheHitRate        float64 `json:"cache_hit_rate"`
	ConfigDriftCount    int   `json:"config_drift_count"`
}

type ScenarioType string

const (
	ScenarioConnectionPoolExhaustion ScenarioType = "connection_pool_exhaustion"
	ScenarioMessageQueueBacklog      ScenarioType = "message_queue_backlog"
	ScenarioGoroutineLeak            ScenarioType = "goroutine_leak"
	ScenarioDbLockContention         ScenarioType = "db_lock_contention"
	ScenarioCacheDirtyData           ScenarioType = "cache_dirty_data"
	ScenarioConfigDrift              ScenarioType = "config_drift"
	ScenarioMessageOrdering          ScenarioType = "message_ordering"
	ScenarioReconnectChaos           ScenarioType = "reconnect_chaos"
)

type ScenarioConfig struct {
	Type       ScenarioType         `json:"type"`
	Name       string               `json:"name"`
	Duration   time.Duration        `json:"duration"`
	Parameters map[string]interface{} `json:"parameters"`
}

type PlaybackControl struct {
	IsPlaying  bool    `json:"is_playing"`
	Speed      float64 `json:"speed"`
	CurrentIdx int     `json:"current_idx"`
	TotalIdx   int     `json:"total_idx"`
}
