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

type OrderServiceImpl struct {
	repo         *repository.SQLiteRepository
	chaosManager *ChaosManager
}

func NewOrderService(repo *repository.SQLiteRepository, chaosManager *ChaosManager) *OrderServiceImpl {
	return &OrderServiceImpl{
		repo:         repo,
		chaosManager: chaosManager,
	}
}

func (s *OrderServiceImpl) CreateOrder(ctx context.Context, req *domain.CreateOrderRequest) (*types.Order, error) {
	logger := utils.WithTraceID(req.TraceID)
	logger.Info("Creating order", zap.String("user_id", req.UserID), zap.Int("items_count", len(req.Items)))

	idempotencyStore := utils.GetIdempotencyStore()
	idempotencyKey := idempotencyStore.GenerateKey("order-service", "CreateOrder", req.TraceID)

	if existing, exists := idempotencyStore.Get(ctx, idempotencyKey); exists {
		logger.Info("Returning cached response (idempotent)")
		return existing.Response.(*types.Order), nil
	}

	order := domain.NewOrder(req)
	order.Status = domain.OrderStatusPending

	if s.chaosManager.ShouldInjectChaos("order-service", "CreateOrder") {
		scenario := s.chaosManager.GetActiveScenario("order-service", "CreateOrder")
		if scenario != nil {
			logger.Warn("Chaos injection active",
				zap.String("scenario", scenario.Name),
				zap.String("type", string(scenario.Type)))

			if err := s.injectChaos(ctx, scenario); err != nil {
				logger.Error("Order creation failed due to chaos", zap.Error(err))
				return nil, err
			}
		}
	}

	if err := s.repo.CreateOrder(ctx, order); err != nil {
		logger.Error("Failed to create order in database", zap.Error(err))
		return nil, err
	}

	idempotencyStore.Set(ctx, idempotencyKey, order)
	logger.Info("Order created successfully", zap.String("order_id", order.ID))
	return order, nil
}

func (s *OrderServiceImpl) GetOrder(ctx context.Context, id string) (*types.Order, error) {
	return s.repo.GetOrderByID(ctx, id)
}

func (s *OrderServiceImpl) UpdateOrderStatus(ctx context.Context, id string, status string, reason string) error {
	return s.repo.UpdateOrderStatus(ctx, id, status, reason)
}

func (s *OrderServiceImpl) injectChaos(ctx context.Context, scenario *types.ChaosScenario) error {
	config := scenario.Config

	switch scenario.Type {
	case types.ChaosTypeTimeout:
		timeout := time.Duration(config.TimeoutMS) * time.Millisecond
		if timeout <= 0 {
			timeout = 2 * time.Second
		}
		utils.GetLogger().Warn("Injecting timeout chaos", zap.Duration("timeout", timeout))
		time.Sleep(timeout)
		return errors.New("request timed out due to chaos injection")

	case types.ChaosTypeError:
		errorRate := config.ErrorRate
		if errorRate <= 0 {
			errorRate = 0.5
		}
		utils.GetLogger().Warn("Injecting error chaos", zap.Float64("error_rate", errorRate))
		if shouldInject(config.Probability, errorRate) {
			errMsg := config.ErrorMessage
			if errMsg == "" {
				errMsg = "simulated error from chaos injection"
			}
			return errors.New(errMsg)
		}

	case types.ChaosTypeSlowResponse:
		delay := time.Duration(config.DelayMS) * time.Millisecond
		if delay <= 0 {
			delay = 500 * time.Millisecond
		}
		utils.GetLogger().Warn("Injecting slow response chaos", zap.Duration("delay", delay))
		time.Sleep(delay)

	case types.ChaosTypeNetworkDown:
		utils.GetLogger().Warn("Injecting network down chaos")
		return errors.New("network connection failed (chaos simulation)")

	case types.ChaosTypeCircuitBreaker:
		utils.GetLogger().Warn("Circuit breaker opened", zap.String("scenario", scenario.Name))
		return errors.New("circuit breaker open - request rejected")
	}

	return nil
}

func shouldInject(probability, fallback float64) bool {
	if probability <= 0 || probability > 1 {
		probability = fallback
	}
	return time.Now().UnixNano()%1000 < int64(probability*1000)
}

type ChaosManager struct {
	repo           *repository.SQLiteRepository
	activeScenarios map[string]*types.ChaosScenario
}

