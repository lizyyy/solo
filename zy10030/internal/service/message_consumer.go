package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/segmentio/kafka-go"

	"grayscale-simulator/internal/model"
	"grayscale-simulator/pkg/database"
	"grayscale-simulator/pkg/logger"
	"grayscale-simulator/pkg/mq"
	"grayscale-simulator/pkg/tracer"
)

type MessageConsumerService struct {
	enableIdempotency bool
	dedupWindow       time.Duration
	maxProcessingTime time.Duration
	enableManualCommit bool
	handlers          map[string]MessageHandler
	handlerMu         sync.RWMutex
	running           bool
	stopChan          chan struct{}
}

type MessageHandler func(ctx context.Context, event *model.GrayEvent) error

func NewMessageConsumerService(enableIdempotency bool, dedupWindowStr, maxProcessingTimeStr string, enableManualCommit bool) *MessageConsumerService {
	dedupWindow, _ := time.ParseDuration(dedupWindowStr)
	maxProcessingTime, _ := time.ParseDuration(maxProcessingTimeStr)
	
	if dedupWindow <= 0 {
		dedupWindow = 5 * time.Minute
	}
	if maxProcessingTime <= 0 {
		maxProcessingTime = 30 * time.Second
	}

	return &MessageConsumerService{
		enableIdempotency:  enableIdempotency,
		dedupWindow:        dedupWindow,
		maxProcessingTime:  maxProcessingTime,
		enableManualCommit: enableManualCommit,
		handlers:           make(map[string]MessageHandler),
		stopChan:           make(chan struct{}),
	}
}

func (s *MessageConsumerService) RegisterHandler(eventType string, handler MessageHandler) {
	s.handlerMu.Lock()
	defer s.handlerMu.Unlock()
	s.handlers[eventType] = handler
}

func (s *MessageConsumerService) Start(ctx context.Context) error {
	if s.running {
		return fmt.Errorf("consumer already running")
	}

	s.running = true
	logger.Info("Starting message consumer service")

	go s.consumeLoop(ctx)

	return nil
}

func (s *MessageConsumerService) Stop() {
	if !s.running {
		return
	}

	logger.Info("Stopping message consumer service")
	close(s.stopChan)
	s.running = false
}

func (s *MessageConsumerService) consumeLoop(ctx context.Context) {
	for {
		select {
		case <-s.stopChan:
			logger.Info("Message consumer stopped")
			return
		case <-ctx.Done():
			logger.Info("Message consumer stopped due to context cancellation")
			return
		default:
			event, err := mq.ConsumeEvent(ctx)
			if err != nil {
				if err == context.Canceled {
					return
				}
				logger.Errorf("Failed to consume message: %v", err)
				time.Sleep(1 * time.Second)
				continue
			}

			if err := s.processEvent(ctx, event); err != nil {
				logger.Errorf("Failed to process event %s: %v", event.EventType, err)
			}
		}
	}
}

func (s *MessageConsumerService) processEvent(ctx context.Context, event *model.GrayEvent) error {
	ctx, span := tracer.StartSpan(ctx, "message_consumer.ProcessEvent")
	defer span.End()

	tracer.AddAttributesToSpan(span, map[string]interface{}{
		"event_type":    event.EventType,
		"service_name":  event.ServiceName,
		"release_id":    event.ReleaseID,
	})

	messageID := s.generateMessageID(event)

	if s.enableIdempotency {
		shouldProcess, dedupRecord, err := s.checkIdempotency(ctx, messageID, event)
		if err != nil {
			return fmt.Errorf("idempotency check failed: %w", err)
		}

		if !shouldProcess {
			logger.WithFields(map[string]interface{}{
				"message_id": messageID,
				"event_type": event.EventType,
			}).Info("Message already processed, skipping (idempotency)")
			return nil
		}

		defer s.updateDedupRecord(ctx, dedupRecord.ID)
	}

	s.handlerMu.RLock()
	handler, exists := s.handlers[event.EventType]
	s.handlerMu.RUnlock()

	if !exists {
		logger.WithField("event_type", event.EventType).Warn("No handler registered for event type")
		return nil
	}

	processCtx, cancel := context.WithTimeout(ctx, s.maxProcessingTime)
	defer cancel()

	if err := handler(processCtx, event); err != nil {
		logger.WithFields(map[string]interface{}{
			"event_type": event.EventType,
			"error":      err.Error(),
		}).Error("Handler failed to process event")
		return err
	}

	logger.WithFields(map[string]interface{}{
		"event_type":   event.EventType,
		"message_id":   messageID,
		"release_id":   event.ReleaseID,
	}).Info("Event processed successfully")

	return nil
}

