package eventbus

import (
	"sync"
	"time"

	"github.com/google/uuid"
	"system-chaos-visualizer/backend/pkg/types"
)

type EventBus struct {
	subscribers map[string]chan types.Event
	events      []types.Event
	mu          sync.RWMutex
	maxEvents   int
}

func NewEventBus() *EventBus {
	return &EventBus{
		subscribers: make(map[string]chan types.Event),
		events:      make([]types.Event, 0),
		maxEvents:   10000,
	}
}

func (eb *EventBus) Subscribe() (string, <-chan types.Event) {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	id := uuid.New().String()
	ch := make(chan types.Event, 100)
	eb.subscribers[id] = ch

	return id, ch
}

func (eb *EventBus) Unsubscribe(id string) {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	if ch, ok := eb.subscribers[id]; ok {
		close(ch)
		delete(eb.subscribers, id)
	}
}

func (eb *EventBus) Publish(event types.Event) {
	if event.ID == "" {
		event.ID = uuid.New().String()
	}
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	eb.mu.Lock()
	eb.events = append(eb.events, event)
	if len(eb.events) > eb.maxEvents {
		eb.events = eb.events[len(eb.events)-eb.maxEvents:]
	}
	subscribers := make(map[string]chan types.Event)
	for k, v := range eb.subscribers {
		subscribers[k] = v
	}
	eb.mu.Unlock()

	for _, ch := range subscribers {
		select {
		case ch <- event:
		default:
		}
	}
}

func (eb *EventBus) GetEvents(start, end time.Time) []types.Event {
	eb.mu.RLock()
	defer eb.mu.RUnlock()

	result := make([]types.Event, 0)
	for _, e := range eb.events {
		if !e.Timestamp.Before(start) && !e.Timestamp.After(end) {
			result = append(result, e)
		}
	}
	return result
}

func (eb *EventBus) GetAllEvents() []types.Event {
	eb.mu.RLock()
	defer eb.mu.RUnlock()

	result := make([]types.Event, len(eb.events))
	copy(result, eb.events)
	return result
}

func (eb *EventBus) Clear() {
	eb.mu.Lock()
	defer eb.mu.Unlock()
	eb.events = make([]types.Event, 0)
}
