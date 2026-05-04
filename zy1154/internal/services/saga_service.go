package services

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"gorm.io/gorm"

	"saga-demo/internal/database"
	"saga-demo/internal/models"
	"saga-demo/internal/utils"
)

type SagaService struct {
	db                  *gorm.DB
	orderService        *OrderService
	inventoryService    *InventoryService
	balanceService      *BalanceService
	couponService       *CouponService
	outboxService       *OutboxService
	compensationService *CompensationService
}

func NewSagaService(
	orderService *OrderService,
	inventoryService *InventoryService,
	balanceService *BalanceService,
	couponService *CouponService,
	outboxService *OutboxService,
	compensationService *CompensationService,
) *SagaService {
	return &SagaService{
		db:                  database.GetDB(),
		orderService:        orderService,
		inventoryService:    inventoryService,
		balanceService:      balanceService,
		couponService:       couponService,
		outboxService:       outboxService,
		compensationService: compensationService,
	}
}

type SagaStepDefinition struct {
	StepIndex    int
	StepName     string
	ServiceName  string
	Action       string
	Compensation string
}

func (s *SagaService) CreateOrderSaga(userID, productID string, quantity int, couponID string) (*models.SagaInstance, error) {
	productPrice := 100.0
	totalAmount := float64(quantity) * productPrice
	discount := 0.0
	payAmount := totalAmount

	if couponID != "" {
		couponDiscount, err := s.couponService.CalculateDiscount(couponID, totalAmount)
		if err == nil {
			discount = couponDiscount
			payAmount = totalAmount - discount
		}
	}

	order, err := s.orderService.CreateOrder(userID, productID, quantity, couponID)
	if err != nil {
		return nil, fmt.Errorf("failed to create order: %w", err)
	}

	if err := s.orderService.UpdateOrderAmounts(order.ID, totalAmount, discount, payAmount); err != nil {
		return nil, fmt.Errorf("failed to update order amounts: %w", err)
	}

	steps := s.buildSagaSteps(order, couponID)

	sagaInstance := &models.SagaInstance{
		ID:          utils.GenerateSagaID(),
		OrderID:     order.ID,
		Status:      models.SagaStatusPending,
		CurrentStep: 0,
		TotalSteps:  len(steps),
		RetryCount:  0,
		MaxRetries:  3,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	tx := s.db.Begin()
	if err := tx.Create(sagaInstance).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to create saga instance: %w", err)
	}

	for i, stepDef := range steps {
		step := &models.SagaStep{
			ID:           utils.GenerateID(),
			SagaID:       sagaInstance.ID,
			StepIndex:    i,
			StepName:     stepDef.StepName,
			ServiceName:  stepDef.ServiceName,
			Action:       stepDef.Action,
			Compensation: stepDef.Compensation,
			Status:       models.SagaStepStatusPending,
			RetryCount:   0,
			MaxRetries:   3,
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		}
		if err := tx.Create(step).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to create saga step: %w", err)
		}
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit saga creation: %w", err)
	}

	return sagaInstance, nil
}

func (s *SagaService) buildSagaSteps(order *models.Order, couponID string) []SagaStepDefinition {
	var steps []SagaStepDefinition

	stepIndex := 0

	if couponID != "" {
		steps = append(steps, SagaStepDefinition{
			StepIndex:    stepIndex,
			StepName:     "lock_coupon",
			ServiceName:  "coupon",
			Action:       "lock",
			Compensation: "release",
		})
		stepIndex++
	}

	steps = append(steps, SagaStepDefinition{
		StepIndex:    stepIndex,
		StepName:     "lock_inventory",
		ServiceName:  "inventory",
		Action:       "lock",
		Compensation: "release",
	})
	stepIndex++

	steps = append(steps, SagaStepDefinition{
		StepIndex:    stepIndex,
		StepName:     "freeze_balance",
		ServiceName:  "balance",
		Action:       "freeze",
		Compensation: "release",
	})
	stepIndex++

	steps = append(steps, SagaStepDefinition{
		StepIndex:    stepIndex,
		StepName:     "create_order",
		ServiceName:  "order",
		Action:       "confirm",
		Compensation: "cancel",
	})
	stepIndex++

	steps = append(steps, SagaStepDefinition{
		StepIndex:    stepIndex,
		StepName:     "deduct_inventory",
		ServiceName:  "inventory",
		Action:       "deduct",
		Compensation: "restore",
	})
	stepIndex++

	steps = append(steps, SagaStepDefinition{
		StepIndex:    stepIndex,
		StepName:     "deduct_balance",
		ServiceName:  "balance",
		Action:       "deduct",
		Compensation: "restore",
	})
	stepIndex++

	if couponID != "" {
		steps = append(steps, SagaStepDefinition{
			StepIndex:    stepIndex,
			StepName:     "use_coupon",
			ServiceName:  "coupon",
			Action:       "use",
			Compensation: "restore",
		})
	}

	return steps
}

