package event

import (
	"context"
	"encoding/json"
	"sync"
	"time"
)

type EventType string

const (
	EventTypeInventoryReserved  EventType = "inventory_reserved"
	EventTypeInventoryReleased  EventType = "inventory_released"
	EventTypeOrderCreated       EventType = "order_created"
	EventTypeOrderFailed        EventType = "order_failed"
	EventTypePaymentSucceeded   EventType = "payment_succeeded"
	EventTypePaymentFailed      EventType = "payment_failed"
	EventTypeCompensationStart  EventType = "compensation_start"
	EventTypeCompensationRetry  EventType = "compensation_retry"
	EventTypeCompensationFailed EventType = "compensation_failed"
	EventTypeCompensationSuccess EventType = "compensation_success"
	
	EventTypeChaosInject       EventType = "chaos_inject"
	EventTypeChaosRecover      EventType = "chaos_recover"
	
	EventTypeConnectionExhausted EventType = "connection_exhausted"
	EventTypeMessageBacklog     EventType = "message_backlog"
	EventTypeGoroutineLeak      EventType = "goroutine_leak"
	EventTypeDBLockWait         EventType = "db_lock_wait"
	EventTypeCacheDirty         EventType = "cache_dirty"
	EventTypeConfigDrift        EventType = "config_drift"
)

type EventStatus string

const (
	EventStatusSuccess EventStatus = "success"
	EventStatusFailed  EventStatus = "failed"
	EventStatusPending EventStatus = "pending"
	EventStatusRetrying EventStatus = "retrying"
)

type Event struct {
	ID          string                 `json:"id"`
	TraceID     string                 `json:"trace_id"`
	Type        EventType              `json:"type"`
	Status      EventStatus            `json:"status"`
	Service     string                 `json:"service"`
	Timestamp   time.Time              `json:"timestamp"`
	Duration    time.Duration          `json:"duration"`
	Payload     map[string]interface{} `json:"payload"`
	Error       string                 `json:"error,omitempty"`
	PreviousID  string                 `json:"previous_id,omitempty"`
	RetryCount  int                    `json:"retry_count"`
	CorrelationID string               `json:"correlation_id"`
}

type EventStore interface {
	Store(ctx context.Context, event Event) error
	GetByTraceID(ctx context.Context, traceID string) ([]Event, error)
	GetByCorrelationID(ctx context.Context, correlationID string) ([]Event, error)
	GetAll(ctx context.Context, limit int) ([]Event, error)
	GetByType(ctx context.Context, eventType EventType, limit int) ([]Event, error)
}

type EventPublisher interface {
	Publish(ctx context.Context, event Event) error
}

type MemoryEventStore struct {
	mu     sync.RWMutex
	events []Event
	byTraceID map[string][]Event
	byCorrelationID map[string][]Event
}

func NewMemoryEventStore() *MemoryEventStore {
	return &MemoryEventStore{
		events: make([]Event, 0),
		byTraceID: make(map[string][]Event),
		byCorrelationID: make(map[string][]Event),
	}
}

func (s *MemoryEventStore) Store(ctx context.Context, event Event) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	s.events = append(s.events, event)
	
	if event.TraceID != "" {
		s.byTraceID[event.TraceID] = append(s.byTraceID[event.TraceID], event)
	}
	
	if event.CorrelationID != "" {
		s.byCorrelationID[event.CorrelationID] = append(s.byCorrelationID[event.CorrelationID], event)
	}
	
	return nil
}

func (s *MemoryEventStore) GetByTraceID(ctx context.Context, traceID string) ([]Event, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	events := make([]Event, len(s.byTraceID[traceID]))
	copy(events, s.byTraceID[traceID])
	return events, nil
}

func (s *MemoryEventStore) GetByCorrelationID(ctx context.Context, correlationID string) ([]Event, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	events := make([]Event, len(s.byCorrelationID[correlationID]))
	copy(events, s.byCorrelationID[correlationID])
	return events, nil
}

func (s *MemoryEventStore) GetAll(ctx context.Context, limit int) ([]Event, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	if limit <= 0 || limit > len(s.events) {
		limit = len(s.events)
	}
	
	start := len(s.events) - limit
	if start < 0 {
		start = 0
	}
	
	result := make([]Event, limit-start)
	copy(result, s.events[start:])
	return result, nil
}

func (s *MemoryEventStore) GetByType(ctx context.Context, eventType EventType, limit int) ([]Event, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	result := make([]Event, 0)
	count := 0
	
	for i := len(s.events) - 1; i >= 0 && count < limit; i-- {
		if s.events[i].Type == eventType {
			result = append([]Event{s.events[i]}, result...)
			count++
		}
	}
	
	return result, nil
}

type EventManager struct {
	store     EventStore
	publisher EventPublisher
}

func NewEventManager(store EventStore, publisher EventPublisher) *EventManager {
	return &EventManager{
		store:     store,
		publisher: publisher,
	}
}

func (m *EventManager) Record(ctx context.Context, event Event) error {
	event.Timestamp = time.Now()
	
	if err := m.store.Store(ctx, event); err != nil {
		return err
	}
	
	if m.publisher != nil {
		if err := m.publisher.Publish(ctx, event); err != nil {
			return err
		}
	}
	
	return nil
}

func (m *EventManager) GetTrace(ctx context.Context, traceID string) ([]Event, error) {
	return m.store.GetByTraceID(ctx, traceID)
}

func (m *EventManager) GetCorrelation(ctx context.Context, correlationID string) ([]Event, error) {
	return m.store.GetByCorrelationID(ctx, correlationID)
}

func (m *EventManager) GetRecent(ctx context.Context, limit int) ([]Event, error) {
	return m.store.GetAll(ctx, limit)
}

func MarshalPayload(data interface{}) map[string]interface{} {
	b, err := json.Marshal(data)
	if err != nil {
		return map[string]interface{}{"error": err.Error()}
	}
	
	var result map[string]interface{}
	if err := json.Unmarshal(b, &result); err != nil {
		return map[string]interface{}{"error": err.Error()}
	}
	
	return result
}
