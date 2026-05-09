package services

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"chaos-demo/internal/eventstore"
	"chaos-demo/internal/messagequeue"
	"chaos-demo/internal/types"
)

type OrderService struct {
	db         *pgxpool.Pool
	eventStore *eventstore.EventStore
	chaos      *ChaosService
	inventory  *InventoryService
	queue      *messagequeue.MessageQueue

	ordersMu sync.RWMutex
	orders   map[string]*types.Order
}

func NewOrderService(db *pgxpool.Pool, eventStore *eventstore.EventStore, chaos *ChaosService, inventory *InventoryService, queue *messagequeue.MessageQueue) *OrderService {
	return &OrderService{
		db:         db,
		eventStore: eventStore,
		chaos:      chaos,
		inventory:  inventory,
		queue:      queue,
		orders:     make(map[string]*types.Order),
	}
}

func (s *OrderService) CreateOrder(ctx context.Context, productID string, quantity int, payload map[string]interface{}) (*types.Order, error) {
	start := time.Now()

	orderID := uuid.New().String()

	s.eventStore.Append(types.Event{
		ID:      uuid.New(),
		Type:    types.EventTypeStateChange,
		Status:  types.EventStatusPending,
		OrderID: &orderID,
		Payload: map[string]interface{}{
			"action":    "create_order_start",
			"product_id": productID,
			"quantity":  quantity,
		},
		Timestamp: time.Now(),
	})

	success, err := s.inventory.DeductStock(ctx, productID, quantity)
	if err != nil || !success {
		duration := time.Since(start).Milliseconds()
		errMsg := "stock deduction failed"
		if err != nil {
			errMsg = err.Error()
		}
		s.eventStore.Append(types.Event{
			ID:      uuid.New(),
			Type:    types.EventTypeOrderFailed,
			Status:  types.EventStatusFailed,
			OrderID: &orderID,
			Payload: map[string]interface{}{
				"error": errMsg,
			},
			Timestamp: time.Now(),
			Duration:  &duration,
			Error:     &errMsg,
		})
		return nil, errors.New(errMsg)
	}

	if s.chaos.ShouldInjectOrderFailure() {
		order := &types.Order{
			ID:         orderID,
			ProductID:  productID,
			Quantity:   quantity,
			Status:     types.OrderStatusFailed,
			Amount:     float64(quantity) * 10.0,
			Payload:    payload,
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
			RetryCount: 0,
		}

		s.ordersMu.Lock()
		s.orders[orderID] = order
		s.ordersMu.Unlock()

		duration := time.Since(start).Milliseconds()
		errMsg := "order creation failed due to chaos injection"

		s.eventStore.Append(types.Event{
			ID:      uuid.New(),
			Type:    types.EventTypeOrderFailed,
			Status:  types.EventStatusFailed,
			OrderID: &orderID,
			Payload: map[string]interface{}{
				"error":      errMsg,
				"product_id": productID,
				"quantity":   quantity,
			},
			Timestamp: time.Now(),
			Duration:  &duration,
			Error:     &errMsg,
		})

		compensationTask := types.CompensationTask{
			ID:         uuid.New(),
			OrderID:    orderID,
			ProductID:  productID,
			Quantity:   quantity,
			Status:     types.EventStatusPending,
			RetryCount: 0,
			MaxRetries: 5,
			NextRetry:  time.Now().Add(5 * time.Second),
			CreatedAt:  time.Now(),
		}

		s.queueCompensation(compensationTask)

		return order, errors.New(errMsg)
	}

	order := &types.Order{
		ID:         orderID,
		ProductID:  productID,
		Quantity:   quantity,
		Status:     types.OrderStatusCreated,
		Amount:     float64(quantity) * 10.0,
		Payload:    payload,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
		RetryCount: 0,
	}

	s.ordersMu.Lock()
	s.orders[orderID] = order
	s.ordersMu.Unlock()

	duration := time.Since(start).Milliseconds()
	s.eventStore.Append(types.Event{
		ID:      uuid.New(),
		Type:    types.EventTypeOrderCreated,
		Status:  types.EventStatusSuccess,
		OrderID: &orderID,
		Payload: map[string]interface{}{
			"product_id": productID,
			"quantity":   quantity,
			"amount":     order.Amount,
		},
		Timestamp: time.Now(),
		Duration:  &duration,
	})

	return order, nil
}

