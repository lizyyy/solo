package service

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"

	"distchaos/internal/domain"
	"distchaos/internal/event"
)

type FailurePoint string

const (
	FailurePointNone          FailurePoint = "none"
	FailurePointAfterReserve  FailurePoint = "after_reserve"
	FailurePointOrderCreation FailurePoint = "order_creation"
	FailurePointPayment       FailurePoint = "payment"
	FailurePointAfterPayment  FailurePoint = "after_payment"
)

type CompensationFailureMode string

const (
	CompensationFailureNone         CompensationFailureMode = "none"
	CompensationFailureRefund       CompensationFailureMode = "refund_payment"
	CompensationFailureRelease      CompensationFailureMode = "release_inventory"
	CompensationFailureCancel       CompensationFailureMode = "cancel_order"
	CompensationFailureIntermittent CompensationFailureMode = "intermittent"
)

type ChaosState struct {
	Mu                    sync.RWMutex
	OrderFailurePoint     FailurePoint
	CompensationFailure   CompensationFailureMode
	CompensationFailCount int
	ConnectionPoolBroken  bool
	GoroutineLeakActive   bool
	DBLockWaiting         bool
	CacheDirty            bool
	ConfigDrifted         bool
	MessageBacklogActive  bool

	ConnectionPoolMax     int
	ConnectionPoolCurrent int
	LeakedConnections     []string

	CacheOriginalData map[string]interface{}
	CacheDirtyData    map[string]interface{}

	OriginalConfigs map[string]interface{}
	DriftedConfigs  map[string]interface{}

	LeakedGoroutines   int32
	StopGoroutineChans []chan struct{}

	BacklogQueue chan interface{}
}

func NewChaosState() *ChaosState {
	return &ChaosState{
		OrderFailurePoint:   FailurePointNone,
		CompensationFailure: CompensationFailureNone,
		ConnectionPoolMax:   10,
		CacheOriginalData:   make(map[string]interface{}),
		CacheDirtyData:      make(map[string]interface{}),
		OriginalConfigs:     make(map[string]interface{}),
		DriftedConfigs:      make(map[string]interface{}),
		StopGoroutineChans:  make([]chan struct{}, 0),
		BacklogQueue:        make(chan interface{}, 10000),
	}
}

func (c *ChaosState) SetOrderFailurePoint(point FailurePoint) {
	c.Mu.Lock()
	defer c.Mu.Unlock()
	c.OrderFailurePoint = point
}

func (c *ChaosState) GetOrderFailurePoint() FailurePoint {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	return c.OrderFailurePoint
}

func (c *ChaosState) SetCompensationFailure(mode CompensationFailureMode) {
	c.Mu.Lock()
	defer c.Mu.Unlock()
	c.CompensationFailure = mode
	c.CompensationFailCount = 0
}

func (c *ChaosState) GetCompensationFailure() CompensationFailureMode {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	return c.CompensationFailure
}

func (c *ChaosState) IncrementCompensationFailCount() int {
	c.Mu.Lock()
	defer c.Mu.Unlock()
	c.CompensationFailCount++
	return c.CompensationFailCount
}

func (c *ChaosState) IsConnectionPoolBroken() bool {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	return c.ConnectionPoolBroken
}

func (c *ChaosState) IsDBLockWaiting() bool {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	return c.DBLockWaiting
}

func (c *ChaosState) IsCacheDirty() bool {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	return c.CacheDirty
}

func (c *ChaosState) IsMessageBacklogActive() bool {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	return c.MessageBacklogActive
}

func (c *ChaosState) IsConfigDrifted() bool {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	return c.ConfigDrifted
}

func (c *ChaosState) GetDirtyCache(key string) (interface{}, bool) {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	val, ok := c.CacheDirtyData[key]
	return val, ok
}

func (c *ChaosState) GetDriftedConfig(key string) (interface{}, bool) {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	val, ok := c.DriftedConfigs[key]
	return val, ok
}

type OrderService struct {
	inventoryRepo    InventoryRepository
	orderRepo        OrderRepository
	paymentRepo      PaymentRepository
	compensationRepo CompensationRepository
	eventManager     *event.EventManager
	chaosState       *ChaosState
}

