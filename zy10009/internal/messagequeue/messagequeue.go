package messagequeue

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"time"

	"chaos-demo/internal/types"
)

type Message struct {
	ID        string
	Payload   []byte
	Timestamp time.Time
	RetryCount int
	MaxRetries int
}

type MessageQueue struct {
	pendingChan    chan Message
	processingChan chan Message
	failedChan     chan Message
	handlers       map[string]func(Message) error
	handlersMu     sync.RWMutex
	running        bool
	runningMu      sync.RWMutex

	pendingCount    int64
	processingCount int64
	failedCount     int64
	totalProcessed  int64

	maxBacklog     int
	backlogThrottle bool
	backlogThrottleMu sync.RWMutex
}

func NewMessageQueue(maxBacklog int) *MessageQueue {
	if maxBacklog <= 0 {
		maxBacklog = 10000
	}
	return &MessageQueue{
		pendingChan:    make(chan Message, maxBacklog),
		processingChan: make(chan Message, maxBacklog),
		failedChan:     make(chan Message, 1000),
		handlers:       make(map[string]func(Message) error),
		maxBacklog:     maxBacklog,
	}
}

func (mq *MessageQueue) Publish(topic string, payload []byte) error {
	if mq.IsBacklogThrottled() {
		return errors.New("message queue backlog throttled")
	}

	msg := Message{
		ID:        generateID(),
		Payload:   payload,
		Timestamp: time.Now(),
		MaxRetries: 3,
	}

	select {
	case mq.pendingChan <- msg:
		atomic.AddInt64(&mq.pendingCount, 1)
		return nil
	default:
		return errors.New("message queue full")
	}
}

func (mq *MessageQueue) Subscribe(topic string, handler func(Message) error) {
	mq.handlersMu.Lock()
	mq.handlers[topic] = handler
	mq.handlersMu.Unlock()
}

func (mq *MessageQueue) Start(ctx context.Context) {
	mq.runningMu.Lock()
	mq.running = true
	mq.runningMu.Unlock()

	go mq.processLoop(ctx)
}

func (mq *MessageQueue) Stop() {
	mq.runningMu.Lock()
	mq.running = false
	mq.runningMu.Unlock()
}

func (mq *MessageQueue) processLoop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-mq.pendingChan:
			atomic.AddInt64(&mq.pendingCount, -1)
			atomic.AddInt64(&mq.processingCount, 1)

			mq.processMessage(ctx, msg)

			atomic.AddInt64(&mq.processingCount, -1)
			atomic.AddInt64(&mq.totalProcessed, 1)
		}
	}
}

func (mq *MessageQueue) processMessage(ctx context.Context, msg Message) {
	mq.handlersMu.RLock()
	handler := mq.handlers["default"]
	mq.handlersMu.RUnlock()

	if handler == nil {
		return
	}

	err := handler(msg)
	if err != nil {
		msg.RetryCount++
		if msg.RetryCount < msg.MaxRetries {
			delay := time.Duration(msg.RetryCount) * time.Second
			time.Sleep(delay)
			select {
			case mq.pendingChan <- msg:
				atomic.AddInt64(&mq.pendingCount, 1)
			default:
				mq.failedChan <- msg
				atomic.AddInt64(&mq.failedCount, 1)
			}
		} else {
			mq.failedChan <- msg
			atomic.AddInt64(&mq.failedCount, 1)
		}
	}
}

func (mq *MessageQueue) GetState() types.MessageQueueState {
	pending := atomic.LoadInt64(&mq.pendingCount)
	processing := atomic.LoadInt64(&mq.processingCount)
	failed := atomic.LoadInt64(&mq.failedCount)
	total := atomic.LoadInt64(&mq.totalProcessed)

	backlogPressure := float64(pending) / float64(mq.maxBacklog)
	if backlogPressure > 1.0 {
		backlogPressure = 1.0
	}

	return types.MessageQueueState{
		PendingCount:    int(pending),
		ProcessingCount: int(processing),
		FailedCount:     int(failed),
		TotalProcessed:  total,
		BacklogPressure: backlogPressure,
	}
}

func (mq *MessageQueue) SetBacklogThrottle(enabled bool) {
	mq.backlogThrottleMu.Lock()
	mq.backlogThrottle = enabled
	mq.backlogThrottleMu.Unlock()
}

func (mq *MessageQueue) IsBacklogThrottled() bool {
	mq.backlogThrottleMu.RLock()
	defer mq.backlogThrottleMu.RUnlock()
	return mq.backlogThrottle
}

func (mq *MessageQueue) GetMaxBacklog() int {
	return mq.maxBacklog
}

func (mq *MessageQueue) GetPendingCount() int64 {
	return atomic.LoadInt64(&mq.pendingCount)
}

func (mq *MessageQueue) GetProcessingCount() int64 {
	return atomic.LoadInt64(&mq.processingCount)
}

func (mq *MessageQueue) GetFailedCount() int64 {
	return atomic.LoadInt64(&mq.failedCount)
}

func (mq *MessageQueue) GetTotalProcessed() int64 {
	return atomic.LoadInt64(&mq.totalProcessed)
}

func generateID() string {
	return time.Now().Format("20060102150405") + "-" + randomString(8)
}

func randomString(n int) string {
	const letterBytes = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
	b := make([]byte, n)
	for i := range b {
		b[i] = letterBytes[time.Now().UnixNano()%int64(len(letterBytes))]
	}
	return string(b)
}
