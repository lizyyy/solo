package replay

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"chaos-demo/internal/eventstore"
	"chaos-demo/internal/types"
)

type ReplayService struct {
	eventStore *eventstore.EventStore

	isReplaying  bool
	replayingMu  sync.RWMutex
	currentSeq   int64
	replaySpeed  float64
	cancelFunc   context.CancelFunc
}

func NewReplayService(eventStore *eventstore.EventStore) *ReplayService {
	return &ReplayService{
		eventStore:  eventStore,
		isReplaying: false,
		replaySpeed: 1.0,
	}
}

func (rs *ReplayService) StartReplay(req types.ReplayRequest) error {
	rs.replayingMu.Lock()
	if rs.isReplaying {
		rs.replayingMu.Unlock()
		return nil
	}
	rs.isReplaying = true
	rs.replaySpeed = req.Speed
	if rs.replaySpeed <= 0 {
		rs.replaySpeed = 1.0
	}
	rs.replayingMu.Unlock()

	ctx, cancel := context.WithCancel(context.Background())
	rs.cancelFunc = cancel

	go rs.runReplay(ctx, req.StartSequence, req.EndSequence)

	return nil
}

func (rs *ReplayService) StopReplay() {
	rs.replayingMu.Lock()
	defer rs.replayingMu.Unlock()

	if rs.cancelFunc != nil {
		rs.cancelFunc()
		rs.cancelFunc = nil
	}
	rs.isReplaying = false
}

func (rs *ReplayService) IsReplaying() bool {
	rs.replayingMu.RLock()
	defer rs.replayingMu.RUnlock()
	return rs.isReplaying
}

func (rs *ReplayService) GetReplayProgress() int64 {
	rs.replayingMu.RLock()
	defer rs.replayingMu.RUnlock()
	return rs.currentSeq
}

func (rs *ReplayService) runReplay(ctx context.Context, startSeq, endSeq int64) {
	events := rs.eventStore.GetAllEvents()

	var eventsToReplay []types.Event
	for _, event := range events {
		if event.Sequence >= startSeq && (endSeq <= 0 || event.Sequence <= endSeq) {
			eventsToReplay = append(eventsToReplay, event)
		}
	}

	var lastTime *time.Time
	for i, event := range eventsToReplay {
		select {
		case <-ctx.Done():
			return
		default:
		}

		rs.replayingMu.Lock()
		rs.currentSeq = event.Sequence
		rs.replayingMu.Unlock()

		if lastTime != nil && rs.replaySpeed > 0 {
			delay := event.Timestamp.Sub(*lastTime)
			if delay > 0 {
				adjustedDelay := time.Duration(float64(delay) / rs.replaySpeed)
				select {
				case <-ctx.Done():
					return
				case <-time.After(adjustedDelay):
				}
			}
		}

		eventCopy := event
		eventCopy.Payload["is_replay"] = true
		eventCopy.Payload["replay_index"] = i + 1
		eventCopy.Payload["replay_total"] = len(eventsToReplay)
		rs.eventStore.Append(eventCopy)

		eventTime := event.Timestamp
		lastTime = &eventTime
	}

	rs.replayingMu.Lock()
	rs.isReplaying = false
	rs.replayingMu.Unlock()
}

func (rs *ReplayService) GetSystemStateAtSequence(sequence int64) (*types.SystemState, error) {
	events := rs.eventStore.GetAllEvents()

	state := &types.SystemState{
		Timestamp:     time.Now(),
		StockSnapshot: make(map[string]types.Stock),
		OrderSnapshot: make(map[string]types.Order),
		GoroutineCount: 0,
		CacheHits:     0,
		CacheMisses:   0,
		ActiveLocks:   0,
		ConfigVersion: 1,
	}

	for _, event := range events {
		if event.Sequence > sequence {
			break
		}

		state.Timestamp = event.Timestamp
		rs.applyEventToState(state, event)
	}

	return state, nil
}

