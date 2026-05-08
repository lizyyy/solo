package eventbus

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"gorm.io/gorm"

	"chaos-payment/internal/models"
)

type EventType string

const (
	EventTypeOrderCreated        EventType = "ORDER_CREATED"
	EventTypeOrderStatusChanged  EventType = "ORDER_STATUS_CHANGED"
	EventTypePaymentCallback     EventType = "PAYMENT_CALLBACK"
	EventTypeDuplicateCallback   EventType = "DUPLICATE_CALLBACK"
	EventTypeStateSnapshot       EventType = "STATE_SNAPSHOT"
	EventTypeChaosInjected       EventType = "CHAOS_INJECTED"
	EventTypeRecoveryAction      EventType = "RECOVERY_ACTION"
	EventTypeCacheWrite          EventType = "CACHE_WRITE"
	EventTypeCacheRead           EventType = "CACHE_READ"
	EventTypeDBTransaction       EventType = "DB_TRANSACTION"
	EventTypeGoroutineSpawned    EventType = "GOROUTINE_SPAWNED"
	EventTypeGoroutineLeaked     EventType = "GOROUTINE_LEAKED"
)

type EventHandler func(event *models.Event)

type EventBus struct {
	db          *gorm.DB
	handlers    map[EventType][]EventHandler
	handlersMu  sync.RWMutex
	eventCh     chan *models.Event
	ctx         context.Context
	cancel      context.CancelFunc
	wg          sync.WaitGroup
}

var (
	globalBus *EventBus
	once      sync.Once
)

func GetGlobalBus(db *gorm.DB) *EventBus {
	once.Do(func() {
		globalBus = NewEventBus(db)
	})
	return globalBus
}

func NewEventBus(db *gorm.DB) *EventBus {
	ctx, cancel := context.WithCancel(context.Background())
	bus := &EventBus{
		db:       db,
		handlers: make(map[EventType][]EventHandler),
		eventCh:  make(chan *models.Event, 10000),
		ctx:      ctx,
		cancel:   cancel,
	}
	bus.startProcessing()
	return bus
}

func (eb *EventBus) startProcessing() {
	eb.wg.Add(1)
	go func() {
		defer eb.wg.Done()
		for {
			select {
			case <-eb.ctx.Done():
				return
			case event := <-eb.eventCh:
				eb.processEvent(event)
			}
		}
	}()
}

func (eb *EventBus) processEvent(event *models.Event) {
	if err := eb.db.Create(event).Error; err != nil {
		log.Printf("[EventBus] Failed to persist event: %v", err)
	}

	eb.handlersMu.RLock()
	handlers := eb.handlers[EventType(event.EventType)]
	allHandlers := eb.handlers["*"]
	eb.handlersMu.RUnlock()

	for _, handler := range handlers {
		handler(event)
	}
	for _, handler := range allHandlers {
		handler(event)
	}
}

func (eb *EventBus) Subscribe(eventType EventType, handler EventHandler) {
	eb.handlersMu.Lock()
	defer eb.handlersMu.Unlock()
	eb.handlers[eventType] = append(eb.handlers[eventType], handler)
}

func (eb *EventBus) Publish(eventType EventType, entityID, entityType string, oldValue, newValue interface{}, source string) *models.Event {
	event := &models.Event{
		EventType:  string(eventType),
		EntityID:   entityID,
		EntityType: entityType,
		Source:     source,
		Timestamp:  time.Now(),
	}

	if oldValue != nil {
		if data, err := json.Marshal(oldValue); err == nil {
			event.OldValue = string(data)
		}
	}
	if newValue != nil {
		if data, err := json.Marshal(newValue); err == nil {
			event.NewValue = string(data)
		}
	}

	select {
	case eb.eventCh <- event:
	default:
		log.Printf("[EventBus] Event channel full, dropping event: %s", eventType)
	}

	return event
}

func (eb *EventBus) GetEvents(entityID string, eventType *EventType, startTime, endTime *time.Time, limit int) ([]models.Event, error) {
	query := eb.db.Model(&models.Event{})

	if entityID != "" {
		query = query.Where("entity_id = ?", entityID)
	}
	if eventType != nil {
		query = query.Where("event_type = ?", string(*eventType))
	}
	if startTime != nil {
		query = query.Where("timestamp >= ?", *startTime)
	}
	if endTime != nil {
		query = query.Where("timestamp <= ?", *endTime)
	}

	var events []models.Event
	if err := query.Order("timestamp DESC").Limit(limit).Find(&events).Error; err != nil {
		return nil, err
	}
	return events, nil
}

func (eb *EventBus) GetTimeline(startTime, endTime time.Time, limit int) ([]models.Event, error) {
	var events []models.Event
	err := eb.db.Model(&models.Event{}).
		Where("timestamp >= ? AND timestamp <= ?", startTime, endTime).
		Order("timestamp ASC").
		Limit(limit).
		Find(&events).Error
	return events, err
}

func (eb *EventBus) Stop() {
	eb.cancel()
	eb.wg.Wait()
}
