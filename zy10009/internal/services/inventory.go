package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"chaos-demo/internal/eventstore"
	"chaos-demo/internal/types"
)

type InventoryService struct {
	db         *pgxpool.Pool
	redis      *redis.Client
	eventStore *eventstore.EventStore
	chaos      *ChaosService

	stocksMu sync.RWMutex
	stocks   map[string]*types.Stock

	cacheHits   int64
	cacheMisses int64
}

func NewInventoryService(db *pgxpool.Pool, redis *redis.Client, eventStore *eventstore.EventStore, chaos *ChaosService) *InventoryService {
	return &InventoryService{
		db:         db,
		redis:      redis,
		eventStore: eventStore,
		chaos:      chaos,
		stocks:     make(map[string]*types.Stock),
	}
}

func (s *InventoryService) DeductStock(ctx context.Context, productID string, quantity int) (bool, error) {
	start := time.Now()

	s.eventStore.Append(types.Event{
		ID:        uuid.New(),
		Type:      types.EventTypeStateChange,
		Status:    types.EventStatusPending,
		ProductID: &productID,
		Payload: map[string]interface{}{
			"action":   "deduct_stock_start",
			"quantity": quantity,
		},
		Timestamp: time.Now(),
	})

	if s.chaos.ShouldInjectDBLockWait() {
		s.eventStore.Append(types.Event{
			ID:        uuid.New(),
			Type:      types.EventTypeDBLockWait,
			Status:    types.EventStatusPending,
			ProductID: &productID,
			Payload: map[string]interface{}{
				"message": "Database lock wait injected",
			},
			Timestamp: time.Now(),
		})
		lockDuration := time.Duration(s.chaos.config.DBLockWait.LockTimeoutMs) * time.Millisecond
		time.Sleep(lockDuration)
	}

	s.stocksMu.Lock()
	defer s.stocksMu.Unlock()

	stock, exists := s.stocks[productID]
	if !exists {
		return false, errors.New("product not found")
	}

	available := stock.Quantity - stock.Reserved
	if available < quantity {
		duration := time.Since(start).Milliseconds()
		s.eventStore.Append(types.Event{
			ID:        uuid.New(),
			Type:      types.EventTypeStockDeducted,
			Status:    types.EventStatusFailed,
			ProductID: &productID,
			Payload: map[string]interface{}{
				"available": available,
				"requested": quantity,
				"error":     "insufficient stock",
			},
			Timestamp: time.Now(),
			Duration:  &duration,
		})
		return false, errors.New("insufficient stock")
	}

	stock.Reserved += quantity
	stock.Version++
	stock.UpdatedAt = time.Now()

	s.updateCache(productID, stock)

	duration := time.Since(start).Milliseconds()
	s.eventStore.Append(types.Event{
		ID:        uuid.New(),
		Type:      types.EventTypeStockDeducted,
		Status:    types.EventStatusSuccess,
		ProductID: &productID,
		Payload: map[string]interface{}{
			"quantity":       quantity,
			"remaining":      stock.Quantity - stock.Reserved,
			"version":        stock.Version,
			"cache_hit_rate": s.getCacheHitRate(),
		},
		Timestamp: time.Now(),
		Duration:  &duration,
	})

	return true, nil
}

