package services

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"gorm.io/gorm"

	"saga-demo/internal/database"
	"saga-demo/internal/models"
	"saga-demo/internal/utils"
)

type OutboxService struct {
	db *gorm.DB
}

func NewOutboxService() *OutboxService {
	return &OutboxService{
		db: database.GetDB(),
	}
}

func (s *OutboxService) CreateEvent(aggregateID, aggregateType, eventType string, payload interface{}) error {
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	event := &models.OutboxEvent{
		ID:            utils.GenerateEventID(),
		AggregateID:   aggregateID,
		AggregateType: aggregateType,
		EventType:     eventType,
		Payload:       string(payloadJSON),
		Status:        models.OutboxStatusPending,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	return s.db.Create(event).Error
}

func (s *OutboxService) CreateEventInTx(tx *gorm.DB, aggregateID, aggregateType, eventType string, payload interface{}) error {
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	event := &models.OutboxEvent{
		ID:            utils.GenerateEventID(),
		AggregateID:   aggregateID,
		AggregateType: aggregateType,
		EventType:     eventType,
		Payload:       string(payloadJSON),
		Status:        models.OutboxStatusPending,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	return tx.Create(event).Error
}

func (s *OutboxService) GetPendingEvents(limit int) ([]models.OutboxEvent, error) {
	var events []models.OutboxEvent
	err := s.db.Where("status = ?", models.OutboxStatusPending).
		Order("created_at ASC").
		Limit(limit).
		Find(&events).Error
	return events, err
}

func (s *OutboxService) MarkAsPublished(eventID string) error {
	now := time.Now()
	result := s.db.Model(&models.OutboxEvent{}).
		Where("id = ?", eventID).
		Updates(map[string]interface{}{
			"status":      models.OutboxStatusPublished,
			"published_at": &now,
			"updated_at":  now,
		})

	if result.RowsAffected == 0 {
		return fmt.Errorf("event not found: %s", eventID)
	}

	return result.Error
}

func (s *OutboxService) MarkAsFailed(eventID string, errorMsg string) error {
	result := s.db.Model(&models.OutboxEvent{}).
		Where("id = ?", eventID).
		Updates(map[string]interface{}{
			"status":     models.OutboxStatusFailed,
			"updated_at": time.Now(),
		})

	if result.RowsAffected == 0 {
		return fmt.Errorf("event not found: %s", eventID)
	}

	return result.Error
}

func (s *OutboxService) ProcessEvents(handler func(event *models.OutboxEvent) error) error {
	events, err := s.GetPendingEvents(100)
	if err != nil {
		return err
	}

	for i := range events {
		event := &events[i]

		if err := handler(event); err != nil {
			log.Printf("Failed to handle event %s: %v", event.ID, err)
			if err := s.MarkAsFailed(event.ID, err.Error()); err != nil {
				log.Printf("Failed to mark event as failed: %v", err)
			}
			continue
		}

		if err := s.MarkAsPublished(event.ID); err != nil {
			log.Printf("Failed to mark event as published: %v", err)
		}
	}

	return nil
}

func (s *OutboxService) GetEventsByAggregate(aggregateID string) ([]models.OutboxEvent, error) {
	var events []models.OutboxEvent
	err := s.db.Where("aggregate_id = ?", aggregateID).
		Order("created_at ASC").
		Find(&events).Error
	return events, err
}

func (s *OutboxService) GetAllEvents() ([]models.OutboxEvent, error) {
	var events []models.OutboxEvent
	err := s.db.Order("created_at DESC").Find(&events).Error
	return events, err
}
