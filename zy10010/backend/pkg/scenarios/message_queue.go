package scenarios

import (
	"fmt"
	"math/rand"
	"sync"
	"time"

	"system-chaos-visualizer/backend/pkg/eventbus"
	"system-chaos-visualizer/backend/pkg/statemanager"
	"system-chaos-visualizer/backend/pkg/types"

	"github.com/google/uuid"
)

type MessageQueueScenario struct {
	mu           sync.Mutex
	sm           *statemanager.StateManager
	eb           *eventbus.EventBus
	messageQueue chan types.MessageState
	stopCh       chan struct{}
	running      bool
	lastSeq      int64
	expectedSeq  int64
}

func NewMessageQueueScenario(sm *statemanager.StateManager, eb *eventbus.EventBus) *MessageQueueScenario {
	return &MessageQueueScenario{
		sm:           sm,
		eb:           eb,
		messageQueue: make(chan types.MessageState, 100),
		stopCh:       make(chan struct{}),
	}
}

func (s *MessageQueueScenario) Start(backlogSize int, duration time.Duration) {
	s.mu.Lock()
	s.running = true
	s.lastSeq = 0
	s.expectedSeq = 0
	s.mu.Unlock()

	go s.producerLoop(backlogSize, duration)
	go s.consumerLoop(duration)
}

func (s *MessageQueueScenario) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.running {
		close(s.stopCh)
		s.stopCh = make(chan struct{})
		s.running = false
		close(s.messageQueue)
		s.messageQueue = make(chan types.MessageState, 100)
	}
}

func (s *MessageQueueScenario) producerLoop(backlogSize int, duration time.Duration) {
	endTime := time.Now().Add(duration)
	for time.Now().Before(endTime) {
		select {
		case <-s.stopCh:
			return
		default:
			if rand.Float64() < 0.8 {
				s.sendMessage(backlogSize)
			}
			time.Sleep(time.Duration(rand.Intn(50)) * time.Millisecond)
		}
	}
}

func (s *MessageQueueScenario) consumerLoop(duration time.Duration) {
	endTime := time.Now().Add(duration)
	for time.Now().Before(endTime) {
		select {
		case <-s.stopCh:
			return
		case msg, ok := <-s.messageQueue:
			if !ok {
				return
			}
			s.processMessage(msg)
			time.Sleep(time.Duration(rand.Intn(100)) * time.Millisecond)
		}
	}
}

func (s *MessageQueueScenario) sendMessage(backlogSize int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.messageQueue) >= backlogSize {
		s.eb.Publish(types.Event{
			Type:     types.EventTypeMessageQueued,
			Severity: types.SeverityWarning,
			Source:   "message_queue",
			Message:  "Message queue backlog",
			Data: map[string]interface{}{
				"queue_size": len(s.messageQueue),
				"max_size":   backlogSize,
			},
		})
	}

	s.sm.UpdateMetrics(func(m *types.SystemMetrics) {
		m.MessageQueueSize = len(s.messageQueue)
	})

	s.lastSeq++
	msg := types.MessageState{
		ID:       uuid.New().String(),
		Content:  fmt.Sprintf("Message %d", s.lastSeq),
		Status:   "queued",
		Sequence: s.lastSeq,
		SentAt:   time.Now(),
	}

	if rand.Float64() < 0.3 {
		delay := time.Duration(rand.Intn(200)) * time.Millisecond
		time.Sleep(delay)
	}

	select {
	case s.messageQueue <- msg:
		s.eb.Publish(types.Event{
			Type:     types.EventTypeMessageSent,
			Severity: types.SeverityInfo,
			Source:   "message_queue",
			Message:  "Message sent",
			Data: map[string]interface{}{
				"message_id": msg.ID,
				"sequence":   msg.Sequence,
			},
		})
	default:
		s.eb.Publish(types.Event{
			Type:     types.EventTypeMessageQueued,
			Severity: types.SeverityError,
			Source:   "message_queue",
			Message:  "Message dropped due to queue full",
			Data: map[string]interface{}{
				"message_id": msg.ID,
				"sequence":   msg.Sequence,
			},
		})
	}
}

func (s *MessageQueueScenario) processMessage(msg types.MessageState) {
	s.mu.Lock()
	defer s.mu.Unlock()

	msg.ReceivedAt = time.Now()
	msg.Status = "processed"

	if s.expectedSeq == 0 {
		s.expectedSeq = msg.Sequence
	} else if msg.Sequence != s.expectedSeq+1 {
		s.eb.Publish(types.Event{
			Type:     types.EventTypeMessageOrderError,
			Severity: types.SeverityWarning,
			Source:   "message_queue",
			Message:  "Message out of order",
			Data: map[string]interface{}{
				"message_id":   msg.ID,
				"expected_seq": s.expectedSeq + 1,
				"actual_seq":   msg.Sequence,
			},
		})
	}
	s.expectedSeq = msg.Sequence

	msg.DelayMs = msg.ReceivedAt.Sub(msg.SentAt).Milliseconds()

	s.eb.Publish(types.Event{
		Type:     types.EventTypeMessageReceived,
		Severity: types.SeverityInfo,
		Source:   "message_queue",
		Message:  "Message processed",
		Data: map[string]interface{}{
			"message_id": msg.ID,
			"sequence":   msg.Sequence,
			"delay_ms":   msg.DelayMs,
		},
	})

	s.sm.AddMessage(msg)
	s.sm.UpdateMetrics(func(m *types.SystemMetrics) {
		m.MessageQueueSize = len(s.messageQueue)
	})
}
