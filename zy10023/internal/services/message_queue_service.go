package services

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"

	"github.com/api-guardian/api-guardian/internal/database"
	"github.com/api-guardian/api-guardian/internal/logger"
	"github.com/api-guardian/api-guardian/internal/models"
	"github.com/api-guardian/api-guardian/internal/tracing"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type Message struct {
	ID          string
	Topic       string
	Content     map[string]interface{}
	Attempts    int
	IsDuplicate bool
}

type MessageQueueService struct {
	db                 *gorm.DB
	topics             sync.Map
	consumers          sync.Map
	runningSimulations sync.Map
}

func NewMessageQueueService() *MessageQueueService {
	return &MessageQueueService{
		db: database.GetDB(),
	}
}

func (s *MessageQueueService) CreateTopic(topic string) {
	if _, exists := s.topics.LoadOrStore(topic, &sync.Map{}); !exists {
		logger.Info("Created message topic", zap.String("topic", topic))
	}
}

func (s *MessageQueueService) Publish(topic string, content map[string]interface{}) string {
	return s.publishWithFlag(topic, content, false)
}

func (s *MessageQueueService) PublishDuplicate(topic string, content map[string]interface{}) string {
	return s.publishWithFlag(topic, content, true)
}

func (s *MessageQueueService) publishWithFlag(topic string, content map[string]interface{}, isDuplicate bool) string {
	s.CreateTopic(topic)
	msgID := fmt.Sprintf("msg-%d", time.Now().UnixNano())

	msg := &Message{
		ID:          msgID,
		Topic:       topic,
		Content:     content,
		Attempts:    0,
		IsDuplicate: isDuplicate,
	}

	messages, _ := s.topics.Load(topic)
	messages.(*sync.Map).Store(msgID, msg)

	if isDuplicate {
		logger.Debug("Duplicate message published",
			zap.String("topic", topic),
			zap.String("msg_id", msgID),
		)
	} else {
		logger.Debug("Message published", zap.String("topic", topic), zap.String("msg_id", msgID))
	}
	return msgID
}

func (s *MessageQueueService) Subscribe(topic string, consumerGroup string, handler func(msg *Message) error) {
	consumerKey := fmt.Sprintf("%s:%s", topic, consumerGroup)
	s.CreateTopic(topic)

	if _, exists := s.consumers.LoadOrStore(consumerKey, handler); !exists {
		logger.Info("Consumer subscribed", zap.String("topic", topic), zap.String("consumer_group", consumerGroup))
	}

	go s.consumerLoop(topic, consumerGroup, handler)
}

func (s *MessageQueueService) consumerLoop(topic, consumerGroup string, handler func(*Message) error) {
	consumerKey := fmt.Sprintf("%s:%s", topic, consumerGroup)

	for {
		messages, exists := s.topics.Load(topic)
		if !exists {
			time.Sleep(100 * time.Millisecond)
			continue
		}

		msgMap := messages.(*sync.Map)
		msgMap.Range(func(key, value interface{}) bool {
			msg := value.(*Message)
			if msg.Attempts > 0 {
				return true
			}

			if handler, ok := s.consumers.Load(consumerKey); ok {
				handlerFn := handler.(func(*Message) error)
				msg.Attempts++
				err := handlerFn(msg)

				if err != nil {
					logger.Warn("Message handling failed",
						zap.String("msg_id", msg.ID),
						zap.Int("attempts", msg.Attempts),
						zap.Error(err),
					)
				} else {
					msgMap.Delete(key)
					logger.Debug("Message consumed successfully", zap.String("msg_id", msg.ID))
				}
			}

			return true
		})

		time.Sleep(100 * time.Millisecond)
	}
}

type MQSimulationContext struct {
	simID      uint
	cancelFunc context.CancelFunc
}

func (s *MessageQueueService) StartSimulation(ctx context.Context, simID uint) error {
	_, span := tracing.Start(ctx, "mq.start_simulation")
	defer span.End()

	var sim models.MessageQueueSimulation
	if err := s.db.First(&sim, simID).Error; err != nil {
		span.RecordError(err)
		return err
	}

	now := time.Now()
	sim.Status = "running"
	sim.StartTime = &now
	s.db.Save(&sim)

	tracing.AddAttribute(span, "simulation_id", simID)
	tracing.AddAttribute(span, "topic", sim.Topic)
	tracing.AddAttribute(span, "total_messages", sim.TotalMessages)
	tracing.AddAttribute(span, "duplicate_rate", sim.DuplicateRate)

	simContext, cancel := context.WithCancel(context.Background())
	simCtx := &MQSimulationContext{
		simID:      simID,
		cancelFunc: cancel,
	}
	s.runningSimulations.Store(simID, simCtx)

	go s.runSimulation(simContext, &sim)
	return nil
}

