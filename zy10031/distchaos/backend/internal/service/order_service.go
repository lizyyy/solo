package service

import (
	"context"
	"fmt"
	"time"
	
	"github.com/google/uuid"
	
	"distchaos/internal/domain"
	"distchaos/internal/event"
)

type OrderService struct {
	inventoryRepo  InventoryRepository
	orderRepo      OrderRepository
	paymentRepo    PaymentRepository
	compensationRepo CompensationRepository
	eventManager   *event.EventManager
	chaosManager   ChaosManager
}

type InventoryRepository interface {
	Reserve(ctx context.Context, productID int64, quantity int) error
	Release(ctx context.Context, productID int64, quantity int) error
	GetAvailable(ctx context.Context, productID int64) (int, error)
}

type OrderRepository interface {
	Create(ctx context.Context, order *domain.Order) error
	Update(ctx context.Context, order *domain.Order) error
	GetByID(ctx context.Context, id int64) (*domain.Order, error)
	GetByOrderNo(ctx context.Context, orderNo string) (*domain.Order, error)
	GetPendingCompensation(ctx context.Context) ([]*domain.Order, error)
}

type PaymentRepository interface {
	Create(ctx context.Context, payment *domain.Payment) error
	Update(ctx context.Context, payment *domain.Payment) error
	GetByOrderID(ctx context.Context, orderID int64) (*domain.Payment, error)
	Refund(ctx context.Context, payment *domain.Payment) error
}

type CompensationRepository interface {
	Create(ctx context.Context, task *domain.CompensationTask) error
	Update(ctx context.Context, task *domain.CompensationTask) error
	GetByID(ctx context.Context, id string) (*domain.CompensationTask, error)
	GetPending(ctx context.Context) ([]*domain.CompensationTask, error)
}

type ChaosManager interface {
	GetStatus() map[string]interface{}
}

func NewOrderService(
	inventoryRepo InventoryRepository,
	orderRepo OrderRepository,
	paymentRepo PaymentRepository,
	compensationRepo CompensationRepository,
	eventManager *event.EventManager,
	chaosManager ChaosManager,
) *OrderService {
	return &OrderService{
		inventoryRepo:    inventoryRepo,
		orderRepo:        orderRepo,
		paymentRepo:      paymentRepo,
		compensationRepo: compensationRepo,
		eventManager:     eventManager,
		chaosManager:     chaosManager,
	}
}

func (s *OrderService) CreateOrder(ctx context.Context, req *domain.CreateOrderRequest) (*domain.CreateOrderResponse, error) {
	traceID := uuid.New().String()
	correlationID := uuid.New().String()
	
	ctx = context.WithValue(ctx, "trace_id", traceID)
	ctx = context.WithValue(ctx, "correlation_id", correlationID)
	
	startTime := time.Now()
	
	txContext := &domain.TransactionContext{
		TraceID:       traceID,
		CorrelationID: correlationID,
		UserID:        req.UserID,
		ProductID:     req.ProductID,
		Quantity:      req.Quantity,
		StartTime:     startTime,
	}
	
	order, err := s.executeOrderFlow(ctx, txContext, req)
	if err != nil {
		return &domain.CreateOrderResponse{
			Success: false,
			TraceID: traceID,
			Error:   err.Error(),
		}, nil
	}
	
	return &domain.CreateOrderResponse{
		Success: true,
		Order:   order,
		TraceID: traceID,
	}, nil
}

