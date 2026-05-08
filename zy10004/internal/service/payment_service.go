package service

import (
	"context"
	"errors"
	"time"

	"github.com/chaos-simulator/chaos-simulator/internal/domain"
	"github.com/chaos-simulator/chaos-simulator/internal/repository"
	"github.com/chaos-simulator/chaos-simulator/internal/types"
	"github.com/chaos-simulator/chaos-simulator/internal/utils"
	"go.uber.org/zap"
)

type PaymentServiceImpl struct {
	repo         *repository.SQLiteRepository
	chaosManager *ChaosManager
}

func NewPaymentService(repo *repository.SQLiteRepository, chaosManager *ChaosManager) *PaymentServiceImpl {
	return &PaymentServiceImpl{
		repo:         repo,
		chaosManager: chaosManager,
	}
}

func (s *PaymentServiceImpl) ProcessPayment(ctx context.Context, req *domain.ProcessPaymentRequest) (*types.Payment, error) {
	logger := utils.WithTraceID(req.TraceID)
	logger.Info("Processing payment",
		zap.String("order_id", req.OrderID),
		zap.Int64("amount", req.Amount),
		zap.String("method", req.PaymentMethod))

	idempotencyStore := utils.GetIdempotencyStore()
	idempotencyKey := idempotencyStore.GenerateKey("payment-service", "ProcessPayment", req.TraceID)

	if existing, exists := idempotencyStore.Get(ctx, idempotencyKey); exists {
		logger.Info("Returning cached payment (idempotent)")
		return existing.Response.(*types.Payment), nil
	}

	payment := domain.NewPayment(req)
	payment.Status = domain.PaymentStatusProcessing

	if s.chaosManager.ShouldInjectChaos("payment-service", "ProcessPayment") {
		scenario := s.chaosManager.GetActiveScenario("payment-service", "ProcessPayment")
		if scenario != nil {
			logger.Warn("Chaos injection active on payment",
				zap.String("scenario", scenario.Name),
				zap.String("type", string(scenario.Type)))

			if err := s.injectChaos(ctx, scenario); err != nil {
				payment.Status = domain.PaymentStatusFailed
				s.repo.CreatePayment(ctx, payment)
				logger.Error("Payment processing failed due to chaos", zap.Error(err))
				return nil, err
			}
		}
	}

	processingTime := time.Duration(50+time.Now().UnixNano()%100) * time.Millisecond
	time.Sleep(processingTime)

	payment.Status = domain.PaymentStatusSuccess
	payment.TransactionID = "TXN-" + utils.NewUUID()

	if err := s.repo.CreatePayment(ctx, payment); err != nil {
		logger.Error("Failed to save payment", zap.Error(err))
		return nil, err
	}

	idempotencyStore.Set(ctx, idempotencyKey, payment)
	logger.Info("Payment processed successfully",
		zap.String("payment_id", payment.ID),
		zap.String("transaction_id", payment.TransactionID))

	return payment, nil
}

func (s *PaymentServiceImpl) RefundPayment(ctx context.Context, paymentID string, reason string) error {
	logger := utils.GetLogger()
	logger.Info("Processing refund", zap.String("payment_id", paymentID), zap.String("reason", reason))

	payment, err := s.repo.GetPaymentByID(ctx, paymentID)
	if err != nil {
		return err
	}

	if payment.Status != domain.PaymentStatusSuccess {
		return errors.New("cannot refund unsuccessful payment")
	}

	if s.chaosManager.ShouldInjectChaos("payment-service", "RefundPayment") {
		scenario := s.chaosManager.GetActiveScenario("payment-service", "RefundPayment")
		if scenario != nil {
			if err := s.injectChaos(ctx, scenario); err != nil {
				return err
			}
		}
	}

	payment.Status = domain.PaymentStatusRefunded
	return s.repo.UpdatePaymentStatus(ctx, paymentID, payment.Status, "REFUND-"+utils.NewUUID())
}

func (s *PaymentServiceImpl) GetPaymentStatus(ctx context.Context, id string) (*types.Payment, error) {
	return s.repo.GetPaymentByID(ctx, id)
}

func (s *PaymentServiceImpl) injectChaos(ctx context.Context, scenario *types.ChaosScenario) error {
	config := scenario.Config

	switch scenario.Type {
	case types.ChaosTypeTimeout:
		timeout := time.Duration(config.TimeoutMS) * time.Millisecond
		if timeout <= 0 {
			timeout = 3 * time.Second
		}
		utils.GetLogger().Warn("Payment timeout chaos", zap.Duration("timeout", timeout))
		time.Sleep(timeout)
		return errors.New("payment processing timed out")

	case types.ChaosTypeError:
		if shouldInject(config.Probability, config.ErrorRate) {
			errMsg := config.ErrorMessage
			if errMsg == "" {
				errMsg = "payment gateway error"
			}
			return errors.New(errMsg)
		}

	case types.ChaosTypeSlowResponse:
		delay := time.Duration(config.DelayMS) * time.Millisecond
		if delay <= 0 {
			delay = 1 * time.Second
		}
		utils.GetLogger().Warn("Payment slow response", zap.Duration("delay", delay))
		time.Sleep(delay)

	case types.ChaosTypeDuplicate:
		count := config.DuplicateCount
		if count <= 0 {
			count = 2
		}
		utils.GetLogger().Warn("Payment duplicate chaos", zap.Int("duplicate_count", count))
		for i := 0; i < count; i++ {
			time.Sleep(50 * time.Millisecond)
		}
	}

	return nil
}