func NewChaosManager(repo *repository.SQLiteRepository) *ChaosManager {
	manager := &ChaosManager{
		repo:            repo,
		activeScenarios: make(map[string]*types.ChaosScenario),
	}
	manager.loadActiveScenarios()
	return manager
}

func (c *ChaosManager) loadActiveScenarios() {
	ctx := context.Background()
	scenarios, err := c.repo.GetAllChaosScenarios(ctx)
	if err != nil {
		utils.GetLogger().Error("Failed to load chaos scenarios", zap.Error(err))
		return
	}

	for _, s := range scenarios {
		if s.Enabled {
			key := c.scenarioKey(s.TargetService, s.TargetMethod)
			c.activeScenarios[key] = s
		}
	}
}

func (c *ChaosManager) scenarioKey(service, method string) string {
	return fmt.Sprintf("%s:%s", service, method)
}

func (c *ChaosManager) ShouldInjectChaos(service, method string) bool {
	key := c.scenarioKey(service, method)
	scenario, exists := c.activeScenarios[key]
	return exists && scenario.Enabled
}

func (c *ChaosManager) GetActiveScenario(service, method string) *types.ChaosScenario {
	key := c.scenarioKey(service, method)
	return c.activeScenarios[key]
}

func (c *ChaosManager) EnableScenario(ctx context.Context, scenario *types.ChaosScenario) error {
	scenario.Enabled = true
	scenario.CreatedAt = time.Now()

	if err := c.repo.SaveChaosScenario(ctx, scenario); err != nil {
		return err
	}

	key := c.scenarioKey(scenario.TargetService, scenario.TargetMethod)
	c.activeScenarios[key] = scenario
	return nil
}

func (c *ChaosManager) DisableScenario(ctx context.Context, scenarioID string) error {
	scenarios, err := c.repo.GetAllChaosScenarios(ctx)
	if err != nil {
		return err
	}

	for _, s := range scenarios {
		if s.ID == scenarioID {
			s.Enabled = false
			if err := c.repo.SaveChaosScenario(ctx, s); err != nil {
				return err
			}
			key := c.scenarioKey(s.TargetService, s.TargetMethod)
			delete(c.activeScenarios, key)
			break
		}
	}
	return nil
}

func (c *ChaosManager) GetAllScenarios(ctx context.Context) ([]*types.ChaosScenario, error) {
	return c.repo.GetAllChaosScenarios(ctx)
}

type RetryConfig struct {
	MaxAttempts     int
	InitialBackoff  time.Duration
	MaxBackoff      time.Duration
	BackoffMultiplier float64
	Jitter          bool
	IsRetryable     func(error) bool
}

func DefaultRetryConfig() *RetryConfig {
	return &RetryConfig{
		MaxAttempts:     3,
		InitialBackoff:  100 * time.Millisecond,
		MaxBackoff:      2 * time.Second,
		BackoffMultiplier: 2.0,
		Jitter:          true,
		IsRetryable:     func(err error) bool { return err != nil },
	}
}

func WithRetry(ctx context.Context, config *RetryConfig, fn func(ctx context.Context, attempt int) error) error {
	if config == nil {
		config = DefaultRetryConfig()
	}

	var lastErr error
	backoff := config.InitialBackoff

	for attempt := 1; attempt <= config.MaxAttempts; attempt++ {
		utils.GetLogger().Info("Attempting operation",
			zap.Int("attempt", attempt),
			zap.Int("max_attempts", config.MaxAttempts))

		err := fn(ctx, attempt)
		if err == nil {
			return nil
		}

		lastErr = err

		if !config.IsRetryable(err) {
			utils.GetLogger().Warn("Error not retryable", zap.Error(err))
			return err
		}

		if attempt == config.MaxAttempts {
			utils.GetLogger().Error("Max retries exceeded", zap.Error(err))
			break
		}

		waitTime := backoff
		if config.Jitter {
			waitTime = addJitter(backoff)
		}

		utils.GetLogger().Warn("Retrying after error",
			zap.Error(err),
			zap.Int("attempt", attempt),
			zap.Duration("backoff", waitTime))

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(waitTime):
		}

		backoff = time.Duration(float64(backoff) * config.BackoffMultiplier)
		if backoff > config.MaxBackoff {
			backoff = config.MaxBackoff
		}
	}

	return lastErr
}

func addJitter(d time.Duration) time.Duration {
	jitter := time.Duration(time.Now().UnixNano() % int64(d/2))
	return d/2 + jitter
}
