package domain

import (
	"context"
	"time"

	"github.com/chaos-simulator/chaos-simulator/internal/types"
)

type PaymentRepository interface {
	Create(ctx context.Context, payment *types.Payment) error
	GetByID(ctx context.Context, id string) (*types.Payment, error)
	GetByOrderID(ctx context.Context, orderID string) (*types.Payment, error)
	UpdateStatus(ctx context.Context, id string, status string, transactionID string) error
}

type PaymentService interface {
	ProcessPayment(ctx context.Context, req *ProcessPaymentRequest) (*types.Payment, error)
	RefundPayment(ctx context.Context, paymentID string, reason string) error
	GetPaymentStatus(ctx context.Context, id string) (*types.Payment, error)
}

type ProcessPaymentRequest struct {
	TraceID       string
	OrderID       string
	UserID        string
	Amount        int64
	Currency      string
	PaymentMethod string
	Metadata      map[string]string
}

const (
	PaymentStatusPending   = "PENDING"
	PaymentStatusProcessing = "PROCESSING"
	PaymentStatusSuccess   = "SUCCESS"
	PaymentStatusFailed    = "FAILED"
	PaymentStatusRefunded  = "REFUNDED"
)

func NewPayment(req *ProcessPaymentRequest) *types.Payment {
	now := time.Now()
	return &types.Payment{
		ID:            generatePaymentID(),
		OrderID:       req.OrderID,
		UserID:        req.UserID,
		Amount:        req.Amount,
		Currency:      req.Currency,
		PaymentMethod: req.PaymentMethod,
		Status:        PaymentStatusPending,
		Metadata:      req.Metadata,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
}

func generatePaymentID() string {
	return "PAY-" + time.Now().Format("20060102") + "-" + randomString(8)
}