func (s *OrderService) executeOrderFlow(ctx context.Context, txCtx *domain.TransactionContext, req *domain.CreateOrderRequest) (*domain.Order, error) {
	traceID := txCtx.TraceID
	
	step1 := event.Event{
		ID:          uuid.New().String(),
		TraceID:     traceID,
		CorrelationID: txCtx.CorrelationID,
		Type:        event.EventTypeInventoryReserved,
		Status:      event.EventStatusPending,
		Service:     "order-service",
		Payload: map[string]interface{}{
			"product_id": req.ProductID,
			"quantity":   req.Quantity,
			"step":       "reserve_inventory",
		},
	}
	s.eventManager.Record(ctx, step1)
	
	err := s.inventoryRepo.Reserve(ctx, req.ProductID, req.Quantity)
	if err != nil {
		step1.Status = event.EventStatusFailed
		step1.Error = err.Error()
		step1.Duration = time.Since(txCtx.StartTime)
		s.eventManager.Record(ctx, step1)
		return nil, fmt.Errorf("failed to reserve inventory: %w", err)
	}
	
	step1.Status = event.EventStatusSuccess
	step1.Duration = time.Since(txCtx.StartTime)
	s.eventManager.Record(ctx, step1)
	
	orderNo := fmt.Sprintf("ORD-%d", time.Now().UnixNano())
	order := &domain.Order{
		OrderNo:   orderNo,
		UserID:    req.UserID,
		ProductID: req.ProductID,
		Quantity:  req.Quantity,
		Amount:    float64(req.Quantity) * 100.0,
		Status:    domain.OrderStatusCreated,
	}
	
	step2 := event.Event{
		ID:          uuid.New().String(),
		TraceID:     traceID,
		CorrelationID: txCtx.CorrelationID,
		PreviousID:  step1.ID,
		Type:        event.EventTypeOrderCreated,
		Status:      event.EventStatusPending,
		Service:     "order-service",
		Payload: map[string]interface{}{
			"order_no": orderNo,
			"amount":   order.Amount,
			"step":     "create_order",
		},
	}
	s.eventManager.Record(ctx, step2)
	
	if err := s.orderRepo.Create(ctx, order); err != nil {
		step2.Status = event.EventStatusFailed
		step2.Error = err.Error()
		step2.Duration = time.Since(txCtx.StartTime)
		s.eventManager.Record(ctx, step2)
		
		s.triggerCompensation(ctx, txCtx, order, "order_creation_failed")
		return nil, fmt.Errorf("failed to create order: %w", err)
	}
	
	txCtx.OrderID = order.ID
	txCtx.OrderNo = order.OrderNo
	txCtx.Amount = order.Amount
	
	step2.Status = event.EventStatusSuccess
	step2.Duration = time.Since(txCtx.StartTime)
	s.eventManager.Record(ctx, step2)
	
	payment := &domain.Payment{
		OrderID: order.ID,
		UserID:  req.UserID,
		Amount:  order.Amount,
		Status:  domain.PaymentStatusPending,
	}
	
	step3 := event.Event{
		ID:          uuid.New().String(),
		TraceID:     traceID,
		CorrelationID: txCtx.CorrelationID,
		PreviousID:  step2.ID,
		Type:        event.EventTypePaymentSucceeded,
		Status:      event.EventStatusPending,
		Service:     "payment-service",
		Payload: map[string]interface{}{
			"order_id": order.ID,
			"amount":   order.Amount,
			"step":     "process_payment",
		},
	}
	s.eventManager.Record(ctx, step3)
	
	if err := s.processPayment(ctx, payment); err != nil {
		step3.Status = event.EventStatusFailed
		step3.Error = err.Error()
		step3.Duration = time.Since(txCtx.StartTime)
		s.eventManager.Record(ctx, step3)
		
		order.Status = domain.OrderStatusFailed
		order.LastError = err.Error()
		s.orderRepo.Update(ctx, order)
		
		s.triggerCompensation(ctx, txCtx, order, "payment_failed")
		return nil, fmt.Errorf("payment failed: %w", err)
	}
	
	step3.Status = event.EventStatusSuccess
	step3.Duration = time.Since(txCtx.StartTime)
	s.eventManager.Record(ctx, step3)
	
	order.PaymentID = payment.ID
	order.Status = domain.OrderStatusPaid
	s.orderRepo.Update(ctx, order)
	
	return order, nil
}

func (s *OrderService) processPayment(ctx context.Context, payment *domain.Payment) error {
	payment.TransactionNo = uuid.New().String()
	payment.Status = domain.PaymentStatusSuccess
	
	if err := s.paymentRepo.Create(ctx, payment); err != nil {
		return err
	}
	
	return nil
}

func (s *OrderService) triggerCompensation(ctx context.Context, txCtx *domain.TransactionContext, order *domain.Order, reason string) {
	compensationID := uuid.New().String()
	
	order.CompensationID = compensationID
	order.Status = domain.OrderStatusCompensating
	s.orderRepo.Update(ctx, order)
	
	steps := []domain.CompensationStep{
		{Name: "refund_payment", Status: domain.CompensationStatusPending},
		{Name: "release_inventory", Status: domain.CompensationStatusPending},
		{Name: "cancel_order", Status: domain.CompensationStatusPending},
	}
	
	task := &domain.CompensationTask{
		ID:          compensationID,
		OrderID:     order.ID,
		Status:      domain.CompensationStatusPending,
		Steps:       steps,
		CurrentStep: 0,
		RetryCount:  0,
		MaxRetries:  3,
	}
	
	if err := s.compensationRepo.Create(ctx, task); err != nil {
		return
	}
	
	evt := event.Event{
		ID:          uuid.New().String(),
		TraceID:     txCtx.TraceID,
		CorrelationID: txCtx.CorrelationID,
		Type:        event.EventTypeCompensationStart,
		Status:      event.EventStatusPending,
		Service:     "compensation-service",
		Payload: map[string]interface{}{
			"compensation_id": compensationID,
			"order_id":        order.ID,
			"reason":          reason,
			"steps_count":     len(steps),
		},
	}
	s.eventManager.Record(ctx, evt)
	
	go s.executeCompensation(ctx, txCtx, task, order)
}