type simulationStats struct {
	consumedCount  int64
	failedCount    int64
	duplicateCount int64
	expectedTotal  int64
	processedAll   chan struct{}
}

func (s *MessageQueueService) runSimulation(ctx context.Context, sim *models.MessageQueueSimulation) {
	logger.Info("Starting message queue simulation",
		zap.Uint("sim_id", sim.ID),
		zap.String("topic", sim.Topic),
		zap.Int("total_messages", sim.TotalMessages),
		zap.Float64("duplicate_rate", sim.DuplicateRate),
		zap.Int("delay_ms", sim.DelayMs),
		zap.Float64("error_rate", sim.ErrorRate),
	)

	s.CreateTopic(sim.Topic)

	var stats simulationStats
	stats.processedAll = make(chan struct{}, 1)

	r := rand.New(rand.NewSource(time.Now().UnixNano()))

	var publishWg sync.WaitGroup
	var duplicateEstimate int64

	for i := 0; i < sim.TotalMessages; i++ {
		select {
		case <-ctx.Done():
			goto waitForConsumers
		default:
		}

		publishWg.Add(1)
		go func(idx int) {
			defer publishWg.Done()

			msgContent := make(map[string]interface{})
			for k, v := range sim.MessageContent {
				msgContent[k] = v
			}
			msgContent["message_index"] = idx
			msgContent["sent_at"] = time.Now().Format(time.RFC3339)

			s.Publish(sim.Topic, msgContent)
			atomic.AddInt64(&stats.expectedTotal, 1)

			if sim.DuplicateRate > 0 && r.Float64() < sim.DuplicateRate {
				time.Sleep(time.Duration(sim.DelayMs/2) * time.Millisecond)
				s.PublishDuplicate(sim.Topic, msgContent)
				atomic.AddInt64(&stats.expectedTotal, 1)
				atomic.AddInt64(&duplicateEstimate, 1)
				logger.Debug("Duplicate message sent", zap.Int("message_index", idx))
			}
		}(i)
	}

	publishWg.Wait()
	logger.Info("All messages published",
		zap.Int64("expected_total", stats.expectedTotal),
		zap.Int64("estimated_duplicates", duplicateEstimate),
	)

waitForConsumers:
	consumerKey := fmt.Sprintf("%s:%s", sim.Topic, sim.ConsumerGroup)
	if _, exists := s.consumers.Load(consumerKey); !exists {
		s.startSimulationConsumer(sim, &stats)
	}

	waitTimeout := time.After(5 * time.Minute)
	checkInterval := time.NewTicker(100 * time.Millisecond)
	defer checkInterval.Stop()

	for {
		select {
		case <-ctx.Done():
			logger.Info("Simulation cancelled", zap.Uint("sim_id", sim.ID))
			goto finish
		case <-waitTimeout:
			logger.Warn("Simulation timed out waiting for consumers",
				zap.Uint("sim_id", sim.ID),
				zap.Int64("consumed", atomic.LoadInt64(&stats.consumedCount)),
				zap.Int64("expected", stats.expectedTotal),
			)
			goto finish
		case <-checkInterval.C:
			consumed := atomic.LoadInt64(&stats.consumedCount)
			failed := atomic.LoadInt64(&stats.failedCount)
			totalProcessed := consumed + failed

			topicEmpty := s.isTopicEmpty(sim.Topic)

			if totalProcessed >= stats.expectedTotal && topicEmpty {
				logger.Info("All messages consumed",
					zap.Int64("consumed", consumed),
					zap.Int64("failed", failed),
					zap.Int64("expected", stats.expectedTotal),
				)
				goto finish
			}
		}
	}

finish:
	s.finishSimulation(
		sim,
		atomic.LoadInt64(&stats.consumedCount),
		atomic.LoadInt64(&stats.failedCount),
		atomic.LoadInt64(&stats.duplicateCount),
	)
}

func (s *MessageQueueService) startSimulationConsumer(sim *models.MessageQueueSimulation, stats *simulationStats) {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	consumerKey := fmt.Sprintf("%s:%s", sim.Topic, sim.ConsumerGroup)

	handler := func(msg *Message) error {
		if sim.DelayMs > 0 {
			time.Sleep(time.Duration(sim.DelayMs) * time.Millisecond)
		}

		if r.Float64() < sim.ErrorRate {
			atomic.AddInt64(&stats.failedCount, 1)
			return fmt.Errorf("simulated error processing message")
		}

		if msg.IsDuplicate {
			atomic.AddInt64(&stats.duplicateCount, 1)
		}
		atomic.AddInt64(&stats.consumedCount, 1)
		return nil
	}

	s.consumers.Store(consumerKey, handler)
	logger.Info("Simulation consumer started",
		zap.String("topic", sim.Topic),
		zap.String("consumer_group", sim.ConsumerGroup),
	)

	go s.simulationConsumerLoop(sim.Topic, consumerKey, stats)
}