func (s *SagaService) ExecuteSaga(sagaID string) error {
	var saga models.SagaInstance
	if err := s.db.Where("id = ?", sagaID).First(&saga).Error; err != nil {
		return fmt.Errorf("saga not found: %w", err)
	}

	if saga.Status != models.SagaStatusPending && saga.Status != models.SagaStatusRunning {
		return fmt.Errorf("saga is not in executable state: %s", saga.Status)
	}

	saga.Status = models.SagaStatusRunning
	saga.UpdatedAt = time.Now()
	s.db.Save(&saga)

	var steps []models.SagaStep
	if err := s.db.Where("saga_id = ?", sagaID).Order("step_index ASC").Find(&steps).Error; err != nil {
		return fmt.Errorf("failed to get saga steps: %w", err)
	}

	order, err := s.orderService.GetOrder(saga.OrderID)
	if err != nil {
		return fmt.Errorf("failed to get order: %w", err)
	}

	for i := saga.CurrentStep; i < len(steps); i++ {
		step := &steps[i]

		if step.Status == models.SagaStepStatusCompleted {
			continue
		}

		step.Status = models.SagaStepStatusRunning
		step.UpdatedAt = time.Now()
		s.db.Save(step)

		if err := s.outboxService.CreateEvent(
			saga.OrderID,
			"saga_step",
			fmt.Sprintf("step_start_%s", step.StepName),
			map[string]interface{}{
				"saga_id":   sagaID,
				"step_name": step.StepName,
				"order_id":  saga.OrderID,
			},
		); err != nil {
			log.Printf("Failed to create outbox event: %v", err)
		}

		err := s.executeStep(step, order)

		if err != nil {
			step.Status = models.SagaStepStatusFailed
			step.ErrorMessage = err.Error()
			step.UpdatedAt = time.Now()
			s.db.Save(step)

			saga.Status = models.SagaStatusFailed
			saga.ErrorMessage = fmt.Sprintf("Step %d (%s) failed: %v", step.StepIndex, step.StepName, err)
			saga.UpdatedAt = time.Now()
			s.db.Save(&saga)

			if err := s.outboxService.CreateEvent(
				saga.OrderID,
				"saga",
				"saga_failed",
				map[string]interface{}{
					"saga_id":  sagaID,
					"order_id": saga.OrderID,
					"error":    err.Error(),
				},
			); err != nil {
				log.Printf("Failed to create outbox event: %v", err)
			}

			log.Printf("Starting compensation for saga: %s", sagaID)
			if err := s.StartCompensation(sagaID); err != nil {
				log.Printf("Compensation failed: %v", err)
			}

			return fmt.Errorf("saga execution failed at step %d: %w", step.StepIndex, err)
		}

		step.Status = models.SagaStepStatusCompleted
		step.UpdatedAt = time.Now()
		s.db.Save(step)

		saga.CurrentStep = i + 1
		saga.UpdatedAt = time.Now()
		s.db.Save(&saga)

		if err := s.outboxService.CreateEvent(
			saga.OrderID,
			"saga_step",
			fmt.Sprintf("step_complete_%s", step.StepName),
			map[string]interface{}{
				"saga_id":   sagaID,
				"step_name": step.StepName,
				"order_id":  saga.OrderID,
			},
		); err != nil {
			log.Printf("Failed to create outbox event: %v", err)
		}
	}

	saga.Status = models.SagaStatusCompleted
	saga.UpdatedAt = time.Now()
	s.db.Save(&saga)

	if err := s.outboxService.CreateEvent(
		saga.OrderID,
		"saga",
		"saga_completed",
		map[string]interface{}{
			"saga_id":  sagaID,
			"order_id": saga.OrderID,
		},
	); err != nil {
		log.Printf("Failed to create outbox event: %v", err)
	}

	return nil
}

func (s *SagaService) executeStep(step *models.SagaStep, order *models.Order) error {
	switch step.ServiceName {
	case "coupon":
		return s.executeCouponStep(step, order)
	case "inventory":
		return s.executeInventoryStep(step, order)
	case "balance":
		return s.executeBalanceStep(step, order)
	case "order":
		return s.executeOrderStep(step, order)
	default:
		return fmt.Errorf("unknown service: %s", step.ServiceName)
	}
}

