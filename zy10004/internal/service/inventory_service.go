package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/chaos-simulator/chaos-simulator/internal/domain"
	"github.com/chaos-simulator/chaos-simulator/internal/repository"
	"github.com/chaos-simulator/chaos-simulator/internal/types"
	"github.com/chaos-simulator/chaos-simulator/internal/utils"
	"go.uber.org/zap"
)

type InventoryServiceImpl struct {
	repo         *repository.SQLiteRepository
	chaosManager *ChaosManager
}

func NewInventoryService(repo *repository.SQLiteRepository, chaosManager *ChaosManager) *InventoryServiceImpl {
	return &InventoryServiceImpl{
		repo:         repo,
		chaosManager: chaosManager,
	}
}

func (s *InventoryServiceImpl) DeductStock(ctx context.Context, req *domain.DeductStockRequest) error {
	logger := utils.WithTraceID(req.TraceID)
	logger.Info("Deducting stock",
		zap.String("order_id", req.OrderID),
		zap.Int("items_count", len(req.Items)))

	idempotencyStore := utils.GetIdempotencyStore()
	idempotencyKey := idempotencyStore.GenerateKey("inventory-service", "DeductStock", req.OperationID)

	if _, exists := idempotencyStore.Get(ctx, idempotencyKey); exists {
		logger.Info("Stock deduction already processed (idempotent)")
		return nil
	}

	if s.chaosManager.ShouldInjectChaos("inventory-service", "DeductStock") {
		scenario := s.chaosManager.GetActiveScenario("inventory-service", "DeductStock")
		if scenario != nil {
			logger.Warn("Chaos injection active on inventory",
				zap.String("scenario", scenario.Name),
				zap.String("type", string(scenario.Type)))

			if err := s.injectChaos(ctx, scenario); err != nil {
				logger.Error("Stock deduction failed due to chaos", zap.Error(err))
				return err
			}
		}
	}

	for _, item := range req.Items {
		stock, err := s.repo.GetStockByProductID(ctx, item.ProductID)
		if err != nil {
			return fmt.Errorf("failed to get stock for product %s: %w", item.ProductID, err)
		}

		if stock.Available < item.Quantity {
			return fmt.Errorf("insufficient stock for product %s: available %d, requested %d",
				item.ProductID, stock.Available, item.Quantity)
		}

		stock.Available -= item.Quantity
		stock.Reserved += item.Quantity

		if err := s.repo.UpdateStock(ctx, stock); err != nil {
			return fmt.Errorf("failed to update stock for product %s: %w", item.ProductID, err)
		}

		logger.Debug("Stock deducted",
			zap.String("product_id", item.ProductID),
			zap.Int32("quantity", item.Quantity),
			zap.Int32("remaining", stock.Available))
	}

	idempotencyStore.Set(ctx, idempotencyKey, true)
	logger.Info("Stock deduction completed")
	return nil
}

func (s *InventoryServiceImpl) AddStock(ctx context.Context, productID string, quantity int32, reason string) error {
	logger := utils.GetLogger()
	logger.Info("Adding stock",
		zap.String("product_id", productID),
		zap.Int32("quantity", quantity),
		zap.String("reason", reason))

	stock, err := s.repo.GetStockByProductID(ctx, productID)
	if err != nil {
		if err.Error() == "sql: no rows in result set" {
			return s.repo.CreateInitialStock(ctx, productID, quantity)
		}
		return err
	}

	stock.Available += quantity
	stock.Total += quantity

	return s.repo.UpdateStock(ctx, stock)
}

func (s *InventoryServiceImpl) GetStock(ctx context.Context, productIDs []string) ([]*types.StockRecord, error) {
	var records []*types.StockRecord

	for _, productID := range productIDs {
		record, err := s.repo.GetStockByProductID(ctx, productID)
		if err != nil {
			if err.Error() == "sql: no rows in result set" {
				continue
			}
			return nil, err
		}
		records = append(records, record)
	}

	return records, nil
}

func (s *InventoryServiceImpl) InitializeProductStock(ctx context.Context, productID string, total int32) error {
	return s.repo.CreateInitialStock(ctx, productID, total)
}

func (s *InventoryServiceImpl) injectChaos(ctx context.Context, scenario *types.ChaosScenario) error {
	config := scenario.Config

	switch scenario.Type {
	case types.ChaosTypeTimeout:
		timeout := time.Duration(config.TimeoutMS) * time.Millisecond
		if timeout <= 0 {
			timeout = 5 * time.Second
		}
		utils.GetLogger().Warn("Inventory timeout chaos", zap.Duration("timeout", timeout))
		time.Sleep(timeout)
		return errors.New("inventory operation timed out")

	case types.ChaosTypeError:
		if shouldInject(config.Probability, config.ErrorRate) {
			errMsg := config.ErrorMessage
			if errMsg == "" {
				errMsg = "database connection error"
			}
			return errors.New(errMsg)
		}

	case types.ChaosTypeSlowResponse:
		delay := time.Duration(config.DelayMS) * time.Millisecond
		if delay <= 0 {
			delay = 2 * time.Second
		}
		utils.GetLogger().Warn("Inventory slow response", zap.Duration("delay", delay))
		time.Sleep(delay)

	case types.ChaosTypeNetworkDown:
		return errors.New("database connection failed (network simulation)")

	case types.ChaosTypeDuplicate:
		utils.GetLogger().Warn("Inventory duplicate operation detected")
		return errors.New("duplicate operation detected, operation aborted")
	}

	return nil
}
