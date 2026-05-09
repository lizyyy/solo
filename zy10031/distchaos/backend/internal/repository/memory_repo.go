package repository

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	
	"distchaos/internal/domain"
)

type MemoryInventoryRepo struct {
	mu         sync.RWMutex
	inventories map[int64]*domain.Inventory
	nextID      int64
}

func NewMemoryInventoryRepo() *MemoryInventoryRepo {
	repo := &MemoryInventoryRepo{
		inventories: make(map[int64]*domain.Inventory),
		nextID:      1,
	}
	
	repo.inventories[1] = &domain.Inventory{
		ID:           1,
		ProductID:    1,
		AvailableQty: 100,
		ReservedQty:  0,
		Version:      1,
	}
	
	return repo
}

func (r *MemoryInventoryRepo) Reserve(ctx context.Context, productID int64, quantity int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	inv, exists := r.inventories[productID]
	if !exists {
		return errors.New("inventory not found")
	}
	
	if inv.AvailableQty < quantity {
		return errors.New("insufficient inventory")
	}
	
	inv.AvailableQty -= quantity
	inv.ReservedQty += quantity
	inv.Version++
	
	return nil
}

func (r *MemoryInventoryRepo) Release(ctx context.Context, productID int64, quantity int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	inv, exists := r.inventories[productID]
	if !exists {
		return errors.New("inventory not found")
	}
	
	if inv.ReservedQty < quantity {
		return errors.New("reserved quantity insufficient")
	}
	
	inv.ReservedQty -= quantity
	inv.AvailableQty += quantity
	inv.Version++
	
	return nil
}

func (r *MemoryInventoryRepo) GetAvailable(ctx context.Context, productID int64) (int, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	inv, exists := r.inventories[productID]
	if !exists {
		return 0, errors.New("inventory not found")
	}
	
	return inv.AvailableQty, nil
}

type MemoryOrderRepo struct {
	mu      sync.RWMutex
	orders  map[int64]*domain.Order
	byOrderNo map[string]*domain.Order
	nextID   int64
}

func NewMemoryOrderRepo() *MemoryOrderRepo {
	return &MemoryOrderRepo{
		orders:    make(map[int64]*domain.Order),
		byOrderNo: make(map[string]*domain.Order),
		nextID:    1,
	}
}

func (r *MemoryOrderRepo) Create(ctx context.Context, order *domain.Order) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	order.ID = atomic.AddInt64(&r.nextID, 1) - 1
	r.orders[order.ID] = order
	r.byOrderNo[order.OrderNo] = order
	
	return nil
}

func (r *MemoryOrderRepo) Update(ctx context.Context, order *domain.Order) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	if _, exists := r.orders[order.ID]; !exists {
		return errors.New("order not found")
	}
	
	r.orders[order.ID] = order
	return nil
}

func (r *MemoryOrderRepo) GetByID(ctx context.Context, id int64) (*domain.Order, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	order, exists := r.orders[id]
	if !exists {
		return nil, errors.New("order not found")
	}
	
	return order, nil
}

func (r *MemoryOrderRepo) GetByOrderNo(ctx context.Context, orderNo string) (*domain.Order, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	order, exists := r.byOrderNo[orderNo]
	if !exists {
		return nil, errors.New("order not found")
	}
	
	return order, nil
}

func (r *MemoryOrderRepo) GetPendingCompensation(ctx context.Context) ([]*domain.Order, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	result := make([]*domain.Order, 0)
	for _, order := range r.orders {
		if order.Status == domain.OrderStatusCompensating {
			result = append(result, order)
		}
	}
	
	return result, nil
}

type MemoryPaymentRepo struct {
	mu       sync.RWMutex
	payments map[int64]*domain.Payment
	byOrderID map[int64]*domain.Payment
	nextID    int64
}

func NewMemoryPaymentRepo() *MemoryPaymentRepo {
	return &MemoryPaymentRepo{
		payments:  make(map[int64]*domain.Payment),
		byOrderID: make(map[int64]*domain.Payment),
		nextID:    1,
	}
}

func (r *MemoryPaymentRepo) Create(ctx context.Context, payment *domain.Payment) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	payment.ID = atomic.AddInt64(&r.nextID, 1) - 1
	r.payments[payment.ID] = payment
	r.byOrderID[payment.OrderID] = payment
	
	return nil
}

func (r *MemoryPaymentRepo) Update(ctx context.Context, payment *domain.Payment) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	if _, exists := r.payments[payment.ID]; !exists {
		return errors.New("payment not found")
	}
	
	r.payments[payment.ID] = payment
	return nil
}

func (r *MemoryPaymentRepo) GetByOrderID(ctx context.Context, orderID int64) (*domain.Payment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	payment, exists := r.byOrderID[orderID]
	if !exists {
		return nil, errors.New("payment not found")
	}
	
	return payment, nil
}

func (r *MemoryPaymentRepo) Refund(ctx context.Context, payment *domain.Payment) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	payment.Status = domain.PaymentStatusRefunded
	r.payments[payment.ID] = payment
	
	return nil
}

type MemoryCompensationRepo struct {
	mu    sync.RWMutex
	tasks map[string]*domain.CompensationTask
}

func NewMemoryCompensationRepo() *MemoryCompensationRepo {
	return &MemoryCompensationRepo{
		tasks: make(map[string]*domain.CompensationTask),
	}
}

func (r *MemoryCompensationRepo) Create(ctx context.Context, task *domain.CompensationTask) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	r.tasks[task.ID] = task
	return nil
}

func (r *MemoryCompensationRepo) Update(ctx context.Context, task *domain.CompensationTask) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	if _, exists := r.tasks[task.ID]; !exists {
		return errors.New("compensation task not found")
	}
	
	r.tasks[task.ID] = task
	return nil
}

func (r *MemoryCompensationRepo) GetByID(ctx context.Context, id string) (*domain.CompensationTask, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	task, exists := r.tasks[id]
	if !exists {
		return nil, errors.New("compensation task not found")
	}
	
	return task, nil
}

func (r *MemoryCompensationRepo) GetPending(ctx context.Context) ([]*domain.CompensationTask, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	result := make([]*domain.CompensationTask, 0)
	for _, task := range r.tasks {
		if task.Status == domain.CompensationStatusPending || 
		   task.Status == domain.CompensationStatusRetrying ||
		   task.Status == domain.CompensationStatusRunning {
			result = append(result, task)
		}
	}
	
	return result, nil
}

type FlakyInventoryRepo struct {
	base       *MemoryInventoryRepo
	failMode   string
	failCount  int
	mu         sync.Mutex
}

func NewFlakyInventoryRepo(base *MemoryInventoryRepo, failMode string) *FlakyInventoryRepo {
	return &FlakyInventoryRepo{
		base:     base,
		failMode: failMode,
	}
}

func (r *FlakyInventoryRepo) Reserve(ctx context.Context, productID int64, quantity int) error {
	return r.base.Reserve(ctx, productID, quantity)
}

func (r *FlakyInventoryRepo) Release(ctx context.Context, productID int64, quantity int) error {
	r.mu.Lock()
	r.failCount++
	count := r.failCount
	r.mu.Unlock()
	
	if r.failMode == "always_fail" {
		return errors.New("simulated release failure")
	}
	
	if r.failMode == "intermittent" && count%3 != 0 {
		return fmt.Errorf("simulated intermittent failure (attempt %d)", count)
	}
	
	return r.base.Release(ctx, productID, quantity)
}

func (r *FlakyInventoryRepo) GetAvailable(ctx context.Context, productID int64) (int, error) {
	return r.base.GetAvailable(ctx, productID)
}
