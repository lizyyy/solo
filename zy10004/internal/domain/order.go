package domain

import (
	"context"
	"time"

	"github.com/chaos-simulator/chaos-simulator/internal/types"
)

type OrderRepository interface {
	Create(ctx context.Context, order *types.Order) error
	GetByID(ctx context.Context, id string) (*types.Order, error)
	UpdateStatus(ctx context.Context, id string, status string, reason string) error
	ListByUser(ctx context.Context, userID string) ([]*types.Order, error)
}

type OrderService interface {
	CreateOrder(ctx context.Context, req *CreateOrderRequest) (*types.Order, error)
	GetOrder(ctx context.Context, id string) (*types.Order, error)
	UpdateOrderStatus(ctx context.Context, id string, status string, reason string) error
}

type CreateOrderRequest struct {
	TraceID       string
	UserID        string
	Items         []types.OrderItem
	PaymentMethod string
	TotalAmount   int64
	Metadata      map[string]string
}

const (
	OrderStatusCreated   = "CREATED"
	OrderStatusPending   = "PENDING"
	OrderStatusPaid      = "PAID"
	OrderStatusShipped   = "SHIPPED"
	OrderStatusFailed    = "FAILED"
	OrderStatusCancelled = "CANCELLED"
)

func NewOrder(req *CreateOrderRequest) *types.Order {
	now := time.Now()
	return &types.Order{
		ID:          generateOrderID(),
		UserID:      req.UserID,
		Items:       req.Items,
		Status:      OrderStatusCreated,
		TotalAmount: req.TotalAmount,
		Metadata:    req.Metadata,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

func generateOrderID() string {
	return "ORD-" + time.Now().Format("20060102") + "-" + randomString(8)
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[time.Now().UnixNano()%int64(len(letters))]
	}
	return string(b)
}
