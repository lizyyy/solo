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

	if err := s.chaos.MaybeExhaustConnectionPool(ctx); err != nil {
		duration := time.Since(start).Milliseconds()
		errMsg := err.Error()
		s.eventStore.Append(types.Event{
			ID:        uuid.New(),
			Type:      types.EventTypeStateChange,
			Status:    types.EventStatusFailed,
			ProductID: &productID,
			Payload: map[string]interface{}{
				"action":   "deduct_stock_connection_pool_exhausted",
				"quantity": quantity,
				"error":    errMsg,
			},
			Timestamp: time.Now(),
			Duration:  &duration,
			Error:     &errMsg,
		})
		return false, err
	}

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

	var lockID string
	if s.chaos.ShouldInjectDBLockWait() {
		var err error
		lockID, err = s.chaos.AcquireDBLock(ctx, productID)
		if err != nil {
			duration := time.Since(start).Milliseconds()
			errMsg := err.Error()
			s.eventStore.Append(types.Event{
				ID:        uuid.New(),
				Type:      types.EventTypeStockDeducted,
				Status:    types.EventStatusFailed,
				ProductID: &productID,
				Payload: map[string]interface{}{
					"error":   "failed to acquire DB lock",
					"details": errMsg,
				},
				Timestamp: time.Now(),
				Duration:  &duration,
				Error:     &errMsg,
			})
			return false, err
		}

		config := s.chaos.GetConfig()
		if config.DBLockWait != nil {
			timeout := config.DBLockWait.LockTimeoutMs
			if timeout <= 0 {
				timeout = 5000
			}
			time.Sleep(time.Duration(timeout) * time.Millisecond)
		}
	}
	defer s.chaos.ReleaseDBLock(lockID)

	if s.chaos.ShouldInjectGoroutineLeak() {
		s.chaos.LeakGoroutine(s.chaos.GetConfig().GoroutineLeak.LeakRate)
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

	s.chaos.UpdateDBVersion(productID)

	if s.chaos.ShouldInjectCacheDirtyData() {
		s.chaos.MarkCacheDirty(productID)
		s.eventStore.Append(types.Event{
			ID:        uuid.New(),
			Type:      types.EventTypeCacheDirty,
			Status:    types.EventStatusSuccess,
			ProductID: &productID,
			Payload: map[string]interface{}{
				"action":   "db_updated_cache_not_synced",
				"db_version": s.chaos.GetDBVersion(productID),
				"message":  "DB updated, cache intentionally not synced",
			},
			Timestamp: time.Now(),
		})
	} else {
		s.updateCache(productID, stock)
	}

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
			"db_version":     s.chaos.GetDBVersion(productID),
			"cache_hit_rate": s.getCacheHitRate(),
			"lock_held":      lockID != "",
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
		s.chaos.LeakGoroutine(s.chaos.GetConfig().GoroutineLeak.LeakRate)
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

	s.chaos.UpdateDBVersion(productID)

	if s.chaos.ShouldInjectCacheDirtyData() {
		s.chaos.MarkCacheDirty(productID)
	} else {
		s.updateCache(productID, stock)
	}

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
			"db_version": s.chaos.GetDBVersion(productID),
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
	if s.chaos.IsCacheDirty(productID) {
		s.stocksMu.RLock()
		stock, exists := s.stocks[productID]
		if !exists {
			s.stocksMu.RUnlock()
			return nil, errors.New("product not found")
		}

		cachedVersion := stock.Version
		dbVersion := s.chaos.GetDBVersion(productID)

		dirtyValue := cachedVersion + rand.Intn(100) + 50

		s.stocksMu.RUnlock()

		s.eventStore.Append(types.Event{
			ID:        uuid.New(),
			Type:      types.EventTypeCacheDirty,
			Status:    types.EventStatusPending,
			ProductID: &productID,
			Payload: map[string]interface{}{
				"message":       "Cache dirty data returned",
				"cached_qty":    dirtyValue,
				"actual_qty":    stock.Quantity - stock.Reserved,
				"cached_version": cachedVersion,
				"db_version":    dbVersion,
			},
			Timestamp: time.Now(),
		})

		return &types.Stock{
			ProductID: productID,
			Quantity:  dirtyValue,
			Reserved:  0,
			Version:   9999,
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

	s.chaos.UpdateDBVersion(productID)
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
	if s.redis != nil {
		s.redis.Set(ctx, fmt.Sprintf("stock:%s", productID), stockJSON, 5*time.Minute)
	}
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
