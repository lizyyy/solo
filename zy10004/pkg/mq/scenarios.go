package mq

import (
	"context"
	"fmt"
	"time"

	"github.com/chaos-simulator/chaos-simulator/internal/utils"
	"go.uber.org/zap"
)

type MQScenario string

const (
	ScenarioNormal         MQScenario = "normal"
	ScenarioDuplicate      MQScenario = "duplicate"
	ScenarioSlowConsumer   MQScenario = "slow_consumer"
	ScenarioMessageLoss    MQScenario = "message_loss"
	ScenarioHighRetry      MQScenario = "high_retry"
	ScenarioDLQOverflow    MQScenario = "dlq_overflow"
)

type ScenarioManager struct {
	client *RabbitMQClient
}

func NewScenarioManager(client *RabbitMQClient) *ScenarioManager {
	return &ScenarioManager{client: client}
}

func (s *ScenarioManager) ApplyScenario(scenario MQScenario, queueName string) error {
	utils.GetLogger().Info("Applying MQ chaos scenario",
		zap.String("scenario", string(scenario)),
		zap.String("queue", queueName))

	switch scenario {
	case ScenarioNormal:
		return s.applyNormal(queueName)
	case ScenarioDuplicate:
		return s.applyDuplicate(queueName)
	case ScenarioSlowConsumer:
		return s.applySlowConsumer(queueName)
	case ScenarioMessageLoss:
		return s.applyMessageLoss(queueName)
	case ScenarioHighRetry:
		return s.applyHighRetry(queueName)
	case ScenarioDLQOverflow:
		return s.applyDLQOverflow(queueName)
	default:
		return fmt.Errorf("unknown scenario: %s", scenario)
	}
}

func (s *ScenarioManager) applyNormal(queueName string) error {
	s.client.SetGlobalChaos(ChaosMQConfig{Enabled: false})
	return nil
}

func (s *ScenarioManager) applyDuplicate(queueName string) error {
	config := ChaosMQConfig{
		Enabled:        true,
		DuplicateCount: 3,
		DuplicateDelay: 100 * time.Millisecond,
	}
	s.client.SetGlobalChaos(config)
	utils.GetLogger().Warn("Duplicate message scenario activated - messages will be duplicated",
		zap.Int("duplicate_count", 3))
	return nil
}

func (s *ScenarioManager) applySlowConsumer(queueName string) error {
	config := ChaosMQConfig{
		Enabled: true,
		DelayMS: 2000,
	}
	s.client.SetGlobalChaos(config)
	utils.GetLogger().Warn("Slow consumer scenario activated - consumer processing delayed",
		zap.Int("delay_ms", 2000))
	return nil
}

func (s *ScenarioManager) applyMessageLoss(queueName string) error {
	config := ChaosMQConfig{
		Enabled:  true,
		LoseRate: 0.3,
	}
	s.client.SetGlobalChaos(config)
	utils.GetLogger().Warn("Message loss scenario activated - 30% messages will be lost",
		zap.Float64("lose_rate", 0.3))
	return nil
}

func (s *ScenarioManager) applyHighRetry(queueName string) error {
	config := ChaosMQConfig{
		Enabled:    true,
		RejectRate: 0.5,
	}
	s.client.SetGlobalChaos(config)
	utils.GetLogger().Warn("High retry scenario activated - 50% messages will be rejected for retry",
		zap.Float64("reject_rate", 0.5))
	return nil
}

func (s *ScenarioManager) applyDLQOverflow(queueName string) error {
	config := ChaosMQConfig{
		Enabled:    true,
		RejectRate: 1.0,
	}
	s.client.SetGlobalChaos(config)
	utils.GetLogger().Warn("DLQ overflow scenario activated - all messages will go to DLQ")
	return nil
}

func (s *ScenarioManager) PublishTestMessages(ctx context.Context, routingKey string, count int, payload interface{}) error {
	utils.GetLogger().Info("Publishing test messages",
		zap.Int("count", count),
		zap.String("routing_key", routingKey))

	for i := 0; i < count; i++ {
		traceID := utils.NewTraceID()
		msg, err := NewMessage(traceID, "test", payload)
		if err != nil {
			return err
		}

		msg.Metadata["test_index"] = fmt.Sprintf("%d", i)
		msg.MaxRetries = 5

		if err := s.client.Publish(ctx, routingKey, msg); err != nil {
			utils.GetLogger().Error("Failed to publish test message",
				zap.Int("index", i),
				zap.Error(err))
			continue
		}

		time.Sleep(10 * time.Millisecond)
	}

	return nil
}
