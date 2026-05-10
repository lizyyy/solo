package service

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"gorm.io/gorm"

	"chaos-payment/internal/cache"
	"chaos-payment/internal/config"
	"chaos-payment/internal/eventbus"
	"chaos-payment/internal/models"
)

type OrderService struct {
	db           *gorm.DB
	cache        *cache.Cache
	bus          *eventbus.EventBus
	stateManager *eventbus.StateManager
	chaosEngine  *ChaosEngine
	mu           sync.RWMutex
}

func NewOrderService(db *gorm.DB, c *cache.Cache, bus *eventbus.EventBus, chaos *ChaosEngine) *OrderService {
	return &OrderService{
		db:           db,
		cache:        c,
		bus:          bus,
		stateManager: eventbus.NewStateManager(db, 5*time.Minute),
		chaosEngine:  chaos,
	}
}

func (s *OrderService) CreateOrder(ctx context.Context, amount float64, paymentMethod string) (*models.Order, error) {
	if amount <= 0 {
		cfg := config.Get()
		amount = cfg.Order.DefaultAmount
	}

	order := &models.Order{
		Amount:        amount,
		Status:        models.OrderStatusPending,
		PaymentMethod: paymentMethod,
		CallbackCount: 0,
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}

	if err := tx.Create(order).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	s.bus.Publish(eventbus.EventTypeOrderCreated, order.ID, "order", nil, order, "order-service")

	callbacks := make([]models.PaymentCallback, 0)
	if err := s.stateManager.CreateOrderSnapshot(order, callbacks); err != nil {
		fmt.Printf("[OrderService] Failed to create snapshot: %v\n", err)
	}

	if s.cache != nil {
		s.cache.SetOrder(ctx, order, 5*time.Minute)
	}

	return order, nil
}

func (s *OrderService) GetOrder(ctx context.Context, orderID string) (*models.Order, error) {
	if s.cache != nil {
		if cachedOrder, err := s.cache.GetOrder(ctx, orderID); err == nil {
			return cachedOrder, nil
		}
	}

	var order models.Order
	if err := s.db.Where("id = ?", orderID).First(&order).Error; err != nil {
		return nil, err
	}

	if s.cache != nil {
		s.cache.SetOrder(ctx, &order, 5*time.Minute)
	}

	return &order, nil
}

