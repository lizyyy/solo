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

type PaymentHandler struct {
	pb.UnimplementedPaymentServiceServer
	paymentService *service.PaymentServiceImpl
	hybridTracer   *tracer.HybridTracer
}

func NewPaymentHandler(paymentService *service.PaymentServiceImpl, hybridTracer *tracer.HybridTracer) *PaymentHandler {
	return &PaymentHandler{
		paymentService: paymentService,
		hybridTracer:   hybridTracer,
	}
}

func (h *PaymentHandler) ProcessPayment(ctx context.Context, req *pb.ProcessPaymentRequest) (*pb.ProcessPaymentResponse, error) {
	traceID := tracer.TraceIDFromContext(ctx)
	if traceID == "" {
		traceID = utils.NewTraceID()
		ctx = tracer.ContextWithTraceID(ctx, traceID)
	}

	ctx, span := h.hybridTracer.StartSpan(ctx, "payment-service", "ProcessPayment", traceID, 1, 3)

	var payment *types.Payment
	var err error

	retryErr := service.WithRetry(ctx, &service.RetryConfig{
		MaxAttempts:     3,
		InitialBackoff:  200 * time.Millisecond,
		MaxBackoff:      3 * time.Second,
		BackoffMultiplier: 2.0,
		Jitter:          true,
		IsRetryable: func(e error) bool {
			return e != nil
		},
	}, func(ctx context.Context, attempt int) error {
		span.SetAttribute("attempt", utils.NewUUID())

		paymentReq := &domain.ProcessPaymentRequest{
			TraceID:       traceID,
			OrderID:       req.OrderId,
			UserID:        req.UserId,
			Amount:        req.Amount,
			Currency:      req.Currency,
			PaymentMethod: req.PaymentMethod,
			Metadata:      req.Metadata,
		}

		var procErr error
		payment, procErr = h.paymentService.ProcessPayment(ctx, paymentReq)
		return procErr
	})

	if retryErr != nil {
		span.SetError(retryErr)
		span.End("ERROR")
		utils.WithTraceID(traceID).Error("Payment processing failed after retries", zap.Error(retryErr))
		return nil, status.Errorf(codes.Internal, "payment processing failed: %v", retryErr)
	}

	span.End("SUCCESS")

	return &pb.ProcessPaymentResponse{
		PaymentId:     payment.ID,
		Status:        payment.Status,
		Message:       "Payment processed successfully",
		ProcessedAt:   payment.CreatedAt.Unix(),
		TransactionId: payment.TransactionID,
	}, nil
}

func (h *PaymentHandler) RefundPayment(ctx context.Context, req *pb.RefundPaymentRequest) (*pb.RefundPaymentResponse, error) {
	traceID := tracer.TraceIDFromContext(ctx)
	if traceID == "" {
		traceID = utils.NewTraceID()
	}

	err := h.paymentService.RefundPayment(ctx, req.PaymentId, req.Reason)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "refund failed: %v", err)
	}

	return &pb.RefundPaymentResponse{
		Success:  true,
		RefundId: "REF-" + utils.NewUUID(),
		Message:  "Refund processed successfully",
	}, nil
}

func (h *PaymentHandler) GetPaymentStatus(ctx context.Context, req *pb.GetPaymentStatusRequest) (*pb.GetPaymentStatusResponse, error) {
	payment, err := h.paymentService.GetPaymentStatus(ctx, req.PaymentId)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "payment not found: %v", err)
	}

	return &pb.GetPaymentStatusResponse{
		PaymentId: payment.ID,
		OrderId:   payment.OrderID,
		Status:    payment.Status,
		Amount:    payment.Amount,
		CreatedAt: payment.CreatedAt.Unix(),
	}, nil
}