func (s *MessageQueueService) simulationConsumerLoop(topic, consumerKey string, stats *simulationStats) {
	for {
		messages, exists := s.topics.Load(topic)
		if !exists {
			time.Sleep(50 * time.Millisecond)
			continue
		}

		msgMap := messages.(*sync.Map)
		hasMessages := false

		msgMap.Range(func(key, value interface{}) bool {
			msg := value.(*Message)
			if msg.Attempts > 0 {
				return true
			}
			hasMessages = true

			if handler, ok := s.consumers.Load(consumerKey); ok {
				handlerFn := handler.(func(*Message) error)
				msg.Attempts++
				err := handlerFn(msg)

				if err != nil {
					logger.Debug("Message handling failed",
						zap.String("msg_id", msg.ID),
						zap.Int("attempts", msg.Attempts),
					)
				} else {
					msgMap.Delete(key)
					logger.Debug("Message consumed", zap.String("msg_id", msg.ID))
				}
			}

			return true
		})

		if !hasMessages {
			time.Sleep(50 * time.Millisecond)
		} else {
			time.Sleep(10 * time.Millisecond)
		}
	}
}

func (s *MessageQueueService) isTopicEmpty(topic string) bool {
	messages, exists := s.topics.Load(topic)
	if !exists {
		return true
	}

	msgMap := messages.(*sync.Map)
	hasUnprocessed := false

	msgMap.Range(func(key, value interface{}) bool {
		msg := value.(*Message)
		if msg.Attempts == 0 {
			hasUnprocessed = true
			return false
		}
		return true
	})

	return !hasUnprocessed
}

func (s *MessageQueueService) finishSimulation(
	sim *models.MessageQueueSimulation,
	consumed, failed, duplicate int64,
) {
	now := time.Now()
	sim.Status = "completed"
	sim.EndTime = &now
	sim.ConsumedCount = int(consumed)
	sim.FailedCount = int(failed)
	sim.DuplicateCount = int(duplicate)

	s.db.Save(sim)

	logger.Info("Message queue simulation completed",
		zap.Uint("sim_id", sim.ID),
		zap.Int("consumed_count", sim.ConsumedCount),
		zap.Int("failed_count", sim.FailedCount),
		zap.Int("duplicate_count", sim.DuplicateCount),
	)
}

func (s *MessageQueueService) StopSimulation(ctx context.Context, simID uint) error {
	simCtxVal, ok := s.runningSimulations.Load(simID)
	if !ok {
		return fmt.Errorf("simulation not running")
	}

	if simCtx, ok := simCtxVal.(*MQSimulationContext); ok {
		simCtx.cancelFunc()
		s.runningSimulations.Delete(simID)
	}

	var sim models.MessageQueueSimulation
	s.db.First(&sim, simID)
	now := time.Now()
	sim.Status = "stopped"
	sim.EndTime = &now
	s.db.Save(&sim)

	logger.Info("Message queue simulation stopped", zap.Uint("sim_id", simID))
	return nil
}

func (s *MessageQueueService) GetSimulation(ctx context.Context, simID uint) (*models.MessageQueueSimulation, error) {
	_, span := tracing.Start(ctx, "mq.get_simulation")
	defer span.End()

	var sim models.MessageQueueSimulation
	if err := s.db.First(&sim, simID).Error; err != nil {
		return nil, err
	}
	return &sim, nil
}

func (s *MessageQueueService) ListSimulations(ctx context.Context, page, pageSize int) ([]models.MessageQueueSimulation, int64, error) {
	_, span := tracing.Start(ctx, "mq.list_simulations")
	defer span.End()

	var sims []models.MessageQueueSimulation
	var total int64

	if err := s.db.Model(&models.MessageQueueSimulation{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := s.db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&sims).Error; err != nil {
		return nil, 0, err
	}

	return sims, total, nil
}

func (s *MessageQueueService) CreateSimulation(ctx context.Context, sim *models.MessageQueueSimulation) error {
	_, span := tracing.Start(ctx, "mq.create_simulation")
	defer span.End()

	if err := s.db.Create(sim).Error; err != nil {
		return err
	}
	tracing.AddAttribute(span, "simulation_id", sim.ID)
	return nil
}