func (s *OrderService) ListOrders(ctx context.Context, limit, offset int) ([]models.Order, int64, error) {
	var orders []models.Order
	var total int64

	if err := s.db.Model(&models.Order{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := s.db.Order("created_at DESC").Limit(limit).Offset(offset).Find(&orders).Error; err != nil {
		return nil, 0, err
	}

	return orders, total, nil
}

func (s *OrderService) UpdateOrderStatus(ctx context.Context, orderID string, newStatus models.OrderStatus) error {
	order, err := s.GetOrder(ctx, orderID)
	if err != nil {
		return err
	}

	oldStatus := order.Status

	tx := s.db.Begin()
	if tx.Error != nil {
		return tx.Error
	}

	if err := tx.Model(&models.Order{}).Where("id = ?", orderID).Update("status", newStatus).Error; err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Commit().Error; err != nil {
		return err
	}

	order.Status = newStatus

	s.bus.Publish(eventbus.EventTypeOrderStatusChanged, orderID, "order",
		map[string]interface{}{"old_status": oldStatus},
		map[string]interface{}{"new_status": newStatus},
		"order-service")

	if s.cache != nil {
		s.cache.SetOrder(ctx, order, 5*time.Minute)
	}

	callbacks, _ := s.GetCallbacks(ctx, orderID)
	s.stateManager.CreateOrderSnapshot(order, callbacks)

	return nil
}

func (s *OrderService) GetCallbacks(ctx context.Context, orderID string) ([]models.PaymentCallback, error) {
	var callbacks []models.PaymentCallback
	err := s.db.Where("order_id = ?", orderID).Order("created_at ASC").Find(&callbacks).Error
	return callbacks, err
}

type PaymentCallbackRequest struct {
	OrderID       string  `json:"order_id"`
	TransactionID string  `json:"transaction_id"`
	Amount        float64 `json:"amount"`
	Status        string  `json:"status"`
	RawData       string  `json:"raw_data"`
}

func (s *OrderService) ProcessPaymentCallback(ctx context.Context, req PaymentCallbackRequest) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	order, err := s.GetOrder(ctx, req.OrderID)
	if err != nil {
		return fmt.Errorf("order not found: %w", err)
	}

	err = s.db.Where("transaction_id = ?", req.TransactionID).First(&models.PaymentCallback{}).Error
	isDuplicate := err == nil

	callback := &models.PaymentCallback{
		OrderID:       req.OrderID,
		TransactionID: req.TransactionID,
		Amount:        req.Amount,
		Status:        req.Status,
		RawData:       req.RawData,
		IsDuplicate:   isDuplicate,
		ProcessedAt:   time.Now(),
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return tx.Error
	}

	if err := tx.Create(callback).Error; err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Model(&models.Order{}).Where("id = ?", req.OrderID).
		Update("callback_count", gorm.Expr("callback_count + 1")).
		Update("last_callback_at", time.Now()).Error; err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Commit().Error; err != nil {
		return err
	}

	eventType := eventbus.EventTypePaymentCallback
	if isDuplicate {
		eventType = eventbus.EventTypeDuplicateCallback
	}

	s.bus.Publish(eventType, req.OrderID, "payment_callback", nil, map[string]interface{}{
		"transaction_id": req.TransactionID,
		"amount":         req.Amount,
		"status":         req.Status,
		"is_duplicate":   isDuplicate,
	}, "payment-gateway")

	order.CallbackCount++
	now := time.Now()
	order.LastCallbackAt = &now

	if !isDuplicate {
		if req.Status == "SUCCESS" {
			s.UpdateOrderStatus(ctx, req.OrderID, models.OrderStatusSuccess)
		} else if req.Status == "FAILED" {
			s.UpdateOrderStatus(ctx, req.OrderID, models.OrderStatusFailed)
		}
	} else {
		s.bus.Publish(eventbus.EventTypeChaosInjected, req.OrderID, "order", nil, map[string]interface{}{
			"type":        "duplicate_callback",
			"description": fmt.Sprintf("重复回调检测: 交易ID %s 已存在", req.TransactionID),
		}, "chaos-engine")
	}

	callbacks, _ := s.GetCallbacks(ctx, req.OrderID)
	s.stateManager.CreateOrderSnapshot(order, callbacks)

	if s.cache != nil {
		s.cache.SetOrder(ctx, order, 5*time.Minute)
	}

	return nil
}

func (s *OrderService) SimulateDuplicateCallback(ctx context.Context, orderID string) error {
	order, err := s.GetOrder(ctx, orderID)
	if err != nil {
		return err
	}

	transactionID := fmt.Sprintf("txn_%s_%d", orderID, rand.Int63())
	firstCallback := PaymentCallbackRequest{
		OrderID:       orderID,
		TransactionID: transactionID,
		Amount:        order.Amount,
		Status:        "SUCCESS",
		RawData:       fmt.Sprintf(`{"order_id":"%s","amount":%.2f,"status":"SUCCESS"}`, orderID, order.Amount),
	}

	if err := s.ProcessPaymentCallback(ctx, firstCallback); err != nil {
		return fmt.Errorf("first callback failed: %w", err)
	}

	cfg := config.Get()
	delay := time.Duration(cfg.Order.DuplicateCallbackDelay) * time.Millisecond

	go func() {
		time.Sleep(delay)

		ctx2 := context.Background()
		duplicateCallback := PaymentCallbackRequest{
			OrderID:       orderID,
			TransactionID: transactionID,
			Amount:        order.Amount,
			Status:        "SUCCESS",
			RawData:       fmt.Sprintf(`{"order_id":"%s","amount":%.2f,"status":"SUCCESS"}`, orderID, order.Amount),
		}

		if err := s.ProcessPaymentCallback(ctx2, duplicateCallback); err != nil {
			fmt.Printf("[OrderService] Duplicate callback error: %v\n", err)
		}
	}()

	return nil
}

func (s *OrderService) VerifyOrderConsistency(ctx context.Context, orderID string) (bool, string, error) {
	order, err := s.GetOrder(ctx, orderID)
	if err != nil {
		return false, "", err
	}

	callbacks, err := s.GetCallbacks(ctx, orderID)
	if err != nil {
		return false, "", err
	}

	var uniqueSuccessAmount float64
	seenTransactions := make(map[string]bool)

	for _, cb := range callbacks {
		if cb.Status == "SUCCESS" && !seenTransactions[cb.TransactionID] {
			uniqueSuccessAmount += cb.Amount
			seenTransactions[cb.TransactionID] = true
		}
	}

	if uniqueSuccessAmount == order.Amount {
		return true, "订单金额与成功交易金额一致", nil
	}

	details := fmt.Sprintf("订单金额: %.2f, 唯一成功交易金额: %.2f, 差异: %.2f",
		order.Amount, uniqueSuccessAmount, order.Amount-uniqueSuccessAmount)

	return false, details, errors.New("订单状态不一致")
}

func (s *OrderService) GetStateManager() *eventbus.StateManager {
	return s.stateManager
}