func (rs *ReplayService) applyEventToState(state *types.SystemState, event types.Event) {
	switch event.Type {
	case types.EventTypeStockDeducted:
		if event.Status == types.EventStatusSuccess && event.ProductID != nil {
			stock := state.StockSnapshot[*event.ProductID]
			stock.ProductID = *event.ProductID
			if qty, ok := event.Payload["remaining"].(int); ok {
				stock.Quantity = qty + stock.Reserved
			}
			if ver, ok := event.Payload["version"].(int); ok {
				stock.Version = ver
			}
			stock.UpdatedAt = event.Timestamp
			state.StockSnapshot[*event.ProductID] = stock
		}

	case types.EventTypeStockRollback:
		if event.Status == types.EventStatusSuccess && event.ProductID != nil {
			stock := state.StockSnapshot[*event.ProductID]
			stock.ProductID = *event.ProductID
			if qty, ok := event.Payload["quantity"].(int); ok {
				if stock.Reserved >= qty {
					stock.Reserved -= qty
				}
			}
			if ver, ok := event.Payload["version"].(int); ok {
				stock.Version = ver
			}
			stock.UpdatedAt = event.Timestamp
			state.StockSnapshot[*event.ProductID] = stock
		}

	case types.EventTypeOrderCreated:
		if event.Status == types.EventStatusSuccess && event.OrderID != nil {
			order := state.OrderSnapshot[*event.OrderID]
			order.ID = *event.OrderID
			order.Status = types.OrderStatusCreated
			if pid, ok := event.Payload["product_id"].(string); ok {
				order.ProductID = pid
			}
			if qty, ok := event.Payload["quantity"].(int); ok {
				order.Quantity = qty
			}
			if amt, ok := event.Payload["amount"].(float64); ok {
				order.Amount = amt
			}
			order.CreatedAt = event.Timestamp
			order.UpdatedAt = event.Timestamp
			state.OrderSnapshot[*event.OrderID] = order
		}

	case types.EventTypeOrderFailed:
		if event.OrderID != nil {
			order := state.OrderSnapshot[*event.OrderID]
			order.ID = *event.OrderID
			order.Status = types.OrderStatusFailed
			if pid, ok := event.Payload["product_id"].(string); ok {
				order.ProductID = pid
			}
			if qty, ok := event.Payload["quantity"].(int); ok {
				order.Quantity = qty
			}
			order.UpdatedAt = event.Timestamp
			state.OrderSnapshot[*event.OrderID] = order
		}

	case types.EventTypeCompensationSuccess:
		if event.OrderID != nil {
			order := state.OrderSnapshot[*event.OrderID]
			order.ID = *event.OrderID
			order.Status = types.OrderStatusRolledBack
			order.UpdatedAt = event.Timestamp
			state.OrderSnapshot[*event.OrderID] = order
		}

	case types.EventTypeDBLockWait:
		state.ActiveLocks++

	case types.EventTypeGoroutineLeak:
		state.GoroutineCount++

	case types.EventTypeConfigDrift:
		if ver, ok := event.Payload["config_version"].(int); ok {
			state.ConfigVersion = ver
		}

	case types.EventTypeMessageBacklog:
		if pressure, ok := event.Payload["backlog_pressure"].(float64); ok {
			state.MessageQueue.BacklogPressure = pressure
		}

	case types.EventTypeConnectionPoolExhausted:
		state.ConnectionPool.WaitCount++
	}
}

func (rs *ReplayService) ExportEvents(events []types.Event) ([]byte, error) {
	return json.MarshalIndent(events, "", "  ")
}

func (rs *ReplayService) GetEventStats() map[string]int {
	events := rs.eventStore.GetAllEvents()
	stats := make(map[string]int)

	for _, event := range events {
		stats[string(event.Type)]++
		stats[string(event.Type)+"_"+string(event.Status)]++
	}

	return stats
}

func (rs *ReplayService) GetSequenceRange() (int64, int64) {
	events := rs.eventStore.GetAllEvents()
	if len(events) == 0 {
		return 0, 0
	}

	return events[0].Sequence, events[len(events)-1].Sequence
}