func (s *OrderService) GetOrder(orderID string) (*types.Order, bool) {
	s.ordersMu.RLock()
	defer s.ordersMu.RUnlock()

	order, exists := s.orders[orderID]
	if !exists {
		return nil, false
	}

	orderCopy := *order
	return &orderCopy, true
}

func (s *OrderService) GetAllOrders() map[string]types.Order {
	s.ordersMu.RLock()
	defer s.ordersMu.RUnlock()

	result := make(map[string]types.Order)
	for id, order := range s.orders {
		result[id] = *order
	}
	return result
}

func (s *OrderService) UpdateOrderStatus(orderID string, status types.OrderStatus) error {
	s.ordersMu.Lock()
	defer s.ordersMu.Unlock()

	order, exists := s.orders[orderID]
	if !exists {
		return errors.New("order not found")
	}

	order.Status = status
	order.UpdatedAt = time.Now()
	order.RetryCount++

	return nil
}

func (s *OrderService) queueCompensation(task types.CompensationTask) {
	taskJSON, _ := json.Marshal(task)
	s.queue.Publish("compensation", taskJSON)
}

func (s *OrderService) ProcessCompensation(ctx context.Context, task types.CompensationTask) error {
	start := time.Now()

	s.eventStore.Append(types.Event{
		ID:      uuid.New(),
		Type:    types.EventTypeCompensationStarted,
		Status:  types.EventStatusPending,
		OrderID: &task.OrderID,
		Payload: map[string]interface{}{
			"retry_count":  task.RetryCount,
			"max_retries":  task.MaxRetries,
			"product_id":   task.ProductID,
			"quantity":     task.Quantity,
		},
		Timestamp: time.Now(),
	})

	if s.chaos.ShouldInjectCompensationRetryFailure() && task.RetryCount < task.MaxRetries {
		task.RetryCount++
		errMsg := "compensation retry failed, will retry again"
		duration := time.Since(start).Milliseconds()

		s.eventStore.Append(types.Event{
			ID:      uuid.New(),
			Type:    types.EventTypeCompensationFailed,
			Status:  types.EventStatusRetrying,
			OrderID: &task.OrderID,
			Payload: map[string]interface{}{
				"retry_count": task.RetryCount,
				"error":       errMsg,
			},
			Timestamp: time.Now(),
			Duration:  &duration,
			Error:     &errMsg,
			Retry:     task.RetryCount,
		})

		task.NextRetry = time.Now().Add(time.Duration(task.RetryCount*2) * time.Second)
		s.queueCompensation(task)
		return errors.New(errMsg)
	}

	err := s.inventory.RollbackStock(ctx, task.ProductID, task.Quantity)
	if err != nil {
		task.RetryCount++
		duration := time.Since(start).Milliseconds()
		errMsg := err.Error()

		if task.RetryCount < task.MaxRetries {
			s.eventStore.Append(types.Event{
				ID:      uuid.New(),
				Type:    types.EventTypeCompensationFailed,
				Status:  types.EventStatusRetrying,
				OrderID: &task.OrderID,
				Payload: map[string]interface{}{
					"retry_count": task.RetryCount,
					"error":       errMsg,
				},
				Timestamp: time.Now(),
				Duration:  &duration,
				Error:     &errMsg,
				Retry:     task.RetryCount,
			})

			task.NextRetry = time.Now().Add(time.Duration(task.RetryCount*2) * time.Second)
			s.queueCompensation(task)
			return err
		}

		s.eventStore.Append(types.Event{
			ID:      uuid.New(),
			Type:    types.EventTypeCompensationFailed,
			Status:  types.EventStatusFailed,
			OrderID: &task.OrderID,
			Payload: map[string]interface{}{
				"retry_count": task.RetryCount,
				"max_retries": task.MaxRetries,
				"error":       errMsg,
			},
			Timestamp: time.Now(),
			Duration:  &duration,
			Error:     &errMsg,
			Retry:     task.RetryCount,
		})

		return err
	}

	s.UpdateOrderStatus(task.OrderID, types.OrderStatusRolledBack)

	duration := time.Since(start).Milliseconds()
	s.eventStore.Append(types.Event{
		ID:      uuid.New(),
		Type:    types.EventTypeCompensationSuccess,
		Status:  types.EventStatusSuccess,
		OrderID: &task.OrderID,
		Payload: map[string]interface{}{
			"retry_count": task.RetryCount,
			"product_id":  task.ProductID,
			"quantity":    task.Quantity,
		},
		Timestamp: time.Now(),
		Duration:  &duration,
	})

	return nil
}
