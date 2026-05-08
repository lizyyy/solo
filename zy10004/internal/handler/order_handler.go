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

type OrderHandler struct {
	pb.UnimplementedOrderServiceServer
	orderService *service.OrderServiceImpl
	hybridTracer *tracer.HybridTracer
}

func NewOrderHandler(orderService *service.OrderServiceImpl, hybridTracer *tracer.HybridTracer) *OrderHandler {
	return &OrderHandler{
		orderService: orderService,
		hybridTracer: hybridTracer,
	}
}

func (h *OrderHandler) CreateOrder(ctx context.Context, req *pb.CreateOrderRequest) (*pb.CreateOrderResponse, error) {
	traceID := tracer.TraceIDFromContext(ctx)
	if traceID == "" {
		traceID = utils.NewTraceID()
		ctx = tracer.ContextWithTraceID(ctx, traceID)
	}

	ctx, span := h.hybridTracer.StartSpan(ctx, "order-service", "CreateOrder", traceID, 1, 3)

	var order *types.Order
	var err error

	retryErr := service.WithRetry(ctx, &service.RetryConfig{
		MaxAttempts:     3,
		InitialBackoff:  100 * time.Millisecond,
		MaxBackoff:      2 * time.Second,
		BackoffMultiplier: 2.0,
		Jitter:          true,
		IsRetryable: func(e error) bool {
			if errStr := e.Error(); errStr != "" {
				return true
			}
			return false
		},
	}, func(ctx context.Context, attempt int) error {
		span.SetAttribute("attempt", utils.NewUUID())

		orderReq := &domain.CreateOrderRequest{
			TraceID:       traceID,
			UserID:        req.UserId,
			Items:         convertOrderItems(req.Items),
			PaymentMethod: req.PaymentMethod,
			TotalAmount:   req.TotalAmount,
			Metadata:      req.Metadata,
		}

		var createErr error
		order, createErr = h.orderService.CreateOrder(ctx, orderReq)
		return createErr
	})

	if retryErr != nil {
		span.SetError(retryErr)
		span.End("ERROR")
		utils.WithTraceID(traceID).Error("Order creation failed after retries", zap.Error(retryErr))
		return nil, status.Errorf(codes.Internal, "failed to create order: %v", retryErr)
	}

	span.End("SUCCESS")

	return &pb.CreateOrderResponse{
		OrderId:   order.ID,
		Status:    order.Status,
		Message:   "Order created successfully",
		CreatedAt: order.CreatedAt.Unix(),
	}, nil
}

func (h *OrderHandler) GetOrder(ctx context.Context, req *pb.GetOrderRequest) (*pb.GetOrderResponse, error) {
	traceID := tracer.TraceIDFromContext(ctx)
	if traceID == "" {
		traceID = utils.NewTraceID()
	}

	order, err := h.orderService.GetOrder(ctx, req.OrderId)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "order not found: %v", err)
	}

	return &pb.GetOrderResponse{
		OrderId:     order.ID,
		UserId:      order.UserID,
		Items:       convertToProtoOrderItems(order.Items),
		Status:      order.Status,
		TotalAmount: order.TotalAmount,
		CreatedAt:   order.CreatedAt.Unix(),
		UpdatedAt:   order.UpdatedAt.Unix(),
	}, nil
}

func (h *OrderHandler) UpdateOrderStatus(ctx context.Context, req *pb.UpdateOrderStatusRequest) (*pb.UpdateOrderStatusResponse, error) {
	err := h.orderService.UpdateOrderStatus(ctx, req.OrderId, req.NewStatus, req.Reason)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update order status: %v", err)
	}

	return &pb.UpdateOrderStatusResponse{
		Success: true,
		Message: "Order status updated successfully",
	}, nil
}

func convertOrderItems(protoItems []*pb.OrderItem) []types.OrderItem {
	items := make([]types.OrderItem, len(protoItems))
	for i, item := range protoItems {
		items[i] = types.OrderItem{
			ProductID: item.ProductId,
			Quantity:  item.Quantity,
			UnitPrice: item.UnitPrice,
		}
	}
	return items
}

func convertToProtoOrderItems(items []types.OrderItem) []*pb.OrderItem {
	protoItems := make([]*pb.OrderItem, len(items))
	for i, item := range items {
		protoItems[i] = &pb.OrderItem{
			ProductId: item.ProductID,
			Quantity:  item.Quantity,
			UnitPrice: item.UnitPrice,
		}
	}
	return protoItems
}
