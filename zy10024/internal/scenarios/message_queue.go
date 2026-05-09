package scenarios

import (
	"sync"
	"sync/atomic"
	"time"

	"chaos-simulator/internal/config"
	"chaos-simulator/pkg/models"
)

type Message struct {
	ID        int64
	Payload   string
	Timestamp time.Time
}

type MessageQueueScenario struct {
	*BaseScenario
	queue         chan Message
	queueSize     int64
	produced      int64
	consumed      int64
	producerWg    sync.WaitGroup
	consumerWg    sync.WaitGroup
	queueCapacity int
}

func NewMessageQueueScenario() *MessageQueueScenario {
	cfg := config.Get().Scenarios.MessageQueue
	return &MessageQueueScenario{
		BaseScenario:  NewBaseScenario("message_queue_backlog", models.ScenarioMessageQueue),
		queue:         make(chan Message, cfg.QueueCapacity),
		queueCapacity: cfg.QueueCapacity,
	}
}

func (s *MessageQueueScenario) Config() map[string]interface{} {
	cfg := config.Get().Scenarios.MessageQueue
	return map[string]interface{}{
		"producer_rate":  cfg.ProducerRate,
		"consumer_rate":  cfg.ConsumerRate,
		"queue_capacity": cfg.QueueCapacity,
	}
}

func (s *MessageQueueScenario) Start() error {
	s.SetStatus(models.StatusRunning)
	s.ResetStopChannel()
	s.ClearEvents()
	atomic.StoreInt64(&s.produced, 0)
	atomic.StoreInt64(&s.consumed, 0)
	atomic.StoreInt64(&s.queueSize, 0)

	s.queue = make(chan Message, s.queueCapacity)

	s.producerWg.Add(1)
	s.consumerWg.Add(1)

	go s.producer()
	go s.consumer()

	s.AddEvent(newEvent(s.Name(), models.LevelInfo, "Message queue backlog scenario started", map[string]interface{}{
		"producer_rate":  config.Get().Scenarios.MessageQueue.ProducerRate,
		"consumer_rate":  config.Get().Scenarios.MessageQueue.ConsumerRate,
		"capacity":       s.queueCapacity,
	}))

	return nil
}

func (s *MessageQueueScenario) producer() {
	defer s.producerWg.Done()
	cfg := config.Get().Scenarios.MessageQueue
	interval := time.Duration(1000/cfg.ProducerRate) * time.Millisecond
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	msgID := int64(0)

	for {
		select {
		case <-s.StopChannel():
			return
		case <-ticker.C:
			msg := Message{
				ID:        atomic.AddInt64(&msgID, 1),
				Payload:   "message_" + time.Now().Format("150405.000"),
				Timestamp: time.Now(),
			}

			select {
			case s.queue <- msg:
				atomic.AddInt64(&s.produced, 1)
				currentSize := atomic.AddInt64(&s.queueSize, 1)

				if currentSize%50 == 0 {
					utilization := float64(currentSize) / float64(s.queueCapacity) * 100
					level := models.LevelInfo
					if utilization > 80 {
						level = models.LevelWarn
					}
					if utilization > 95 {
						level = models.LevelError
					}

					s.AddEvent(newEvent(s.Name(), level, "Queue growth detected", map[string]interface{}{
						"queue_size":    currentSize,
						"capacity":      s.queueCapacity,
						"utilization":   utilization,
						"produced":      atomic.LoadInt64(&s.produced),
						"consumed":      atomic.LoadInt64(&s.consumed),
					}))
				}
			default:
				s.AddEvent(newEvent(s.Name(), models.LevelError, "Queue OVERFLOW! Message dropped", map[string]interface{}{
					"message_id":   msg.ID,
					"queue_size":   atomic.LoadInt64(&s.queueSize),
					"capacity":     s.queueCapacity,
				}))
			}
		}
	}
}

func (s *MessageQueueScenario) consumer() {
	defer s.consumerWg.Done()
	cfg := config.Get().Scenarios.MessageQueue
	interval := time.Duration(1000/cfg.ConsumerRate) * time.Millisecond
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-s.StopChannel():
			return
		case <-ticker.C:
			select {
			case <-s.queue:
				atomic.AddInt64(&s.consumed, 1)
				atomic.AddInt64(&s.queueSize, -1)
			default:
			}
		}
	}
}

func (s *MessageQueueScenario) Stop() error {
	if s.Status() == models.StatusRunning {
		close(s.StopChannel())
		s.producerWg.Wait()
		s.consumerWg.Wait()
		s.SetStatus(models.StatusReady)

		s.AddEvent(newEvent(s.Name(), models.LevelInfo, "Message queue scenario stopped", map[string]interface{}{
			"produced": atomic.LoadInt64(&s.produced),
			"consumed": atomic.LoadInt64(&s.consumed),
			"remaining": atomic.LoadInt64(&s.queueSize),
		}))
	}
	return nil
}

func (s *MessageQueueScenario) Recover() error {
	s.Stop()

	drained := 0
	for {
		select {
		case <-s.queue:
			drained++
			atomic.AddInt64(&s.queueSize, -1)
		default:
			goto drainComplete
		}
	}
drainComplete:

	s.AddEvent(newEvent(s.Name(), models.LevelInfo, "Message queue recovered", map[string]interface{}{
		"drained_messages": drained,
	}))

	s.SetStatus(models.StatusRecovered)
	time.Sleep(100 * time.Millisecond)
	s.SetStatus(models.StatusReady)
	return nil
}

func (s *MessageQueueScenario) CurrentState() models.SystemState {
	currentSize := atomic.LoadInt64(&s.queueSize)
	return models.SystemState{
		Timestamp:   time.Now(),
		QueueLength: int(currentSize),
		Metrics: map[string]interface{}{
			"produced": atomic.LoadInt64(&s.produced),
			"consumed": atomic.LoadInt64(&s.consumed),
			"capacity": s.queueCapacity,
			"backlog_ratio": float64(currentSize) / float64(s.queueCapacity),
		},
	}
}
