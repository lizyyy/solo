package mq

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/chaos-simulator/chaos-simulator/internal/types"
	"github.com/chaos-simulator/chaos-simulator/internal/utils"
	"github.com/streadway/amqp"
	"go.uber.org/zap"
)

type RabbitMQConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	VHost    string
	Exchange string
}

type Message struct {
	ID          string            `json:"id"`
	TraceID     string            `json:"trace_id"`
	Type        string            `json:"type"`
	Payload     json.RawMessage   `json:"payload"`
	RetryCount  int               `json:"retry_count"`
	MaxRetries  int               `json:"max_retries"`
	CreatedAt   time.Time         `json:"created_at"`
	Metadata    map[string]string `json:"metadata"`
}

type ChaosMQConfig struct {
	Enabled         bool
	DuplicateCount  int
	DuplicateDelay  time.Duration
	LoseRate        float64
	DelayMS         int
	RejectRate      float64
}

type RabbitMQClient struct {
	config     RabbitMQConfig
	conn       *amqp.Connection
	channel    *amqp.Channel
	chaosConfig ChaosMQConfig
	exchange   string
	consumers  map[string]*Consumer
	mu         sync.RWMutex
}

type Consumer struct {
	queueName   string
	handler     func(context.Context, *Message) error
	chaosConfig ChaosMQConfig
	stopChan    chan struct{}
	running     bool
}

func NewRabbitMQClient(config RabbitMQConfig) (*RabbitMQClient, error) {
	client := &RabbitMQClient{
		config:    config,
		exchange:  config.Exchange,
		consumers: make(map[string]*Consumer),
	}

	if err := client.connect(); err != nil {
		return nil, err
	}

	return client, nil
}

func (c *RabbitMQClient) connect() error {
	url := fmt.Sprintf("amqp://%s:%s@%s:%d%s",
		c.config.Username, c.config.Password, c.config.Host, c.config.Port, c.config.VHost)

	conn, err := amqp.Dial(url)
	if err != nil {
		return fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return fmt.Errorf("failed to open channel: %w", err)
	}

	if err := ch.ExchangeDeclare(
		c.exchange,
		"direct",
		true,
		false,
		false,
		false,
		nil,
	); err != nil {
		ch.Close()
		conn.Close()
		return fmt.Errorf("failed to declare exchange: %w", err)
	}

	c.conn = conn
	c.channel = ch
	utils.GetLogger().Info("RabbitMQ connected successfully",
		zap.String("host", c.config.Host),
		zap.String("exchange", c.exchange))

	return nil
}

func (c *RabbitMQClient) DeclareQueue(queueName string, routingKey string) error {
	_, err := c.channel.QueueDeclare(
		queueName,
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to declare queue: %w", err)
	}

	err = c.channel.QueueBind(
		queueName,
		routingKey,
		c.exchange,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to bind queue: %w", err)
	}

	return nil
}

func (c *RabbitMQClient) DeclareDeadLetterQueue(queueName string, deadLetterQueue string) error {
	args := amqp.Table{
		"x-dead-letter-exchange":    c.exchange,
		"x-dead-letter-routing-key": "dead-letter",
	}

	_, err := c.channel.QueueDeclare(
		queueName,
		true,
		false,
		false,
		false,
		args,
	)
	if err != nil {
		return fmt.Errorf("failed to declare queue with DLQ: %w", err)
	}

	return nil
}

func (c *RabbitMQClient) SetGlobalChaos(config ChaosMQConfig) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.chaosConfig = config
}

func (c *RabbitMQClient) Publish(ctx context.Context, routingKey string, msg *Message) error {
	c.mu.RLock()
	chaosConfig := c.chaosConfig
	c.mu.RUnlock()

	if chaosConfig.Enabled {
		if err := c.applyPublishChaos(chaosConfig, msg); err != nil {
			return err
		}
	}

	body, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	err = c.channel.Publish(
		c.exchange,
		routingKey,
		false,
		false,
		amqp.Publishing{
			ContentType:  "application/json",
			Body:         body,
			DeliveryMode: amqp.Persistent,
			MessageId:    msg.ID,
			Timestamp:    msg.CreatedAt,
			Headers: amqp.Table{
				"x-trace-id":    msg.TraceID,
				"x-retry-count": msg.RetryCount,
				"x-max-retries": msg.MaxRetries,
			},
		},
	)

	if err != nil {
		return fmt.Errorf("failed to publish message: %w", err)
	}

	utils.WithTraceID(msg.TraceID).Info("Message published",
		zap.String("message_id", msg.ID),
		zap.String("routing_key", routingKey),
		zap.String("type", msg.Type),
		zap.Int("retry_count", msg.RetryCount))

	return nil
}

func (c *RabbitMQClient) applyPublishChaos(config ChaosMQConfig, msg *Message) error {
	if config.DelayMS > 0 {
		utils.GetLogger().Warn("MQ publish delay chaos", zap.Int("delay_ms", config.DelayMS))
		time.Sleep(time.Duration(config.DelayMS) * time.Millisecond)
	}

	if config.LoseRate > 0 && shouldInject(config.LoseRate) {
		utils.GetLogger().Warn("MQ message lost chaos",
			zap.String("message_id", msg.ID),
			zap.Float64("lose_rate", config.LoseRate))
		return nil
	}

	return nil
}