type InventoryRepository interface {
	Reserve(ctx context.Context, productID int64, quantity int) error
	Release(ctx context.Context, productID int64, quantity int) error
	GetAvailable(ctx context.Context, productID int64) (int, error)
	GetReserved(ctx context.Context, productID int64) (int, error)
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

func NewOrderService(
	inventoryRepo InventoryRepository,
	orderRepo OrderRepository,
	paymentRepo PaymentRepository,
	compensationRepo CompensationRepository,
	eventManager *event.EventManager,
	chaosState *ChaosState,
) *OrderService {
	return &OrderService{
		inventoryRepo:    inventoryRepo,
		orderRepo:        orderRepo,
		paymentRepo:      paymentRepo,
		compensationRepo: compensationRepo,
		eventManager:     eventManager,
		chaosState:       chaosState,
	}
}

func (s *OrderService) GetChaosState() *ChaosState {
	return s.chaosState
}

type CreateOrderRequestExtended struct {
	domain.CreateOrderRequest
	FailurePoint        FailurePoint            `json:"failure_point"`
	CompensationFailure CompensationFailureMode `json:"compensation_failure"`
}

func (s *OrderService) CreateOrder(ctx context.Context, req *CreateOrderRequestExtended) (*domain.CreateOrderResponse, error) {
	traceID := uuid.New().String()
	correlationID := uuid.New().String()

	ctx = context.WithValue(ctx, "trace_id", traceID)
	ctx = context.WithValue(ctx, "correlation_id", correlationID)

	if req.FailurePoint != "" && req.FailurePoint != FailurePointNone {
		s.chaosState.SetOrderFailurePoint(req.FailurePoint)
	}
	if req.CompensationFailure != "" && req.CompensationFailure != CompensationFailureNone {
		s.chaosState.SetCompensationFailure(req.CompensationFailure)
	}

	startTime := time.Now()

	txContext := &domain.TransactionContext{
		TraceID:       traceID,
		CorrelationID: correlationID,
		UserID:        req.UserID,
		ProductID:     req.ProductID,
		Quantity:      req.Quantity,
		StartTime:     startTime,
	}

	order, err := s.executeOrderFlow(ctx, txContext, &req.CreateOrderRequest)
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

func (s *OrderService) checkChaosInjection(ctx context.Context, traceID string, phase string) error {
	if s.chaosState.IsConnectionPoolBroken() {
		s.recordChaosEvent(ctx, traceID, "connection_pool_injection", "连接池耗尽，无法获取数据库连接")
		return errors.New("connection pool exhausted: no available connections")
	}

	if s.chaosState.IsMessageBacklogActive() {
		s.recordChaosEvent(ctx, traceID, "message_backlog_injection", "消息队列积压，处理延迟增加")
		time.Sleep(3 * time.Second)
	}

	if s.chaosState.IsCacheDirty() {
		s.recordChaosEvent(ctx, traceID, "cache_dirty_injection", "缓存脏数据，库存/价格信息不一致")
	}

	if s.chaosState.IsConfigDrifted() {
		s.recordChaosEvent(ctx, traceID, "config_drift_injection", "配置漂移，参数配置不一致")
	}

	if s.chaosState.IsDBLockWaiting() {
		s.recordChaosEvent(ctx, traceID, "db_lock_injection", "数据库锁等待注入中")
		time.Sleep(5 * time.Second)
	}

	return nil
}

func (s *OrderService) recordChaosEvent(ctx context.Context, traceID string, eventType string, description string) {
	evt := event.Event{
		ID:            uuid.New().String(),
		TraceID:       traceID,
		CorrelationID: traceID,
		Type:          event.EventType(eventType),
		Status:        event.EventStatusFailed,
		Service:       "chaos-engine",
		Payload: map[string]interface{}{
			"phase":       eventType,
			"description": description,
			"impact":      "业务操作被混沌故障阻断",
			"timestamp":   time.Now().Format(time.RFC3339),
		},
	}
	s.eventManager.Record(ctx, evt)
}

func (s *OrderService) executeOrderFlow(ctx context.Context, txCtx *domain.TransactionContext, req *domain.CreateOrderRequest) (*domain.Order, error) {
	traceID := txCtx.TraceID
	failurePoint := s.chaosState.GetOrderFailurePoint()

	if err := s.checkChaosInjection(ctx, traceID, "before_reserve"); err != nil {
		return nil, err
	}

	step1 := event.Event{
		ID:            uuid.New().String(),
		TraceID:       traceID,
		CorrelationID: txCtx.CorrelationID,
		Type:          event.EventTypeInventoryReserved,
		Status:        event.EventStatusPending,
		Service:       "order-service",
		Payload: map[string]interface{}{
			"product_id": req.ProductID,
			"quantity":   req.Quantity,
			"step":       "reserve_inventory",
			"phase":      "before_reserve",
		},
	}
	s.eventManager.Record(ctx, step1)

	availableBefore, _ := s.inventoryRepo.GetAvailable(ctx, req.ProductID)
	reservedBefore, _ := s.inventoryRepo.GetReserved(ctx, req.ProductID)

	step1Update := step1
	step1Update.Payload["available_before"] = availableBefore
	step1Update.Payload["reserved_before"] = reservedBefore
	s.eventManager.Record(ctx, step1Update)

	err := s.inventoryRepo.Reserve(ctx, req.ProductID, req.Quantity)
	if err != nil {
		step1.Status = event.EventStatusFailed
		step1.Error = err.Error()
		step1.Duration = time.Since(txCtx.StartTime)
		s.eventManager.Record(ctx, step1)
		return nil, fmt.Errorf("failed to reserve inventory: %w", err)
	}

	availableAfter, _ := s.inventoryRepo.GetAvailable(ctx, req.ProductID)
	reservedAfter, _ := s.inventoryRepo.GetReserved(ctx, req.ProductID)

	step1.Status = event.EventStatusSuccess
	step1.Duration = time.Since(txCtx.StartTime)
	step1.Payload["available_after"] = availableAfter
	step1.Payload["reserved_after"] = reservedAfter
	step1.Payload["phase"] = "after_reserve"
	s.eventManager.Record(ctx, step1)

	inventoryReservedEvt := event.Event{
		ID:            uuid.New().String(),
		TraceID:       traceID,
		CorrelationID: txCtx.CorrelationID,
		PreviousID:    step1.ID,
		Type:          event.EventTypeInventoryReserved,
		Status:        event.EventStatusSuccess,
		Service:       "inventory-service",
		Payload: map[string]interface{}{
			"product_id":          req.ProductID,
			"quantity":            req.Quantity,
			"available_remaining": availableAfter,
			"reserved_total":      reservedAfter,
			"status":              "inventory_deducted",
		},
	}
	s.eventManager.Record(ctx, inventoryReservedEvt)

	orderNo := fmt.Sprintf("ORD-%d", time.Now().UnixNano())
	order := &domain.Order{
		OrderNo:   orderNo,
		UserID:    req.UserID,
		ProductID: req.ProductID,
		Quantity:  req.Quantity,
		Amount:    float64(req.Quantity) * 100.0,
		Status:    domain.OrderStatusPending,
	}

	step2 := event.Event{
		ID:            uuid.New().String(),
		TraceID:       traceID,
		CorrelationID: txCtx.CorrelationID,
		PreviousID:    inventoryReservedEvt.ID,
		Type:          event.EventTypeOrderCreated,
		Status:        event.EventStatusPending,
		Service:       "order-service",
		Payload: map[string]interface{}{
			"order_no":   orderNo,
			"user_id":    order.UserID,
			"product_id": order.ProductID,
			"quantity":   order.Quantity,
			"amount":     order.Amount,
			"step":       "create_order",
			"phase":      "before_create",
		},
	}
	s.eventManager.Record(ctx, step2)

	if err := s.checkChaosInjection(ctx, traceID, "before_order_creation"); err != nil {
		order.Status = domain.OrderStatusFailed
		order.LastError = "chaos_injection_failed_during_order_creation"
		s.orderRepo.Create(ctx, order)
		s.triggerCompensation(ctx, txCtx, order, "chaos_injection_failed")
		return nil, err
	}

	if failurePoint == FailurePointAfterReserve {
		if err := s.orderRepo.Create(ctx, order); err != nil {
			s.inventoryRepo.Release(ctx, req.ProductID, req.Quantity)
			return nil, fmt.Errorf("failed to create order: %w", err)
		}

		failEvt := event.Event{
			ID:            uuid.New().String(),
			TraceID:       traceID,
			CorrelationID: txCtx.CorrelationID,
			PreviousID:    inventoryReservedEvt.ID,
			Type:          event.EventTypeOrderFailed,
			Status:        event.EventStatusFailed,
			Service:       "chaos-engine",
			Payload: map[string]interface{}{
				"reason":      "simulated_failure_after_inventory_reserve",
				"description": "库存已扣减，订单已创建，但订单流程在此时被人为中断",
				"impact":      "库存已锁定，订单已创建但标记失败，需要补偿",
				"order_id":    order.ID,
				"inventory_state": map[string]interface{}{
					"available": availableAfter,
					"reserved":  reservedAfter,
				},
			},
		}
		s.eventManager.Record(ctx, failEvt)

		order.Status = domain.OrderStatusFailed
		order.LastError = "simulated failure after inventory reserve"
		s.orderRepo.Update(ctx, order)

		s.triggerCompensation(ctx, txCtx, order, "failure_after_inventory_reserve")

		s.chaosState.SetOrderFailurePoint(FailurePointNone)

		return nil, errors.New("simulated failure: inventory deducted, order created but aborted")
	}

	if failurePoint == FailurePointOrderCreation {
		step2.Status = event.EventStatusFailed
		step2.Error = "simulated order creation failure"
		step2.Duration = time.Since(txCtx.StartTime)
		step2.Payload["phase"] = "failed"
		step2.Payload["reason"] = "chaos_injection_order_creation"
		s.eventManager.Record(ctx, step2)

		if err := s.orderRepo.Create(ctx, order); err != nil {
			s.inventoryRepo.Release(ctx, req.ProductID, req.Quantity)
			return nil, fmt.Errorf("failed to create order: %w", err)
		}

		order.Status = domain.OrderStatusFailed
		order.LastError = "simulated order creation failure"
		s.orderRepo.Update(ctx, order)

		s.triggerCompensation(ctx, txCtx, order, "simulated_order_creation_failure")
		s.chaosState.SetOrderFailurePoint(FailurePointNone)

		return nil, errors.New("simulated failure: order creation failed")
	}

	if err := s.orderRepo.Create(ctx, order); err != nil {
		step2.Status = event.EventStatusFailed
		step2.Error = err.Error()
		step2.Duration = time.Since(txCtx.StartTime)
		s.eventManager.Record(ctx, step2)

		s.inventoryRepo.Release(ctx, req.ProductID, req.Quantity)
		return nil, fmt.Errorf("failed to create order: %w", err)
	}

	txCtx.OrderID = order.ID
	txCtx.OrderNo = order.OrderNo
	txCtx.Amount = order.Amount

	step2.Status = event.EventStatusSuccess
	step2.Duration = time.Since(txCtx.StartTime)
	step2.Payload["order_id"] = order.ID
	step2.Payload["phase"] = "after_create"
	s.eventManager.Record(ctx, step2)

	payment := &domain.Payment{
		OrderID: order.ID,
		UserID:  req.UserID,
		Amount:  order.Amount,
		Status:  domain.PaymentStatusPending,
	}

	step3 := event.Event{
		ID:            uuid.New().String(),
		TraceID:       traceID,
		CorrelationID: txCtx.CorrelationID,
		PreviousID:    step2.ID,
		Type:          event.EventTypePaymentSucceeded,
		Status:        event.EventStatusPending,
		Service:       "payment-service",
		Payload: map[string]interface{}{
			"order_id": order.ID,
			"amount":   order.Amount,
			"step":     "process_payment",
			"phase":    "before_payment",
		},
	}
	s.eventManager.Record(ctx, step3)

	if err := s.checkChaosInjection(ctx, traceID, "before_payment"); err != nil {
		order.Status = domain.OrderStatusFailed
		order.LastError = "chaos_injection_failed_during_payment"
		s.orderRepo.Update(ctx, order)
		s.triggerCompensation(ctx, txCtx, order, "chaos_injection_payment")
		return nil, err
	}

	if failurePoint == FailurePointPayment {
		step3.Status = event.EventStatusFailed
		step3.Error = "simulated payment failure"
		step3.Duration = time.Since(txCtx.StartTime)
		step3.Payload["phase"] = "failed"
		s.eventManager.Record(ctx, step3)

		order.Status = domain.OrderStatusFailed
		order.LastError = "simulated payment failure"
		s.orderRepo.Update(ctx, order)

		s.triggerCompensation(ctx, txCtx, order, "simulated_payment_failure")
		s.chaosState.SetOrderFailurePoint(FailurePointNone)

		return nil, errors.New("simulated failure: payment processing failed")
	}

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
	step3.Payload["payment_id"] = payment.ID
	step3.Payload["transaction_no"] = payment.TransactionNo
	step3.Payload["phase"] = "after_payment"
	s.eventManager.Record(ctx, step3)

	if failurePoint == FailurePointAfterPayment {
		failEvt := event.Event{
			ID:            uuid.New().String(),
			TraceID:       traceID,
			CorrelationID: txCtx.CorrelationID,
			PreviousID:    step3.ID,
			Type:          event.EventTypeOrderFailed,
			Status:        event.EventStatusFailed,
			Service:       "chaos-engine",
			Payload: map[string]interface{}{
				"reason":      "simulated_failure_after_payment",
				"description": "支付成功后流程中断",
				"impact":      "库存已扣、订单已创建、支付已成功，但后续流程中断",
				"payment_id":  payment.ID,
				"order_id":    order.ID,
			},
		}
		s.eventManager.Record(ctx, failEvt)

		order.Status = domain.OrderStatusFailed
		order.LastError = "simulated failure after payment"
		s.orderRepo.Update(ctx, order)

		s.triggerCompensation(ctx, txCtx, order, "failure_after_payment")
		s.chaosState.SetOrderFailurePoint(FailurePointNone)

		return nil, errors.New("simulated failure: post-payment processing failed")
	}

	order.PaymentID = payment.ID
	order.Status = domain.OrderStatusPaid
	s.orderRepo.Update(ctx, order)

	completeEvt := event.Event{
		ID:            uuid.New().String(),
		TraceID:       traceID,
		CorrelationID: txCtx.CorrelationID,
		PreviousID:    step3.ID,
		Type:          event.EventTypeOrderCreated,
		Status:        event.EventStatusSuccess,
		Service:       "order-service",
		Payload: map[string]interface{}{
			"order_id":     order.ID,
			"order_no":     order.OrderNo,
			"status":       "completed",
			"final_status": string(domain.OrderStatusPaid),
		},
	}
	s.eventManager.Record(ctx, completeEvt)

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
		MaxRetries:  5,
	}

	if err := s.compensationRepo.Create(ctx, task); err != nil {
		return
	}

	evt := event.Event{
		ID:            uuid.New().String(),
		TraceID:       txCtx.TraceID,
		CorrelationID: txCtx.CorrelationID,
		Type:          event.EventTypeCompensationStart,
		Status:        event.EventStatusPending,
		Service:       "compensation-service",
		Payload: map[string]interface{}{
			"compensation_id": compensationID,
			"order_id":        order.ID,
			"reason":          reason,
			"steps_count":     len(steps),
			"steps": []string{
				"1. refund_payment (退款)",
				"2. release_inventory (释放库存)",
				"3. cancel_order (取消订单)",
			},
		},
	}
	s.eventManager.Record(ctx, evt)

	go s.executeCompensation(ctx, txCtx, task, order)
}

func (s *OrderService) executeCompensation(ctx context.Context, txCtx *domain.TransactionContext, task *domain.CompensationTask, order *domain.Order) {
	compensationMode := s.chaosState.GetCompensationFailure()

	for task.CurrentStep < len(task.Steps) {
		step := &task.Steps[task.CurrentStep]
		step.Attempts++
		now := time.Now()
		step.ExecutedAt = &now

		var err error
		stepName := step.Name

		retryEvt := event.Event{
			ID:            uuid.New().String(),
			TraceID:       txCtx.TraceID,
			CorrelationID: txCtx.CorrelationID,
			Type:          event.EventTypeCompensationRetry,
			Status:        event.EventStatusRetrying,
			Service:       "compensation-service",
			Payload: map[string]interface{}{
				"compensation_id": task.ID,
				"step":            stepName,
				"step_index":      task.CurrentStep,
				"attempt":         step.Attempts,
				"max_retries":     task.MaxRetries,
				"total_retries":   task.RetryCount,
			},
		}
		s.eventManager.Record(ctx, retryEvt)

		shouldFail := false
		failReason := ""

		switch compensationMode {
		case CompensationFailureRefund:
			if stepName == "refund_payment" {
				shouldFail = true
				failReason = "chaos_injected: refund_payment_failure"
			}
		case CompensationFailureRelease:
			if stepName == "release_inventory" {
				shouldFail = true
				failReason = "chaos_injected: release_inventory_failure"
			}
		case CompensationFailureCancel:
			if stepName == "cancel_order" {
				shouldFail = true
				failReason = "chaos_injected: cancel_order_failure"
			}
		case CompensationFailureIntermittent:
			failCount := s.chaosState.IncrementCompensationFailCount()
			if failCount <= 3 {
				shouldFail = true
				failReason = fmt.Sprintf("chaos_injected: intermittent_failure_attempt_%d", failCount)
			}
		}

		if shouldFail {
			err = errors.New(failReason)
		} else {
			switch stepName {
			case "refund_payment":
				err = s.compensatePayment(ctx, order)
			case "release_inventory":
				err = s.compensateInventory(ctx, order)
			case "cancel_order":
				err = s.compensateOrder(ctx, order)
			}
		}

		if err != nil {
			step.LastError = err.Error()
			step.Status = domain.CompensationStatusFailed
			task.RetryCount++

			availableAfter, _ := s.inventoryRepo.GetAvailable(ctx, order.ProductID)
			reservedAfter, _ := s.inventoryRepo.GetReserved(ctx, order.ProductID)

			failStepEvt := event.Event{
				ID:            uuid.New().String(),
				TraceID:       txCtx.TraceID,
				CorrelationID: txCtx.CorrelationID,
				Type:          event.EventTypeCompensationRetry,
				Status:        event.EventStatusFailed,
				Service:       "compensation-service",
				Payload: map[string]interface{}{
					"compensation_id":   task.ID,
					"step":              stepName,
					"attempt":           step.Attempts,
					"error":             err.Error(),
					"retry_count":       task.RetryCount,
					"remaining_retries": task.MaxRetries - task.RetryCount,
					"inventory_state": map[string]interface{}{
						"available": availableAfter,
						"reserved":  reservedAfter,
					},
					"impact": "库存仍处于锁定状态，数据不一致",
				},
			}
			s.eventManager.Record(ctx, failStepEvt)

			if task.RetryCount >= task.MaxRetries {
				task.Status = domain.CompensationStatusFailed
				task.LastError = fmt.Sprintf("compensation failed at step %s: %v", stepName, err)
				s.compensationRepo.Update(ctx, task)

				availableFinal, _ := s.inventoryRepo.GetAvailable(ctx, order.ProductID)
				reservedFinal, _ := s.inventoryRepo.GetReserved(ctx, order.ProductID)

				failEvt := event.Event{
					ID:            uuid.New().String(),
					TraceID:       txCtx.TraceID,
					CorrelationID: txCtx.CorrelationID,
					Type:          event.EventTypeCompensationFailed,
					Status:        event.EventStatusFailed,
					Service:       "compensation-service",
					Payload: map[string]interface{}{
						"compensation_id": task.ID,
						"failed_step":     stepName,
						"error":           err.Error(),
						"total_retries":   task.RetryCount,
						"max_retries":     task.MaxRetries,
						"final_inventory_state": map[string]interface{}{
							"available": availableFinal,
							"reserved":  reservedFinal,
						},
						"conclusion": "补偿彻底失败，数据不一致，需要人工介入",
						"action_required": []string{
							"检查库存状态",
							"手动释放锁定的库存",
							"检查支付状态",
							"手动退款（如需要）",
							"取消订单",
						},
					},
				}
				s.eventManager.Record(ctx, failEvt)

				s.chaosState.SetCompensationFailure(CompensationFailureNone)
				return
			}

			task.Status = domain.CompensationStatusRetrying
			nextRetry := time.Now().Add(time.Duration(task.RetryCount) * 5 * time.Second)
			task.NextRetryAt = &nextRetry
			s.compensationRepo.Update(ctx, task)

			waitingEvt := event.Event{
				ID:            uuid.New().String(),
				TraceID:       txCtx.TraceID,
				CorrelationID: txCtx.CorrelationID,
				Type:          event.EventTypeCompensationRetry,
				Status:        event.EventStatusPending,
				Service:       "compensation-service",
				Payload: map[string]interface{}{
					"compensation_id": task.ID,
					"waiting_for":     "next_retry",
					"next_retry_at":   nextRetry.Format(time.RFC3339),
					"delay_seconds":   task.RetryCount * 5,
					"message":         fmt.Sprintf("等待 %d 秒后进行第 %d 次重试", task.RetryCount*5, task.RetryCount+1),
				},
			}
			s.eventManager.Record(ctx, waitingEvt)

			time.Sleep(time.Duration(task.RetryCount) * 5 * time.Second)
			continue
		}

		step.Status = domain.CompensationStatusSuccess
		task.CurrentStep++
		s.compensationRepo.Update(ctx, task)

		successStepEvt := event.Event{
			ID:            uuid.New().String(),
			TraceID:       txCtx.TraceID,
			CorrelationID: txCtx.CorrelationID,
			Type:          event.EventTypeCompensationRetry,
			Status:        event.EventStatusSuccess,
			Service:       "compensation-service",
			Payload: map[string]interface{}{
				"compensation_id": task.ID,
				"step":            stepName,
				"step_index":      task.CurrentStep - 1,
				"attempts":        step.Attempts,
				"status":          "completed",
			},
		}
		s.eventManager.Record(ctx, successStepEvt)
	}

	task.Status = domain.CompensationStatusSuccess
	s.compensationRepo.Update(ctx, task)

	availableFinal, _ := s.inventoryRepo.GetAvailable(ctx, order.ProductID)
	reservedFinal, _ := s.inventoryRepo.GetReserved(ctx, order.ProductID)

	successEvt := event.Event{
		ID:            uuid.New().String(),
		TraceID:       txCtx.TraceID,
		CorrelationID: txCtx.CorrelationID,
		Type:          event.EventTypeCompensationSuccess,
		Status:        event.EventStatusSuccess,
		Service:       "compensation-service",
		Payload: map[string]interface{}{
			"compensation_id": task.ID,
			"steps_completed": len(task.Steps),
			"total_retries":   task.RetryCount,
			"final_inventory_state": map[string]interface{}{
				"available": availableFinal,
				"reserved":  reservedFinal,
			},
			"conclusion": "补偿成功，数据一致性已恢复",
		},
	}
	s.eventManager.Record(ctx, successEvt)

	s.chaosState.SetCompensationFailure(CompensationFailureNone)
}

func (s *OrderService) compensatePayment(ctx context.Context, order *domain.Order) error {
	if order.PaymentID == 0 {
		evt := event.Event{
			ID:            uuid.New().String(),
			TraceID:       order.OrderNo,
			CorrelationID: order.OrderNo,
			Type:          "compensation_step_skipped",
			Status:        event.EventStatusSuccess,
			Service:       "compensation-service",
			Payload: map[string]interface{}{
				"step":        "refund_payment",
				"reason":      "no_payment_record",
				"description": "订单没有支付记录，跳过退款步骤",
			},
		}
		s.eventManager.Record(ctx, evt)
		return nil
	}

	payment, err := s.paymentRepo.GetByOrderID(ctx, order.ID)
	if err != nil {
		evt := event.Event{
			ID:            uuid.New().String(),
			TraceID:       order.OrderNo,
			CorrelationID: order.OrderNo,
			Type:          "compensation_step_skipped",
			Status:        event.EventStatusSuccess,
			Service:       "compensation-service",
			Payload: map[string]interface{}{
				"step":        "refund_payment",
				"reason":      "payment_not_found",
				"description": "支付记录不存在，跳过退款步骤",
				"error":       err.Error(),
			},
		}
		s.eventManager.Record(ctx, evt)
		return nil
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

	if len(events) == 0 {
		return errors.New("no events found for replay")
	}

	replayStartTime := time.Now()

	for i, evt := range events {
		replayEvt := event.Event{
			ID:            uuid.New().String(),
			TraceID:       fmt.Sprintf("replay-%s", traceID),
			CorrelationID: evt.CorrelationID,
			Type:          evt.Type,
			Status:        event.EventStatusPending,
			Service:       "replay-service",
			Payload: map[string]interface{}{
				"original_event_id": evt.ID,
				"original_status":   evt.Status,
				"original_service":  evt.Service,
				"original_payload":  evt.Payload,
				"replay_mode":       true,
				"replay_phase":      "replaying",
				"replay_sequence":   i + 1,
				"total_events":      len(events),
			},
		}
		s.eventManager.Record(ctx, replayEvt)

		if err := s.replaySingleEvent(ctx, evt, replayEvt.TraceID); err != nil {
			replayEvt.Status = event.EventStatusFailed
			replayEvt.Error = err.Error()
			replayEvt.Payload["replay_phase"] = "failed"
			s.eventManager.Record(ctx, replayEvt)
			return fmt.Errorf("replay failed at event %d: %w", i+1, err)
		}

		replayEvt.Status = event.EventStatusSuccess
		replayEvt.Payload["replay_phase"] = "completed"
		s.eventManager.Record(ctx, replayEvt)

		time.Sleep(300 * time.Millisecond)
	}

	completeEvt := event.Event{
		ID:            uuid.New().String(),
		TraceID:       fmt.Sprintf("replay-%s", traceID),
		CorrelationID: events[0].CorrelationID,
		Type:          "replay_complete",
		Status:        event.EventStatusSuccess,
		Service:       "replay-service",
		Payload: map[string]interface{}{
			"original_trace_id":  traceID,
			"total_replayed":     len(events),
			"replay_duration_ms": time.Since(replayStartTime).Milliseconds(),
			"status":             "completed",
			"message":            "事件回放完成，系统状态已按事件序列恢复",
		},
	}
	s.eventManager.Record(ctx, completeEvt)

	return nil
}

func getInt64FromPayload(payload map[string]interface{}, key string) (int64, bool) {
	if payload == nil {
		return 0, false
	}

	val, ok := payload[key]
	if !ok || val == nil {
		return 0, false
	}

	switch v := val.(type) {
	case float64:
		return int64(v), true
	case int64:
		return v, true
	case int:
		return int64(v), true
	case uint:
		return int64(v), true
	case uint64:
		return int64(v), true
	default:
		return 0, false
	}
}

func getIntFromPayload(payload map[string]interface{}, key string) (int, bool) {
	if payload == nil {
		return 0, false
	}

	val, ok := payload[key]
	if !ok || val == nil {
		return 0, false
	}

	switch v := val.(type) {
	case float64:
		return int(v), true
	case int64:
		return int(v), true
	case int:
		return v, true
	case uint:
		return int(v), true
	case uint64:
		return int(v), true
	default:
		return 0, false
	}
}

func getFloat64FromPayload(payload map[string]interface{}, key string) (float64, bool) {
	if payload == nil {
		return 0, false
	}

	val, ok := payload[key]
	if !ok || val == nil {
		return 0, false
	}

	switch v := val.(type) {
	case float64:
		return v, true
	case int64:
		return float64(v), true
	case int:
		return float64(v), true
	default:
		return 0, false
	}
}

func getStringFromPayload(payload map[string]interface{}, key string) (string, bool) {
	if payload == nil {
		return "", false
	}

	val, ok := payload[key]
	if !ok || val == nil {
		return "", false
	}

	switch v := val.(type) {
	case string:
		return v, true
	default:
		return fmt.Sprintf("%v", v), true
	}
}

func (s *OrderService) replaySingleEvent(ctx context.Context, evt event.Event, replayTraceID string) error {
	payload := evt.Payload
	if payload == nil {
		return nil
	}

	switch evt.Type {
	case event.EventTypeInventoryReserved:
		if evt.Status == event.EventStatusSuccess && payload["status"] == "inventory_deducted" {
			productID, ok1 := getInt64FromPayload(payload, "product_id")
			quantity, ok2 := getIntFromPayload(payload, "quantity")
			if ok1 && ok2 && productID > 0 && quantity > 0 {
				err := s.inventoryRepo.Reserve(ctx, productID, quantity)
				if err != nil {
					return fmt.Errorf("replay reserve inventory failed: %w", err)
				}
				s.recordReplayEvent(ctx, replayTraceID, "inventory_reserved_replayed", map[string]interface{}{
					"product_id": productID,
					"quantity":   quantity,
					"action":     "replay_reserve",
				})
			}
		}

	case event.EventTypeInventoryReleased:
		if evt.Status == event.EventStatusSuccess {
			productID, ok1 := getInt64FromPayload(payload, "product_id")
			quantity, ok2 := getIntFromPayload(payload, "quantity")
			if ok1 && ok2 && productID > 0 && quantity > 0 {
				err := s.inventoryRepo.Release(ctx, productID, quantity)
				if err != nil {
					return fmt.Errorf("replay release inventory failed: %w", err)
				}
				s.recordReplayEvent(ctx, replayTraceID, "inventory_released_replayed", map[string]interface{}{
					"product_id": productID,
					"quantity":   quantity,
					"action":     "replay_release",
				})
			}
		}

	case event.EventTypeOrderCreated:
		if evt.Status == event.EventStatusSuccess {
			orderNo, ok1 := getStringFromPayload(payload, "order_no")
			userID, ok2 := getInt64FromPayload(payload, "user_id")
			productID, ok3 := getInt64FromPayload(payload, "product_id")
			quantity, ok4 := getIntFromPayload(payload, "quantity")
			amount, ok5 := getFloat64FromPayload(payload, "amount")

			if ok1 && orderNo != "" {
				existing, _ := s.orderRepo.GetByOrderNo(ctx, orderNo)
				if existing == nil {
					order := &domain.Order{
						OrderNo:   orderNo,
						UserID:    userID,
						ProductID: productID,
						Quantity:  quantity,
						Amount:    amount,
						Status:    domain.OrderStatusPending,
					}
					err := s.orderRepo.Create(ctx, order)
					if err != nil {
						return fmt.Errorf("replay create order failed: %w", err)
					}
					s.recordReplayEvent(ctx, replayTraceID, "order_created_replayed", map[string]interface{}{
						"order_no":       orderNo,
						"order_id":       order.ID,
						"user_id":        order.UserID,
						"product_id":     order.ProductID,
						"quantity":       order.Quantity,
						"amount":         order.Amount,
						"has_user_id":    ok2,
						"has_product_id": ok3,
						"has_quantity":   ok4,
						"has_amount":     ok5,
						"action":         "replay_create_order",
					})
				}
			}
		}

	case event.EventTypePaymentSucceeded:
		if evt.Status == event.EventStatusSuccess {
			orderID, ok1 := getInt64FromPayload(payload, "order_id")
			amount, ok2 := getFloat64FromPayload(payload, "amount")
			if ok1 && orderID > 0 {
				existing, _ := s.paymentRepo.GetByOrderID(ctx, orderID)
				if existing == nil {
					payment := &domain.Payment{
						OrderID:       orderID,
						Amount:        amount,
						Status:        domain.PaymentStatusSuccess,
						TransactionNo: "replay-" + uuid.New().String(),
					}
					err := s.paymentRepo.Create(ctx, payment)
					if err != nil {
						return fmt.Errorf("replay payment failed: %w", err)
					}

					order, _ := s.orderRepo.GetByID(ctx, orderID)
					if order != nil {
						order.PaymentID = payment.ID
						order.Status = domain.OrderStatusPaid
						s.orderRepo.Update(ctx, order)
					}

					s.recordReplayEvent(ctx, replayTraceID, "payment_replayed", map[string]interface{}{
						"order_id":   orderID,
						"payment_id": payment.ID,
						"amount":     amount,
						"has_amount": ok2,
						"action":     "replay_payment",
					})
				}
			}
		}

	case event.EventTypeOrderFailed:
		if evt.Status == event.EventStatusFailed {
			orderID, ok := getInt64FromPayload(payload, "order_id")
			if ok && orderID > 0 {
				order, _ := s.orderRepo.GetByID(ctx, orderID)
				if order != nil {
					order.Status = domain.OrderStatusFailed
					errMsg, hasErr := getStringFromPayload(payload, "error")
					if hasErr && errMsg != "" {
						order.LastError = errMsg
					} else {
						order.LastError = "replay_failed"
					}
					s.orderRepo.Update(ctx, order)
					s.recordReplayEvent(ctx, replayTraceID, "order_failed_replayed", map[string]interface{}{
						"order_id": orderID,
						"error":    order.LastError,
						"action":   "replay_failed_order",
					})
				}
			}
		}

	case event.EventTypeCompensationStart:
		orderID, ok := getInt64FromPayload(payload, "order_id")
		if ok && orderID > 0 {
			order, _ := s.orderRepo.GetByID(ctx, orderID)
			if order != nil {
				order.Status = domain.OrderStatusCompensating
				s.orderRepo.Update(ctx, order)
			}
		}

	case event.EventTypeCompensationSuccess:
		orderID, ok := getInt64FromPayload(payload, "order_id")
		if ok && orderID > 0 {
			order, _ := s.orderRepo.GetByID(ctx, orderID)
			if order != nil {
				order.Status = domain.OrderStatusCancelled
				s.orderRepo.Update(ctx, order)
			}
		}
	}

	return nil
}

func (s *OrderService) recordReplayEvent(ctx context.Context, replayTraceID string, eventType string, data map[string]interface{}) {
	evt := event.Event{
		ID:            uuid.New().String(),
		TraceID:       replayTraceID,
		CorrelationID: replayTraceID,
		Type:          event.EventType(eventType),
		Status:        event.EventStatusSuccess,
		Service:       "replay-service",
		Payload:       data,
	}
	s.eventManager.Record(ctx, evt)
}

func (s *OrderService) GetFullStatus() map[string]interface{} {
	s.chaosState.Mu.RLock()
	defer s.chaosState.Mu.RUnlock()

	return map[string]interface{}{
		"order_failure_point":     string(s.chaosState.OrderFailurePoint),
		"compensation_failure":    string(s.chaosState.CompensationFailure),
		"compensation_fail_count": s.chaosState.CompensationFailCount,
		"connection_pool": map[string]interface{}{
			"broken":          s.chaosState.ConnectionPoolBroken,
			"max_connections": s.chaosState.ConnectionPoolMax,
			"current":         s.chaosState.ConnectionPoolCurrent,
			"leaked_count":    len(s.chaosState.LeakedConnections),
		},
		"goroutine_leak": map[string]interface{}{
			"active": s.chaosState.GoroutineLeakActive,
			"leaked": s.chaosState.LeakedGoroutines,
		},
		"db_lock": map[string]interface{}{
			"waiting": s.chaosState.DBLockWaiting,
		},
		"cache": map[string]interface{}{
			"dirty":          s.chaosState.CacheDirty,
			"original_count": len(s.chaosState.CacheOriginalData),
			"dirty_count":    len(s.chaosState.CacheDirtyData),
		},
		"config": map[string]interface{}{
			"drifted":        s.chaosState.ConfigDrifted,
			"original_count": len(s.chaosState.OriginalConfigs),
			"drifted_count":  len(s.chaosState.DriftedConfigs),
		},
		"message_backlog": map[string]interface{}{
			"active":    s.chaosState.MessageBacklogActive,
			"queue_len": len(s.chaosState.BacklogQueue),
		},
	}
}
