package eventstore

import (
	"context"
	"encoding/json"
	"sync"
	"sync/atomic"
	"time"

	"github.com/redis/go-redis/v9"
	"chaos-demo/internal/types"
)

type EventStore struct {
	redisClient     *redis.Client
	eventChannel    chan types.Event
	listeners       map[string]chan types.Event
	listenersMu     sync.RWMutex
	sequenceCounter int64
	events          []types.Event
	eventsMu        sync.RWMutex
	maxEvents       int
}

func NewEventStore(redisClient *redis.Client) *EventStore {
	return &EventStore{
		redisClient:     redisClient,
		eventChannel:    make(chan types.Event, 10000),
		listeners:       make(map[string]chan types.Event),
		events:          make([]types.Event, 0, 10000),
		maxEvents:       100000,
	}
}

func (es *EventStore) Append(event types.Event) {
	event.Sequence = atomic.AddInt64(&es.sequenceCounter, 1)
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	es.eventsMu.Lock()
	if len(es.events) >= es.maxEvents {
		es.events = es.events[1:]
	}
	es.events = append(es.events, event)
	es.eventsMu.Unlock()

	eventJSON, _ := json.Marshal(event)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	es.redisClient.LPush(ctx, "events:list", eventJSON)
	es.redisClient.LTrim(ctx, "events:list", 0, int64(es.maxEvents-1))

	es.broadcast(event)

	select {
	case es.eventChannel <- event:
	default:
	}
}

func (es *EventStore) Subscribe(listenerID string) <-chan types.Event {
	ch := make(chan types.Event, 100)
	es.listenersMu.Lock()
	es.listeners[listenerID] = ch
	es.listenersMu.Unlock()
	return ch
}

func (es *EventStore) Unsubscribe(listenerID string) {
	es.listenersMu.Lock()
	if ch, exists := es.listeners[listenerID]; exists {
		close(ch)
		delete(es.listeners, listenerID)
	}
	es.listenersMu.Unlock()
}

func (es *EventStore) broadcast(event types.Event) {
	es.listenersMu.RLock()
	defer es.listenersMu.RUnlock()
	for _, ch := range es.listeners {
		select {
		case ch <- event:
		default:
		}
	}
}

func (es *EventStore) GetEvents(req types.TimelineRequest) (*types.TimelineResponse, error) {
	es.eventsMu.RLock()
	defer es.eventsMu.RUnlock()

	var filtered []types.Event
	for _, event := range es.events {
		match := true
		if req.StartTime != nil && event.Timestamp.Before(*req.StartTime) {
			match = false
		}
		if req.EndTime != nil && event.Timestamp.After(*req.EndTime) {
			match = false
		}
		if req.EventTypes != nil && len(req.EventTypes) > 0 {
			found := false
			for _, et := range req.EventTypes {
				if event.Type == et {
					found = true
					break
				}
			}
			if !found {
				match = false
			}
		}
		if req.OrderID != nil {
			if event.OrderID == nil || *event.OrderID != *req.OrderID {
				match = false
			}
		}
		if match {
			filtered = append(filtered, event)
		}
	}

	limit := req.Limit
	if limit <= 0 || limit > 1000 {
		limit = 100
	}

	offset := req.Offset
	if offset < 0 {
		offset = 0
	}

	end := offset + limit
	if end > len(filtered) {
		end = len(filtered)
	}

	result := filtered[offset:end]

	return &types.TimelineResponse{
		Events:     result,
		TotalCount: int64(len(filtered)),
		HasMore:    end < len(filtered),
	}, nil
}

func (es *EventStore) GetEventBySequence(sequence int64) (*types.Event, error) {
	es.eventsMu.RLock()
	defer es.eventsMu.RUnlock()

	for _, event := range es.events {
		if event.Sequence == sequence {
			return &event, nil
		}
	}
	return nil, nil
}

func (es *EventStore) GetAllEvents() []types.Event {
	es.eventsMu.RLock()
	defer es.eventsMu.RUnlock()

	result := make([]types.Event, len(es.events))
	copy(result, es.events)
	return result
}

func (es *EventStore) GetCurrentSequence() int64 {
	return atomic.LoadInt64(&es.sequenceCounter)
}

func (es *EventStore) Channel() <-chan types.Event {
	return es.eventChannel
}
