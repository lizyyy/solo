package handler

import (
	"context"
	"time"

	pb "github.com/chaos-simulator/chaos-simulator/api/proto"
	"github.com/chaos-simulator/chaos-simulator/internal/domain"
	"github.com/chaos-simulator/chaos-simulator/internal/service"
	"github.com/chaos-simulator/chaos-simulator/internal/types"
	"github.com/chaos-simulator/chaos-simulator/internal/utils"
	"github.com/chaos-simulator/chaos-simulator/pkg/tracer"
	"go.uber.org/zap"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type InventoryHandler struct {
	pb.UnimplementedInventoryServiceServer
	inventoryService *service.InventoryServiceImpl
	hybridTracer     *tracer.HybridTracer
}

func NewInventoryHandler(inventoryService *service.InventoryServiceImpl, hybridTracer *tracer.HybridTracer) *InventoryHandler {
	return &InventoryHandler{
		inventoryService: inventoryService,
		hybridTracer:     hybridTracer,
	}
}

func (h *InventoryHandler) DeductStock(ctx context.Context, req *pb.DeductStockRequest) (*pb.DeductStockResponse, error) {
	traceID := tracer.TraceIDFromContext(ctx)
	if traceID == "" {
		traceID = utils.NewTraceID()
		ctx = tracer.ContextWithTraceID(ctx, traceID)
	}

	ctx, span := h.hybridTracer.StartSpan(ctx, "inventory-service", "DeductStock", traceID, 1, 3)

	retryErr := service.WithRetry(ctx, &service.RetryConfig{
		MaxAttempts:     3,
		InitialBackoff:  150 * time.Millisecond,
		MaxBackoff:      2 * time.Second,
		BackoffMultiplier: 2.0,
		Jitter:          true,
		IsRetryable: func(e error) bool {
			return e != nil
		},
	}, func(ctx context.Context, attempt int) error {
		span.SetAttribute("attempt", utils.NewUUID())

		deductReq := &domain.DeductStockRequest{
			TraceID:     traceID,
			OrderID:     req.OrderId,
			Items:       convertStockItems(req.Items),
			OperationID: req.OperationId,
		}

		return h.inventoryService.DeductStock(ctx, deductReq)
	})

	if retryErr != nil {
		span.SetError(retryErr)
		span.End("ERROR")
		utils.WithTraceID(traceID).Error("Stock deduction failed after retries", zap.Error(retryErr))
		return &pb.DeductStockResponse{
			Success: false,
			Message: "Stock deduction failed: " + retryErr.Error(),
		}, nil
	}

	span.End("SUCCESS")

	return &pb.DeductStockResponse{
		Success:     true,
		Message:     "Stock deducted successfully",
		OperationId: req.OperationId,
	}, nil
}

func (h *InventoryHandler) AddStock(ctx context.Context, req *pb.AddStockRequest) (*pb.AddStockResponse, error) {
	for _, item := range req.Items {
		err := h.inventoryService.AddStock(ctx, item.ProductId, item.Quantity, req.Reason)
		if err != nil {
			return &pb.AddStockResponse{
				Success: false,
				Message: "Failed to add stock: " + err.Error(),
			}, nil
		}
	}

	return &pb.AddStockResponse{
		Success: true,
		Message: "Stock added successfully",
	}, nil
}

func (h *InventoryHandler) GetStock(ctx context.Context, req *pb.GetStockRequest) (*pb.GetStockResponse, error) {
	stocks, err := h.inventoryService.GetStock(ctx, req.ProductIds)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get stock: %v", err)
	}

	protoStocks := make([]*pb.StockInfo, len(stocks))
	for i, stock := range stocks {
		protoStocks[i] = &pb.StockInfo{
			ProductId: stock.ProductID,
			Available: stock.Available,
			Reserved:  stock.Reserved,
			Total:     stock.Total,
		}
	}

	return &pb.GetStockResponse{
		Stocks: protoStocks,
	}, nil
}

func convertStockItems(protoItems []*pb.StockItem) []types.StockItem {
	items := make([]types.StockItem, len(protoItems))
	for i, item := range protoItems {
		items[i] = types.StockItem{
			ProductID: item.ProductId,
			Quantity:  item.Quantity,
		}
	}
	return items
}
