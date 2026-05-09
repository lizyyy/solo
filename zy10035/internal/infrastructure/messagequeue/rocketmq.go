package messagequeue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"mq-deadletter-review/internal/config"
	"mq-deadletter-review/pkg/errors"
	"mq-deadletter-review/pkg/logger"
)

type Message struct {
	Topic      string            `json:"topic"`
	Tag        string            `json:"tag"`
	Keys       string            `json:"keys"`
	Body       string            `json:"body"`
	Properties map[string]string `json:"properties"`
	DelayLevel int               `json:"delay_level"`
}

type ReceivedMessage struct {
	Topic         string
	Tag           string
	Keys          string
	MessageID     string
	OffsetMsgID   string
	QueueID       int32
	QueueOffset   int64
	Body          string
	Properties    map[string]string
	BornTimestamp int64
	StoreTimestamp int64
	ReconsumeTimes int32
}

type MessageHandler func(ctx context.Context, msg *ReceivedMessage) error

type RocketMQProducer interface {
	Send(ctx context.Context, msg *Message) (string, error)
	SendAsync(ctx context.Context, msg *Message, callback func(result string, err error))
	Close() error
}

type RocketMQConsumer interface {
	Subscribe(topic, expression string, handler MessageHandler) error
	Start() error
	Shutdown() error
}

type RocketMQClient struct {
	producer RocketMQProducer
	consumer RocketMQConsumer
	cfg      *config.RocketMQConfig
}

func NewRocketMQClient(cfg *config.RocketMQConfig) (*RocketMQClient, error) {
	logger.Info("Initializing RocketMQ client, namesrv: %s", cfg.NamesrvAddr)
	
	producer := NewMockProducer(cfg)
	consumer := NewMockConsumer(cfg)
	
	return &RocketMQClient{
		producer: producer,
		consumer: consumer,
		cfg:      cfg,
	}, nil
}

func (c *RocketMQClient) GetProducer() RocketMQProducer {
	return c.producer
}

func (c *RocketMQClient) GetConsumer() RocketMQConsumer {
	return c.consumer
}

func (c *RocketMQClient) Close() error {
	if c.producer != nil {
		if err := c.producer.Close(); err != nil {
			logger.Error("Failed to close producer: %v", err)
		}
	}
	if c.consumer != nil {
		if err := c.consumer.Shutdown(); err != nil {
			logger.Error("Failed to shutdown consumer: %v", err)
		}
	}
	return nil
}

type MockProducer struct {
	cfg     *config.RocketMQConfig
	running bool
}

func NewMockProducer(cfg *config.RocketMQConfig) *MockProducer {
	return &MockProducer{
		cfg:     cfg,
		running: true,
	}
}

func (p *MockProducer) Send(ctx context.Context, msg *Message) (string, error) {
	if !p.running {
		return "", errors.ErrMQOperationFailed("send", fmt.Errorf("producer not running"))
	}

	select {
	case <-ctx.Done():
		return "", ctx.Err()
	default:
	}

	messageID := fmt.Sprintf("MSG-%d", time.Now().UnixNano())
	
	logger.Info("[MockProducer] Send message, topic=%s, tag=%s, keys=%s, messageID=%s",
		msg.Topic, msg.Tag, msg.Keys, messageID)

	return messageID, nil
}

func (p *MockProducer) SendAsync(ctx context.Context, msg *Message, callback func(result string, err error)) {
	go func() {
		result, err := p.Send(ctx, msg)
		if callback != nil {
			callback(result, err)
		}
	}()
}

func (p *MockProducer) Close() error {
	p.running = false
	return nil
}

type MockConsumer struct {
	cfg       *config.RocketMQConfig
	handlers  map[string]MessageHandler
	running   bool
	stopChan  chan struct{}
}

func NewMockConsumer(cfg *config.RocketMQConfig) *MockConsumer {
	return &MockConsumer{
		cfg:      cfg,
		handlers: make(map[string]MessageHandler),
		running:  false,
		stopChan: make(chan struct{}),
	}
}

func (c *MockConsumer) Subscribe(topic, expression string, handler MessageHandler) error {
	key := fmt.Sprintf("%s:%s", topic, expression)
	c.handlers[key] = handler
	logger.Info("[MockConsumer] Subscribed to topic=%s, expression=%s", topic, expression)
	return nil
}

func (c *MockConsumer) Start() error {
	if c.running {
		return nil
	}
	c.running = true
	logger.Info("[MockConsumer] Consumer started")
	return nil
}

func (c *MockConsumer) Shutdown() error {
	if !c.running {
		return nil
	}
	c.running = false
	close(c.stopChan)
	logger.Info("[MockConsumer] Consumer shutdown")
	return nil
}

func (c *MockConsumer) SimulateMessage(topic string, msg *ReceivedMessage) error {
	key := fmt.Sprintf("%s:*", topic)
	if handler, exists := c.handlers[key]; exists {
		ctx := context.Background()
		return handler(ctx, msg)
	}
	
	key2 := fmt.Sprintf("%s:%s", topic, msg.Tag)
	if handler, exists := c.handlers[key2]; exists {
		ctx := context.Background()
		return handler(ctx, msg)
	}
	
	return fmt.Errorf("no handler found for topic=%s, tag=%s", topic, msg.Tag)
}

func MarshalMessage(msg *Message) (string, error) {
	data, err := json.Marshal(msg)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func UnmarshalMessage(data string) (*Message, error) {
	var msg Message
	err := json.Unmarshal([]byte(data), &msg)
	if err != nil {
		return nil, err
	}
	return &msg, nil
}
