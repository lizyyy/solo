package queue

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/streadway/amqp"
	"go.uber.org/zap"

	"migration-chaos-simulator/internal/config"
	"migration-chaos-simulator/internal/logger"
)

type RabbitMQClient struct {
	conn    *amqp.Connection
	channel *amqp.Channel
	cfg     config.RabbitMQConfig
	mu      sync.RWMutex
	closed  bool
}

type Message struct {
	ID        string
	Body      []byte
	Headers   map[string]interface{}
	Timestamp time.Time
	RetryCount int
}

type Handler func(ctx context.Context, msg *Message) error

var (
	clientInstance *RabbitMQClient
	clientOnce     sync.Once
)

func GetClient(cfg config.RabbitMQConfig) (*RabbitMQClient, error) {
	var err error
	clientOnce.Do(func() {
		clientInstance, err = newClient(cfg)
	})
	if err != nil {
		return nil, err
	}
	return clientInstance, nil
}

func newClient(cfg config.RabbitMQConfig) (*RabbitMQClient, error) {
	client := &RabbitMQClient{
		cfg: cfg,
	}

	if err := client.connect(); err != nil {
		return nil, err
	}

	return client, nil
}

func (c *RabbitMQClient) connect() error {
	var conn *amqp.Connection
	var err error

	for i := 0; i < c.cfg.ReconnectAttempts; i++ {
		conn, err = amqp.Dial(c.cfg.URL())
		if err == nil {
			break
		}
		logger.Warn("Failed to connect to RabbitMQ, retrying...",
			zap.Int("attempt", i+1),
			zap.Error(err),
		)
		time.Sleep(c.cfg.ReconnectDelay)
	}

	if err != nil {
		return fmt.Errorf("failed to connect to RabbitMQ after %d attempts: %w",
			c.cfg.ReconnectAttempts, err)
	}

	channel, err := conn.Channel()
	if err != nil {
		conn.Close()
		return fmt.Errorf("failed to create channel: %w", err)
	}

	c.mu.Lock()
	c.conn = conn
	c.channel = channel
	c.mu.Unlock()

	logger.Info("RabbitMQ client connected",
		zap.String("host", c.cfg.Host),
	)

	return nil
}

func (c *RabbitMQClient) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return nil
	}
	c.closed = true

	var errs []error
	if c.channel != nil {
		if err := c.channel.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	if c.conn != nil {
		if err := c.conn.Close(); err != nil {
			errs = append(errs, err)
		}
	}

	logger.Info("RabbitMQ client closed")

	if len(errs) > 0 {
		return fmt.Errorf("errors while closing: %v", errs)
	}
	return nil
}

func (c *RabbitMQClient) DeclareExchange(name, kind string, durable, autoDelete bool) error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return c.channel.ExchangeDeclare(
		name,
		kind,
		durable,
		autoDelete,
		false,
		false,
		nil,
	)
}

func (c *RabbitMQClient) DeclareQueue(name string, durable, autoDelete, exclusive bool) (string, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	q, err := c.channel.QueueDeclare(
		name,
		durable,
		autoDelete,
		exclusive,
		false,
		nil,
	)
	if err != nil {
		return "", err
	}
	return q.Name, nil
}

func (c *RabbitMQClient) BindQueue(queue, routingKey, exchange string) error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return c.channel.QueueBind(
		queue,
		routingKey,
		exchange,
		false,
		nil,
	)
}

func (c *RabbitMQClient) Publish(ctx context.Context, exchange, routingKey string, msg *Message) error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.channel == nil || c.channel.IsClosed() {
		return fmt.Errorf("channel is closed")
	}

	return c.channel.PublishWithContext(
		ctx,
		exchange,
		routingKey,
		false,
		false,
		amqp.Publishing{
			MessageId:    msg.ID,
			ContentType:  "application/json",
			Body:         msg.Body,
			Headers:      msg.Headers,
			Timestamp:    msg.Timestamp,
			DeliveryMode: amqp.Persistent,
		},
	)
}

func (c *RabbitMQClient) Consume(ctx context.Context, queue string, handler Handler) error {
	c.mu.RLock()
	if c.channel == nil {
		c.mu.RUnlock()
		return fmt.Errorf("channel is nil")
	}
	c.mu.RUnlock()

	deliveries, err := c.channel.Consume(
		queue,
		"",
		false,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to start consumer: %w", err)
	}

	go func() {
		for {
			select {
			case <-ctx.Done():
				logger.Info("Consumer stopped due to context cancellation")
				return
			case d, ok := <-deliveries:
				if !ok {
					logger.Warn("Delivery channel closed")
					return
				}

				msg := &Message{
					ID:        d.MessageId,
					Body:      d.Body,
					Headers:   d.Headers,
					Timestamp: d.Timestamp,
				}

				if retryCount, ok := d.Headers["x-retry-count"].(int); ok {
					msg.RetryCount = retryCount
				}

				if err := handler(ctx, msg); err != nil {
					logger.Error("Message handler error",
						zap.String("msg_id", msg.ID),
						zap.Error(err),
					)
					d.Nack(false, true)
				} else {
					d.Ack(false)
				}
			}
		}
	}()

	return nil
}

func (c *RabbitMQClient) GetChannel() *amqp.Channel {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.channel
}
