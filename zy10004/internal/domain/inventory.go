package domain

import (
	"context"
	"time"

	"github.com/chaos-simulator/chaos-simulator/internal/types"
)

type InventoryRepository interface {
	GetByProductID(ctx context.Context, productID string) (*types.StockRecord, error)
	UpdateStock(ctx context.Context, record *types.StockRecord) error
	DeductStock(ctx context.Context, productID string, quantity int32, operationID string) error
	AddStock(ctx context.Context, productID string, quantity int32, operationID string) error
	CreateInitialStock(ctx context.Context, productID string, total int32) error
}

type InventoryService interface {
	DeductStock(ctx context.Context, req *DeductStockRequest) error
	AddStock(ctx context.Context, productID string, quantity int32, reason string) error
	GetStock(ctx context.Context, productIDs []string) ([]*types.StockRecord, error)
}

type DeductStockRequest struct {
	TraceID     string
	OrderID     string
	Items       []types.StockItem
	OperationID string
}

func NewStockRecord(productID string, total int32) *types.StockRecord {
	return &types.StockRecord{
		ProductID: productID,
		Available: total,
		Reserved:  0,
		Total:     total,
		UpdatedAt: time.Now(),
	}
}