func (c *RabbitMQClient) Consume(ctx context.Context, queueName string, handler func(context.Context, *Message) error, chaosConfig ChaosMQConfig) error {
	c.mu.Lock()
	if _, exists := c.consumers[queueName]; exists {
		c.mu.Unlock()
		return fmt.Errorf("consumer already exists for queue: %s", queueName)
	}

	consumer := &Consumer{
		queueName:   queueName,
		handler:     handler,
		chaosConfig: chaosConfig,
		stopChan:    make(chan struct{}),
		running:     true,
	}
	c.consumers[queueName] = consumer
	c.mu.Unlock()

	msgs, err := c.channel.Consume(
		queueName,
		fmt.Sprintf("consumer-%s", queueName),
		false,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to start consumer: %w", err)
	}

	utils.GetLogger().Info("Started consuming from queue", zap.String("queue", queueName))

	go func() {
		for {
			select {
			case <-consumer.stopChan:
				utils.GetLogger().Info("Consumer stopped", zap.String("queue", queueName))
				return
			case <-ctx.Done():
				return
			case delivery, ok := <-msgs:
				if !ok {
					utils.GetLogger().Warn("Message channel closed", zap.String("queue", queueName))
					return
				}

				c.processDelivery(ctx, consumer, delivery)
			}
		}
	}()

	return nil
}

func (c *RabbitMQClient) processDelivery(ctx context.Context, consumer *Consumer, delivery amqp.Delivery) {
	var msg Message
	if err := json.Unmarshal(delivery.Body, &msg); err != nil {
		utils.GetLogger().Error("Failed to unmarshal message", zap.Error(err))
		delivery.Nack(false, false)
		return
	}

	logger := utils.WithTraceID(msg.TraceID)
	logger.Info("Received message",
		zap.String("message_id", msg.ID),
		zap.String("queue", consumer.queueName),
		zap.Int("retry_count", msg.RetryCount))

	if consumer.chaosConfig.Enabled {
		if err := c.applyConsumeChaos(consumer.chaosConfig, &msg); err != nil {
			logger.Warn("Chaos injection during consume", zap.Error(err))
			msg.RetryCount++
			if msg.RetryCount < msg.MaxRetries {
				delivery.Nack(false, true)
				return
			}
			delivery.Nack(false, false)
			return
		}
	}

	err := consumer.handler(ctx, &msg)
	if err != nil {
		logger.Error("Message handler failed",
			zap.Error(err),
			zap.Int("retry_count", msg.RetryCount))

		msg.RetryCount++
		if msg.RetryCount < msg.MaxRetries {
			logger.Warn("Retrying message",
				zap.Int("retry_count", msg.RetryCount),
				zap.Int("max_retries", msg.MaxRetries))
			delivery.Nack(false, true)
			return
		}

		logger.Error("Max retries exceeded, sending to DLQ")
		delivery.Nack(false, false)
		return
	}

	delivery.Ack(false)
	logger.Info("Message processed successfully")
}

func (c *RabbitMQClient) applyConsumeChaos(config ChaosMQConfig, msg *Message) error {
	if config.DelayMS > 0 {
		utils.GetLogger().Warn("MQ consume delay chaos", zap.Int("delay_ms", config.DelayMS))
		time.Sleep(time.Duration(config.DelayMS) * time.Millisecond)
	}

	if config.RejectRate > 0 && shouldInject(config.RejectRate) {
		utils.GetLogger().Warn("MQ message reject chaos",
			zap.String("message_id", msg.ID),
			zap.Float64("reject_rate", config.RejectRate))
		return errors.New("simulated message rejection")
	}

	if config.DuplicateCount > 0 {
		utils.GetLogger().Warn("MQ duplicate message chaos",
			zap.String("message_id", msg.ID),
			zap.Int("duplicate_count", config.DuplicateCount))
	}

	return nil
}

func (c *RabbitMQClient) StopConsumer(queueName string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if consumer, exists := c.consumers[queueName]; exists && consumer.running {
		consumer.running = false
		close(consumer.stopChan)
		delete(c.consumers, queueName)
	}
}

func (c *RabbitMQClient) Close() error {
	c.mu.Lock()
	for _, consumer := range c.consumers {
		if consumer.running {
			consumer.running = false
			close(consumer.stopChan)
		}
	}
	c.consumers = make(map[string]*Consumer)
	c.mu.Unlock()

	if c.channel != nil {
		c.channel.Close()
	}
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}

func shouldInject(rate float64) bool {
	if rate <= 0 || rate > 1 {
		return false
	}
	return time.Now().UnixNano()%1000 < int64(rate*1000)
}

func NewMessage(traceID, msgType string, payload interface{}) (*Message, error) {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	return &Message{
		ID:         utils.NewUUID(),
		TraceID:    traceID,
		Type:       msgType,
		Payload:    payloadBytes,
		RetryCount: 0,
		MaxRetries: 3,
		CreatedAt:  time.Now(),
		Metadata:   make(map[string]string),
	}, nil
}

func (m *Message) ParsePayload(v interface{}) error {
	return json.Unmarshal(m.Payload, v)
}

type OrderMessagePayload struct {
	OrderID       string `json:"order_id"`
	UserID        string `json:"user_id"`
	TotalAmount   int64  `json:"total_amount"`
	PaymentMethod string `json:"payment_method"`
}

type PaymentMessagePayload struct {
	OrderID     string `json:"order_id"`
	PaymentID   string `json:"payment_id"`
	Amount      int64  `json:"amount"`
	Status      string `json:"status"`
}

type InventoryMessagePayload struct {
	OrderID     string              `json:"order_id"`
	OperationID string              `json:"operation_id"`
	Items       []types.StockItem   `json:"items"`
}
