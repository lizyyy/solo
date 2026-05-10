package mq

import (
	"context"
	"encoding/json"
	"time"

	"github.com/segmentio/kafka-go"

	"grayscale-simulator/internal/model"
	"grayscale-simulator/pkg/config"
	"grayscale-simulator/pkg/logger"
)

var writer *kafka.Writer
var reader *kafka.Reader

func InitProducer(cfg *config.KafkaConfig) error {
	logger.Infof("Initializing Kafka producer for brokers: %v", cfg.Brokers)

	writer = &kafka.Writer{
		Addr:         kafka.TCP(cfg.Brokers...),
		Topic:        cfg.Topic,
		Balancer:     &kafka.LeastBytes{},
		Async:        false,
		RequiredAcks: kafka.RequireAll,
	}

	logger.Info("Kafka producer initialized successfully")
	return nil
}

func InitConsumer(cfg *config.KafkaConfig) error {
	logger.Infof("Initializing Kafka consumer for brokers: %v, group: %s", cfg.Brokers, cfg.ConsumerGroup)

	reader = kafka.NewReader(kafka.ReaderConfig{
		Brokers:  cfg.Brokers,
		GroupID:  cfg.ConsumerGroup,
		Topic:    cfg.Topic,
		MaxBytes: 10e6,
	})

	logger.Info("Kafka consumer initialized successfully")
	return nil
}

func Close() {
	if writer != nil {
		writer.Close()
		logger.Info("Kafka producer closed")
	}
	if reader != nil {
		reader.Close()
		logger.Info("Kafka consumer closed")
	}
}

func IsConsumerReady() bool {
	return reader != nil
}

func IsProducerReady() bool {
	return writer != nil
}

func PublishEvent(ctx context.Context, event *model.GrayEvent) error {
	value, err := json.Marshal(event)
	if err != nil {
		return err
	}

	msg := kafka.Message{
		Key:   []byte(event.ServiceName),
		Value: value,
		Time:  time.Now(),
	}

	return writer.WriteMessages(ctx, msg)
}

func ConsumeEvent(ctx context.Context) (*model.GrayEvent, error) {
	msg, err := reader.ReadMessage(ctx)
	if err != nil {
		return nil, err
	}

	var event model.GrayEvent
	if err := json.Unmarshal(msg.Value, &event); err != nil {
		return nil, err
	}

	return &event, nil
}

func CommitOffset(ctx context.Context) error {
	// With kafka-go in group mode, offsets are auto-committed
	return nil
}