func (s *OrderService) executeCompensation(ctx context.Context, txCtx *domain.TransactionContext, task *domain.CompensationTask, order *domain.Order) {
	for task.CurrentStep < len(task.Steps) {
		step := &task.Steps[task.CurrentStep]
		step.Attempts++
		now := time.Now()
		step.ExecutedAt = &now
		
		var err error
		stepName := step.Name
		
		retryEvt := event.Event{
			ID:          uuid.New().String(),
			TraceID:     txCtx.TraceID,
			CorrelationID: txCtx.CorrelationID,
			Type:        event.EventTypeCompensationRetry,
			Status:      event.EventStatusRetrying,
			Service:     "compensation-service",
			Payload: map[string]interface{}{
				"compensation_id": task.ID,
				"step":            stepName,
				"attempt":         step.Attempts,
				"max_retries":     task.MaxRetries,
			},
		}
		s.eventManager.Record(ctx, retryEvt)
		
		switch stepName {
		case "refund_payment":
			err = s.compensatePayment(ctx, order)
		case "release_inventory":
			err = s.compensateInventory(ctx, order)
		case "cancel_order":
			err = s.compensateOrder(ctx, order)
		}
		
		if err != nil {
			step.LastError = err.Error()
			step.Status = domain.CompensationStatusFailed
			task.RetryCount++
			
			if task.RetryCount >= task.MaxRetries {
				task.Status = domain.CompensationStatusFailed
				task.LastError = fmt.Sprintf("compensation failed at step %s: %v", stepName, err)
				s.compensationRepo.Update(ctx, task)
				
				failEvt := event.Event{
					ID:          uuid.New().String(),
					TraceID:     txCtx.TraceID,
					CorrelationID: txCtx.CorrelationID,
					Type:        event.EventTypeCompensationFailed,
					Status:      event.EventStatusFailed,
					Service:     "compensation-service",
					Payload: map[string]interface{}{
						"compensation_id": task.ID,
						"failed_step":     stepName,
						"error":           err.Error(),
						"retry_count":     task.RetryCount,
					},
				}
				s.eventManager.Record(ctx, failEvt)
				return
			}
			
			task.Status = domain.CompensationStatusRetrying
			nextRetry := time.Now().Add(time.Duration(task.RetryCount) * 5 * time.Second)
			task.NextRetryAt = &nextRetry
			s.compensationRepo.Update(ctx, task)
			
			time.Sleep(time.Duration(task.RetryCount) * 5 * time.Second)
			continue
		}
		
		step.Status = domain.CompensationStatusSuccess
		task.CurrentStep++
		s.compensationRepo.Update(ctx, task)
	}
	
	task.Status = domain.CompensationStatusSuccess
	s.compensationRepo.Update(ctx, task)
	
	successEvt := event.Event{
		ID:          uuid.New().String(),
		TraceID:     txCtx.TraceID,
		CorrelationID: txCtx.CorrelationID,
		Type:        event.EventTypeCompensationSuccess,
		Status:      event.EventStatusSuccess,
		Service:     "compensation-service",
		Payload: map[string]interface{}{
			"compensation_id": task.ID,
			"steps_completed": len(task.Steps),
		},
	}
	s.eventManager.Record(ctx, successEvt)
}

func (s *OrderService) compensatePayment(ctx context.Context, order *domain.Order) error {
	payment, err := s.paymentRepo.GetByOrderID(ctx, order.ID)
	if err != nil {
		return fmt.Errorf("failed to get payment: %w", err)
	}
	
	if payment.Status == domain.PaymentStatusSuccess {
		if err := s.paymentRepo.Refund(ctx, payment); err != nil {
			return fmt.Errorf("failed to refund payment: %w", err)
		}
	}
	
	return nil
}

func (s *OrderService) compensateInventory(ctx context.Context, order *domain.Order) error {
	if err := s.inventoryRepo.Release(ctx, order.ProductID, order.Quantity); err != nil {
		return fmt.Errorf("failed to release inventory: %w", err)
	}
	return nil
}

func (s *OrderService) compensateOrder(ctx context.Context, order *domain.Order) error {
	order.Status = domain.OrderStatusCancelled
	if err := s.orderRepo.Update(ctx, order); err != nil {
		return fmt.Errorf("failed to cancel order: %w", err)
	}
	return nil
}

func (s *OrderService) GetOrderTrace(ctx context.Context, traceID string) ([]event.Event, error) {
	return s.eventManager.GetTrace(ctx, traceID)
}

func (s *OrderService) GetRecentEvents(ctx context.Context, limit int) ([]event.Event, error) {
	return s.eventManager.GetRecent(ctx, limit)
}

func (s *OrderService) ReplayEvents(ctx context.Context, traceID string) error {
	events, err := s.eventManager.GetTrace(ctx, traceID)
	if err != nil {
		return err
	}
	
	for _, evt := range events {
		replayEvt := event.Event{
			ID:          uuid.New().String(),
			TraceID:     fmt.Sprintf("replay-%s", traceID),
			CorrelationID: evt.CorrelationID,
			Type:        evt.Type,
			Status:      event.EventStatusPending,
			Service:     "replay-service",
			Payload: map[string]interface{}{
				"original_event_id": evt.ID,
				"original_status":   evt.Status,
				"replay_mode":       true,
			},
		}
		
		if err := s.eventManager.Record(ctx, replayEvt); err != nil {
			return err
		}
		
		replayEvt.Status = event.EventStatusSuccess
		s.eventManager.Record(ctx, replayEvt)
		
		time.Sleep(100 * time.Millisecond)
	}
	
	return nil
}