func (s *SagaService) executeCouponStep(step *models.SagaStep, order *models.Order) error {
	if order.CouponID == "" {
		return nil
	}

	switch step.Action {
	case "lock":
		return s.couponService.LockCoupon(order.ID, order.CouponID)
	case "use":
		return s.couponService.UseCoupon(order.ID, order.CouponID)
	default:
		return fmt.Errorf("unknown coupon action: %s", step.Action)
	}
}

func (s *SagaService) executeInventoryStep(step *models.SagaStep, order *models.Order) error {
	switch step.Action {
	case "lock":
		return s.inventoryService.LockInventory(order.ID, order.ProductID, order.Quantity)
	case "deduct":
		return s.inventoryService.DeductInventory(order.ID, order.ProductID, order.Quantity)
	default:
		return fmt.Errorf("unknown inventory action: %s", step.Action)
	}
}

func (s *SagaService) executeBalanceStep(step *models.SagaStep, order *models.Order) error {
	switch step.Action {
	case "freeze":
		return s.balanceService.FreezeBalance(order.ID, order.UserID, order.PayAmount)
	case "deduct":
		return s.balanceService.DeductBalance(order.ID, order.UserID, order.PayAmount)
	default:
		return fmt.Errorf("unknown balance action: %s", step.Action)
	}
}

func (s *SagaService) executeOrderStep(step *models.SagaStep, order *models.Order) error {
	switch step.Action {
	case "confirm":
		return s.orderService.UpdateOrderStatus(order.ID, models.OrderStatusCreated)
	default:
		return fmt.Errorf("unknown order action: %s", step.Action)
	}
}

func (s *SagaService) StartCompensation(sagaID string) error {
	var saga models.SagaInstance
	if err := s.db.Where("id = ?", sagaID).First(&saga).Error; err != nil {
		return fmt.Errorf("saga not found: %w", err)
	}

	saga.Status = models.SagaStatusCompensating
	saga.UpdatedAt = time.Now()
	s.db.Save(&saga)

	var steps []models.SagaStep
	if err := s.db.Where("saga_id = ? AND status = ?", sagaID, models.SagaStepStatusCompleted).
		Order("step_index DESC").Find(&steps).Error; err != nil {
		return fmt.Errorf("failed to get completed steps: %w", err)
	}

	order, err := s.orderService.GetOrder(saga.OrderID)
	if err != nil {
		return fmt.Errorf("failed to get order: %w", err)
	}

	for _, step := range steps {
		if step.Compensation == "" {
			continue
		}

		if err := s.compensationService.CreateTask(&saga, &step, order); err != nil {
			log.Printf("Failed to create compensation task: %v", err)
			continue
		}
	}

	return nil
}

func (s *SagaService) GetSaga(sagaID string) (*models.SagaInstance, error) {
	var saga models.SagaInstance
	if err := s.db.Where("id = ?", sagaID).First(&saga).Error; err != nil {
		return nil, fmt.Errorf("saga not found: %w", err)
	}
	return &saga, nil
}

func (s *SagaService) GetSagaSteps(sagaID string) ([]models.SagaStep, error) {
	var steps []models.SagaStep
	if err := s.db.Where("saga_id = ?", sagaID).Order("step_index ASC").Find(&steps).Error; err != nil {
		return nil, err
	}
	return steps, nil
}

func (s *SagaService) ListSagas(status models.SagaStatus) ([]models.SagaInstance, error) {
	var sagas []models.SagaInstance
	query := s.db.Order("created_at DESC")
	if status != "" {
		query = query.Where("status = ?", status)
	}
	err := query.Find(&sagas).Error
	return sagas, err
}

func (s *SagaService) GetSagaByOrderID(orderID string) (*models.SagaInstance, error) {
	var saga models.SagaInstance
	if err := s.db.Where("order_id = ?", orderID).First(&saga).Error; err != nil {
		return nil, fmt.Errorf("saga not found for order: %w", err)
	}
	return &saga, nil
}

type StepPayload struct {
	OrderID   string  `json:"order_id"`
	ProductID string  `json:"product_id"`
	UserID    string  `json:"user_id"`
	Quantity  int     `json:"quantity"`
	Amount    float64 `json:"amount"`
	CouponID  string  `json:"coupon_id,omitempty"`
}

func (s *SagaService) marshalPayload(payload StepPayload) string {
	data, _ := json.Marshal(payload)
	return string(data)
}