func (s *MessageConsumerService) checkIdempotency(ctx context.Context, messageID string, event *model.GrayEvent) (bool, *model.MessageDedupRecord, error) {
	_, span := tracer.StartSpan(ctx, "message_consumer.CheckIdempotency")
	defer span.End()

	tx, err := database.DB.Beginx()
	if err != nil {
		return false, nil, err
	}
	defer tx.Rollback()

	now := time.Now()
	windowStart := now.Add(-s.dedupWindow)

	var existing model.MessageDedupRecord
	err = tx.Get(&existing, `
		SELECT * FROM message_dedup_records 
		WHERE message_id = $1 AND created_at >= $2
		ORDER BY created_at DESC LIMIT 1
	`, messageID, windowStart)

	if err == nil {
		switch existing.Status {
		case "processed":
			return false, &existing, nil
		case "processing":
			return false, &existing, nil
		case "failed":
			return true, &existing, nil
		}
	} else if err != sql.ErrNoRows {
		return false, nil, err
	}

	dedupRecord := &model.MessageDedupRecord{
		MessageID:     messageID,
		Topic:         "grayscale-events",
		Partition:     0,
		Offset:        0,
		ConsumerGroup: "grayscale-simulator-group",
		Status:        "processing",
		CreatedAt:     now,
	}

	_, err = tx.Exec(`
		INSERT INTO message_dedup_records (message_id, topic, partition, offset, consumer_group, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (message_id, topic, consumer_group) DO NOTHING
	`, dedupRecord.MessageID, dedupRecord.Topic, dedupRecord.Partition, dedupRecord.Offset,
		dedupRecord.ConsumerGroup, dedupRecord.Status, dedupRecord.CreatedAt)

	if err != nil {
		return false, nil, err
	}

	if err := tx.Commit(); err != nil {
		return false, nil, err
	}

	var inserted model.MessageDedupRecord
	err = database.Get(&inserted, `
		SELECT * FROM message_dedup_records 
		WHERE message_id = $1 AND topic = $2 AND consumer_group = $3
		ORDER BY created_at DESC LIMIT 1
	`, messageID, dedupRecord.Topic, dedupRecord.ConsumerGroup)

	if err != nil {
		return false, nil, err
	}

	return true, &inserted, nil
}

func (s *MessageConsumerService) updateDedupRecord(ctx context.Context, recordID int64) {
	_, err := database.Exec(`
		UPDATE message_dedup_records 
		SET status = 'processed', processed_at = $1 
		WHERE id = $2
	`, time.Now(), recordID)

	if err != nil {
		logger.Errorf("Failed to update dedup record: %v", err)
	}
}

func (s *MessageConsumerService) generateMessageID(event *model.GrayEvent) string {
	return fmt.Sprintf("%s-%d-%s", event.EventType, event.ReleaseID, event.Timestamp.Format(time.RFC3339Nano))
}

func (s *MessageConsumerService) SimulateDuplicateConsumption(ctx context.Context, event *model.GrayEvent, count int) error {
	if count < 2 {
		count = 2
	}

	logger.WithFields(map[string]interface{}{
		"event_type": event.EventType,
		"count":      count,
	}).Info("Simulating duplicate message consumption")

	for i := 0; i < count; i++ {
		logger.WithField("attempt", i+1).Info("Processing duplicate message")
		
		if err := s.processEvent(ctx, event); err != nil {
			logger.WithField("attempt", i+1).Errorf("Processing failed: %v", err)
			return err
		}

		if i < count-1 {
			delay := time.Duration(rand.Intn(1000)) * time.Millisecond
			time.Sleep(delay)
		}
	}

	return nil
}

func (s *MessageConsumerService) GetDedupRecords(ctx context.Context, messageID string, limit int) ([]*model.MessageDedupRecord, error) {
	query := `SELECT * FROM message_dedup_records WHERE 1=1`
	args := []interface{}{}
	argIndex := 1

	if messageID != "" {
		query += fmt.Sprintf(` AND message_id = $%d`, argIndex)
		args = append(args, messageID)
		argIndex++
	}

	query += ` ORDER BY created_at DESC LIMIT $` + fmt.Sprint(argIndex)
	args = append(args, limit)

	var records []*model.MessageDedupRecord
	if err := database.Select(&records, query, args...); err != nil {
		return nil, err
	}

	return records, nil
}

func (s *MessageConsumerService) CleanupOldDedupRecords(ctx context.Context) error {
	cutoff := time.Now().Add(-s.dedupWindow * 2)
	
	result, err := database.Exec(`
		DELETE FROM message_dedup_records 
		WHERE created_at < $1 AND status = 'processed'
	`, cutoff)

	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	logger.WithField("deleted_count", rowsAffected).Info("Cleaned up old dedup records")
	
	return nil
}

func init() {
	_ = kafka.Reader{}
	_ = json.Marshal
}

