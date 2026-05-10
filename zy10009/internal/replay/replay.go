package replay

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"

	"chaos-demo/internal/eventstore"
	"chaos-demo/internal/services"
	"chaos-demo/internal/types"
)

type Snapshot struct {
	Timestamp     time.Time
	Sequence      int64
	StockSnapshot map[string]types.Stock
	OrderSnapshot map[string]types.Order
	GoroutineCount int
	ActiveLocks   int
	ConfigVersion int
}

type ReplayService struct {
	eventStore   *eventstore.EventStore
	inventory    *services.InventoryService
	orderService *services.OrderService
	chaos        *services.ChaosService

	isReplaying  bool
	replayingMu  sync.RWMutex
	currentSeq   int64
	replaySpeed  float64
	cancelFunc   context.CancelFunc

	snapshots    map[int64]*Snapshot
	snapshotsMu  sync.RWMutex
}

func NewReplayService(eventStore *eventstore.EventStore, inventory *services.InventoryService, orderService *services.OrderService, chaos *services.ChaosService) *ReplayService {
	return &ReplayService{
		eventStore:   eventStore,
		inventory:    inventory,
		orderService: orderService,
		chaos:        chaos,
		isReplaying:  false,
		replaySpeed:  1.0,
		snapshots:    make(map[int64]*Snapshot),
	}
}

func (rs *ReplayService) TakeSnapshot(sequence int64) *Snapshot {
	stocks := rs.inventory.GetAllStocks()
	orders := rs.orderService.GetAllOrders()

	snapshot := &Snapshot{
		Timestamp:      time.Now(),
		Sequence:       sequence,
		StockSnapshot:  make(map[string]types.Stock),
		OrderSnapshot:  make(map[string]types.Order),
		GoroutineCount: int(rs.chaos.GetLeakedGoroutineCount()) + 10,
		ActiveLocks:    rs.chaos.GetActiveLocks(),
		ConfigVersion:  rs.chaos.GetConfigVersion(),
	}

	for k, v := range stocks {
		snapshot.StockSnapshot[k] = v
	}

	for k, v := range orders {
		snapshot.OrderSnapshot[k] = v
	}

	rs.snapshotsMu.Lock()
	rs.snapshots[sequence] = snapshot
	rs.snapshotsMu.Unlock()

	return snapshot
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
		eventCopy.Payload = make(map[string]interface{})
		for k, v := range event.Payload {
			eventCopy.Payload[k] = v
		}
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
	rs.snapshotsMu.RLock()
	closestSnapshot, hasSnapshot := rs.snapshots[sequence]
	rs.snapshotsMu.RUnlock()

	if hasSnapshot {
		return &types.SystemState{
			Timestamp:       closestSnapshot.Timestamp,
			StockSnapshot:   closestSnapshot.StockSnapshot,
			OrderSnapshot:   closestSnapshot.OrderSnapshot,
			GoroutineCount:  closestSnapshot.GoroutineCount,
			ActiveLocks:     closestSnapshot.ActiveLocks,
			ConfigVersion:   closestSnapshot.ConfigVersion,
		}, nil
	}

	events := rs.eventStore.GetAllEvents()

	state := &types.SystemState{
		Timestamp:      time.Now(),
		StockSnapshot:  make(map[string]types.Stock),
		OrderSnapshot:  make(map[string]types.Order),
		ConnectionPool: types.ConnectionPoolState{},
		MessageQueue:   types.MessageQueueState{},
		GoroutineCount: 10,
		CacheHits:      0,
		CacheMisses:    0,
		ActiveLocks:    0,
		ConfigVersion:  1,
	}

	stocks := make(map[string]*types.Stock)
	orders := make(map[string]*types.Order)

	for _, id := range []string{"PROD-001", "PROD-002", "PROD-003", "PROD-004", "PROD-005"} {
		stocks[id] = &types.Stock{
			ProductID: id,
			Quantity:  1000,
			Reserved:  0,
			Version:   0,
			UpdatedAt: time.Now(),
		}
	}

	for _, event := range events {
		if event.Sequence > sequence {
			break
		}

		state.Timestamp = event.Timestamp
		rs.applyEventToState(state, event, stocks, orders)
	}

	for id, stock := range stocks {
		state.StockSnapshot[id] = *stock
	}

	for id, order := range orders {
		state.OrderSnapshot[id] = *order
	}

	return state, nil
}