func (s *InventoryService) RollbackStock(ctx context.Context, productID string, quantity int) error {
	start := time.Now()

	s.eventStore.Append(types.Event{
		ID:        uuid.New(),
		Type:      types.EventTypeCompensationStarted,
		Status:    types.EventStatusPending,
		ProductID: &productID,
		Payload: map[string]interface{}{
			"action":   "rollback_stock_start",
			"quantity": quantity,
		},
		Timestamp: time.Now(),
	})

	if s.chaos.ShouldInjectGoroutineLeak() {
		s.eventStore.Append(types.Event{
			ID:        uuid.New(),
			Type:      types.EventTypeGoroutineLeak,
			Status:    types.EventStatusPending,
			ProductID: &productID,
			Payload: map[string]interface{}{
				"message": "Goroutine leak injected during rollback",
			},
			Timestamp: time.Now(),
		})
		go func() {
			select {}
		}()
	}

	if s.chaos.ShouldCompensationFail() {
		errMsg := "compensation failed due to chaos injection"
		duration := time.Since(start).Milliseconds()
		s.eventStore.Append(types.Event{
			ID:        uuid.New(),
			Type:      types.EventTypeCompensationFailed,
			Status:    types.EventStatusFailed,
			ProductID: &productID,
			Payload: map[string]interface{}{
				"quantity": quantity,
				"error":    errMsg,
			},
			Timestamp: time.Now(),
			Duration:  &duration,
			Error:     &errMsg,
		})
		return errors.New(errMsg)
	}

	s.stocksMu.Lock()
	defer s.stocksMu.Unlock()

	stock, exists := s.stocks[productID]
	if !exists {
		return errors.New("product not found")
	}

	if stock.Reserved < quantity {
		return errors.New("nothing to rollback")
	}

	stock.Reserved -= quantity
	stock.Version++
	stock.UpdatedAt = time.Now()

	s.updateCache(productID, stock)

	duration := time.Since(start).Milliseconds()
	s.eventStore.Append(types.Event{
		ID:        uuid.New(),
		Type:      types.EventTypeStockRollback,
		Status:    types.EventStatusSuccess,
		ProductID: &productID,
		Payload: map[string]interface{}{
			"quantity":  quantity,
			"available": stock.Quantity - stock.Reserved,
			"version":   stock.Version,
		},
		Timestamp: time.Now(),
		Duration:  &duration,
	})

	s.eventStore.Append(types.Event{
		ID:        uuid.New(),
		Type:      types.EventTypeCompensationSuccess,
		Status:    types.EventStatusSuccess,
		ProductID: &productID,
		Payload: map[string]interface{}{
			"quantity": quantity,
		},
		Timestamp: time.Now(),
		Duration:  &duration,
	})

	return nil
}

func (s *InventoryService) GetStock(ctx context.Context, productID string) (*types.Stock, error) {
	if s.chaos.ShouldInjectCacheDirtyData() {
		dirtyValue := rand.Intn(1000)
		s.eventStore.Append(types.Event{
			ID:        uuid.New(),
			Type:      types.EventTypeCacheDirty,
			Status:    types.EventStatusPending,
			ProductID: &productID,
			Payload: map[string]interface{}{
				"message":     "Cache dirty data injected",
				"dirty_value": dirtyValue,
			},
			Timestamp: time.Now(),
		})
		return &types.Stock{
			ProductID: productID,
			Quantity:  dirtyValue,
			Reserved:  0,
			Version:   999,
		}, nil
	}

	s.stocksMu.RLock()
	defer s.stocksMu.RUnlock()

	stock, exists := s.stocks[productID]
	if !exists {
		return nil, errors.New("product not found")
	}

	stockCopy := *stock
	return &stockCopy, nil
}

func (s *InventoryService) AddStock(productID string, quantity int) {
	s.stocksMu.Lock()
	defer s.stocksMu.Unlock()

	stock, exists := s.stocks[productID]
	if !exists {
		stock = &types.Stock{
			ProductID: productID,
			Quantity:  0,
			Reserved:  0,
			Version:   0,
			UpdatedAt: time.Now(),
		}
		s.stocks[productID] = stock
	}

	stock.Quantity += quantity
	stock.Version++
	stock.UpdatedAt = time.Now()

	s.updateCache(productID, stock)
}

func (s *InventoryService) GetAllStocks() map[string]types.Stock {
	s.stocksMu.RLock()
	defer s.stocksMu.RUnlock()

	result := make(map[string]types.Stock)
	for id, stock := range s.stocks {
		result[id] = *stock
	}
	return result
}

func (s *InventoryService) updateCache(productID string, stock *types.Stock) {
	stockJSON, _ := json.Marshal(stock)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	s.redis.Set(ctx, fmt.Sprintf("stock:%s", productID), stockJSON, 5*time.Minute)
}

func (s *InventoryService) getCacheHitRate() float64 {
	total := s.cacheHits + s.cacheMisses
	if total == 0 {
		return 0
	}
	return float64(s.cacheHits) / float64(total)
}

func (s *InventoryService) GetCacheStats() (hits, misses int64) {
	return s.cacheHits, s.cacheMisses
}

func (s *InventoryService) InitTestData() {
	products := []string{"PROD-001", "PROD-002", "PROD-003", "PROD-004", "PROD-005"}
	for _, id := range products {
		s.AddStock(id, 1000)
	}
}
