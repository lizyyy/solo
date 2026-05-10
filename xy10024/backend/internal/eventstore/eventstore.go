package eventstore

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"device-borrow-system/internal/models"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type EventStore struct {
	db          *gorm.DB
	redisClient *redis.Client
	mu          sync.RWMutex
}

type EventHandler func(event *models.Event) error

var handlers = make(map[string][]EventHandler)

func NewEventStore(db *gorm.DB, redisClient *redis.Client) *EventStore {
	return &EventStore{
		db:          db,
		redisClient: redisClient,
	}
}

func (es *EventStore) GetDB() *gorm.DB {
	return es.db
}

func RegisterHandler(eventType string, handler EventHandler) {
	handlers[eventType] = append(handlers[eventType], handler)
}

func (es *EventStore) AppendEvent(ctx context.Context, event *models.Event) error {
	es.mu.Lock()
	defer es.mu.Unlock()

	return es.appendEventWithTx(ctx, es.db, event)
}

func (es *EventStore) AppendEventWithTx(ctx context.Context, tx *gorm.DB, event *models.Event) error {
	es.mu.Lock()
	defer es.mu.Unlock()

	return es.appendEventWithTx(ctx, tx, event)
}

func (es *EventStore) appendEventWithTx(ctx context.Context, tx *gorm.DB, event *models.Event) error {
	var maxVersion int
	err := tx.Model(&models.Event{}).
		Where("aggregate_type = ? AND aggregate_id = ?", event.AggregateType, event.AggregateID).
		Select("COALESCE(MAX(event_version), 0)").
		Scan(&maxVersion).Error
	if err != nil {
		return err
	}

	event.EventVersion = maxVersion + 1

	if err := tx.Create(event).Error; err != nil {
		return fmt.Errorf("failed to create event: %w", err)
	}

	if err := es.updateSnapshot(tx, event); err != nil {
		return err
	}

	if eventHandlers, ok := handlers[event.EventType]; ok {
		for _, handler := range eventHandlers {
			if err := handler(event); err != nil {
				return fmt.Errorf("handler failed for event %s: %w", event.EventType, err)
			}
		}
	}

	es.invalidateCache(event.AggregateType, event.AggregateID)

	return nil
}

func (es *EventStore) GetEvents(ctx context.Context, aggregateType string, aggregateID uuid.UUID, fromVersion int) ([]models.Event, error) {
	var events []models.Event

	query := es.db.Where("aggregate_type = ? AND aggregate_id = ?", aggregateType, aggregateID)
	if fromVersion > 0 {
		query = query.Where("event_version > ?", fromVersion)
	}

	err := query.Order("event_version ASC").Find(&events).Error
	return events, err
}

func (es *EventStore) GetEventByID(ctx context.Context, eventID uuid.UUID) (*models.Event, error) {
	var event models.Event
	err := es.db.Where("id = ?", eventID).First(&event).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &event, nil
}

func (es *EventStore) GetEventsByRequestID(ctx context.Context, requestID uuid.UUID) ([]models.Event, error) {
	var events []models.Event
	err := es.db.Where("request_id = ?", requestID).Order("sequence ASC").Find(&events).Error
	return events, err
}

func (es *EventStore) ReplayAggregate(ctx context.Context, aggregateType string, aggregateID uuid.UUID) (map[string]interface{}, error) {
	cacheKey := fmt.Sprintf("replay:%s:%s", aggregateType, aggregateID)
	if es.redisClient != nil {
		if cached, err := es.redisClient.Get(ctx, cacheKey).Result(); err == nil {
			var state map[string]interface{}
			if err := json.Unmarshal([]byte(cached), &state); err == nil {
				return state, nil
			}
		}
	}

	var state map[string]interface{}
	var snapshot models.Snapshot

	err := es.db.Where("aggregate_type = ? AND aggregate_id = ?", aggregateType, aggregateID).
		Order("snapshot_version DESC").
		First(&snapshot).Error
	if err == nil {
		state = snapshot.State
	} else {
		state = make(map[string]interface{})
	}

	fromVersion := 0
	if snapshot.SnapshotVersion > 0 {
		fromVersion = snapshot.SnapshotVersion
	}

	events, err := es.GetEvents(ctx, aggregateType, aggregateID, fromVersion)
	if err != nil {
		return nil, err
	}

	for _, event := range events {
		state = applyEvent(state, &event)
	}

	if es.redisClient != nil {
		jsonData, _ := json.Marshal(state)
		es.redisClient.Set(ctx, cacheKey, jsonData, 5*time.Minute)
	}

	return state, nil
}

func (es *EventStore) updateSnapshot(tx *gorm.DB, event *models.Event) error {
	if event.EventVersion%10 == 0 {
		events, err := es.getEventsForSnapshot(tx, event.AggregateType, event.AggregateID)
		if err != nil {
			return err
		}

		state := make(map[string]interface{})
		for _, e := range events {
			state = applyEvent(state, &e)
		}

		snapshot := models.Snapshot{
			AggregateType:   event.AggregateType,
			AggregateID:     event.AggregateID,
			SnapshotVersion: event.EventVersion,
			LastEventID:     event.ID,
			State:           state,
		}

		return tx.Create(&snapshot).Error
	}
	return nil
}

func (es *EventStore) getEventsForSnapshot(tx *gorm.DB, aggregateType string, aggregateID uuid.UUID) ([]models.Event, error) {
	var events []models.Event
	err := tx.Where("aggregate_type = ? AND aggregate_id = ?", aggregateType, aggregateID).
		Order("event_version ASC").
		Find(&events).Error
	return events, err
}

func (es *EventStore) invalidateCache(aggregateType string, aggregateID uuid.UUID) {
	if es.redisClient == nil {
		return
	}

	ctx := context.Background()
	cacheKey := fmt.Sprintf("replay:%s:%s", aggregateType, aggregateID)
	es.redisClient.Del(ctx, cacheKey)

	pattern := fmt.Sprintf("cache:%s:%s:*", aggregateType, aggregateID)
	keys, _ := es.redisClient.Keys(ctx, pattern).Result()
	for _, key := range keys {
		es.redisClient.Del(ctx, key)
	}
}

func applyEvent(state map[string]interface{}, event *models.Event) map[string]interface{} {
	if state == nil {
		state = make(map[string]interface{})
	}

	for key, value := range event.Payload {
		switch event.EventType {
		case "device.created", "device.updated", "device.borrowed", "device.returned",
			"user.created", "user.updated",
			"borrow.created", "borrow.updated", "borrow.completed":
			state[key] = value
		case "device.deleted", "user.deleted":
			state["deleted"] = true
		}
	}

	state["last_event_version"] = event.EventVersion
	state["last_event_id"] = event.ID
	state["last_event_type"] = event.EventType

	return state
}

func (es *EventStore) ExportEvents(ctx context.Context, aggregateType string, aggregateID uuid.UUID) ([]byte, error) {
	events, err := es.GetEvents(ctx, aggregateType, aggregateID, 0)
	if err != nil {
		return nil, err
	}

	return json.MarshalIndent(events, "", "  ")
}

func (es *EventStore) GetEventHistory(ctx context.Context, aggregateType string, aggregateID uuid.UUID, limit int) ([]models.Event, error) {
	var events []models.Event
	err := es.db.Where("aggregate_type = ? AND aggregate_id = ?", aggregateType, aggregateID).
		Order("event_version DESC").
		Limit(limit).
		Find(&events).Error
	return events, err
}