func (rs *ReplayService) applyEventToState(state *types.SystemState, event types.Event, stocks map[string]*types.Stock, orders map[string]*types.Order) {
	switch event.Type {
	case types.EventTypeStockDeducted:
		if event.Status == types.EventStatusSuccess && event.ProductID != nil {
			productID := *event.ProductID
			if stock, exists := stocks[productID]; exists {
				if qty, ok := event.Payload["quantity"].(int); ok {
					stock.Reserved += qty
				}
				if remaining, ok := event.Payload["remaining"].(int); ok {
					stock.Quantity = remaining + stock.Reserved
				}
				if ver, ok := event.Payload["version"].(int); ok {
					stock.Version = ver
				}
				stock.UpdatedAt = event.Timestamp
			}
		}

	case types.EventTypeStockRollback:
		if event.Status == types.EventStatusSuccess && event.ProductID != nil {
			productID := *event.ProductID
			if stock, exists := stocks[productID]; exists {
				if qty, ok := event.Payload["quantity"].(int); ok {
					if stock.Reserved >= qty {
						stock.Reserved -= qty
					}
				}
				if ver, ok := event.Payload["version"].(int); ok {
					stock.Version = ver
				}
				stock.UpdatedAt = event.Timestamp
			}
		}

	case types.EventTypeOrderCreated:
		if event.Status == types.EventStatusSuccess && event.OrderID != nil {
			orderID := *event.OrderID
			order, exists := orders[orderID]
			if !exists {
				order = &types.Order{
					ID: orderID,
				}
				orders[orderID] = order
			}
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
		}

	case types.EventTypeOrderFailed:
		if event.OrderID != nil {
			orderID := *event.OrderID
			order, exists := orders[orderID]
			if !exists {
				order = &types.Order{
					ID: orderID,
				}
				orders[orderID] = order
			}
			order.Status = types.OrderStatusFailed
			if pid, ok := event.Payload["product_id"].(string); ok {
				order.ProductID = pid
			}
			if qty, ok := event.Payload["quantity"].(int); ok {
				order.Quantity = qty
			}
			order.UpdatedAt = event.Timestamp
		}

	case types.EventTypeCompensationStarted:
		if event.OrderID != nil {
			orderID := *event.OrderID
			if order, exists := orders[orderID]; exists {
				order.Status = types.OrderStatusCompensating
				order.UpdatedAt = event.Timestamp
			}
		}

	case types.EventTypeCompensationSuccess:
		if event.OrderID != nil {
			orderID := *event.OrderID
			if order, exists := orders[orderID]; exists {
				order.Status = types.OrderStatusRolledBack
				order.UpdatedAt = event.Timestamp
			}
		}

	case types.EventTypeCompensationFailed:
		if event.OrderID != nil && event.Status == types.EventStatusFailed {
			orderID := *event.OrderID
			if order, exists := orders[orderID]; exists {
				order.Status = types.OrderStatusFailed
				if retry, ok := event.Payload["retry_count"].(int); ok {
					order.RetryCount = retry
				}
				order.UpdatedAt = event.Timestamp
			}
		}

	case types.EventTypeDBLockWait:
		if event.Status == types.EventStatusPending {
			state.ActiveLocks++
		} else if event.Status == types.EventStatusSuccess {
			if state.ActiveLocks > 0 {
				state.ActiveLocks--
			}
		}

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
		if event.Status == types.EventStatusSuccess {
			if acquired, ok := event.Payload["acquired_conns"].(int); ok {
				state.ConnectionPool.ActiveConns = acquired
			}
		}
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
		key := fmt.Sprintf("%s_%s", event.Type, event.Status)
		stats[key]++
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

func (rs *ReplayService) GetLeakedGoroutineCount() int64 {
	return rs.chaos.GetLeakedGoroutineCount()
}

func (rs *ReplayService) RecordReplayEvent(eventType, message string, payload map[string]interface{}) {
	rs.eventStore.Append(types.Event{
		ID:        uuid.New(),
		Type:      types.EventTypeStateChange,
		Status:    types.EventStatusSuccess,
		Payload: map[string]interface{}{
			"replay_event": eventType,
			"message":      message,
			"details":      payload,
		},
		Timestamp: time.Now(),
	})
}
