package models

import (
	"sync"
	"time"
)

type ScenarioType string

const (
	ScenarioConnectionPool ScenarioType = "connection_pool_exhaustion"
	ScenarioMessageQueue   ScenarioType = "message_queue_backlog"
	ScenarioGoroutineLeak  ScenarioType = "goroutine_leak"
	ScenarioDBLockWait     ScenarioType = "db_lock_wait"
	ScenarioCacheDirty     ScenarioType = "cache_dirty_data"
	ScenarioConfigDrift    ScenarioType = "config_drift"
	ScenarioMigration      ScenarioType = "migration_rollback"
)

type ScenarioStatus string

const (
	StatusReady     ScenarioStatus = "ready"
	StatusRunning   ScenarioStatus = "running"
	StatusReplaying ScenarioStatus = "replaying"
	StatusRecovered ScenarioStatus = "recovered"
	StatusError     ScenarioStatus = "error"
)

type EventLevel string

const (
	LevelDebug EventLevel = "debug"
	LevelInfo  EventLevel = "info"
	LevelWarn  EventLevel = "warn"
	LevelError EventLevel = "error"
)

type Event struct {
	ID        string                 `json:"id"`
	Timestamp time.Time              `json:"timestamp"`
	Scenario  string                 `json:"scenario"`
	Level     EventLevel             `json:"level"`
	Message   string                 `json:"message"`
	Data      map[string]interface{} `json:"data,omitempty"`
}

type SystemState struct {
	Timestamp        time.Time              `json:"timestamp"`
	ActiveGoroutines int                    `json:"active_goroutines"`
	DBConnections    int                    `json:"db_connections"`
	DBIdle           int                    `json:"db_idle"`
	DBInUse          int                    `json:"db_in_use"`
	RedisConnections int                    `json:"redis_connections"`
	QueueLength      int                    `json:"queue_length"`
	Metrics          map[string]interface{} `json:"metrics,omitempty"`
}

type EventEmitter func(Event)

type Scenario interface {
	Name() string
	Type() ScenarioType
	Start() error
	Stop() error
	Status() ScenarioStatus
	GetEvents() []Event
	CurrentState() SystemState
	Config() map[string]interface{}
	Recover() error
	SetEventEmitter(EventEmitter)
}

type Timeline struct {
	mu     sync.RWMutex
	events []Event
	lastID int64
}

func NewTimeline() *Timeline {
	return &Timeline{
		events: make([]Event, 0),
	}
}

func (t *Timeline) Add(event Event) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.events = append(t.events, event)
}

func (t *Timeline) GetAll() []Event {
	t.mu.RLock()
	defer t.mu.RUnlock()
	result := make([]Event, len(t.events))
	copy(result, t.events)
	return result
}

func (t *Timeline) GetByScenario(scenario string) []Event {
	t.mu.RLock()
	defer t.mu.RUnlock()
	result := make([]Event, 0)
	for _, e := range t.events {
		if e.Scenario == scenario {
			result = append(result, e)
		}
	}
	return result
}

func (t *Timeline) GetByLevel(level EventLevel) []Event {
	t.mu.RLock()
	defer t.mu.RUnlock()
	result := make([]Event, 0)
	for _, e := range t.events {
		if e.Level == level {
			result = append(result, e)
		}
	}
	return result
}

type Snapshot struct {
	Timestamp time.Time
	State     SystemState
	Events    []Event
}
