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

type CompensationService struct {
	db               *gorm.DB
	orderService     *OrderService
	inventoryService *InventoryService
	balanceService   *BalanceService
	couponService    *CouponService
	manualService    *ManualHandlingService
}

func NewCompensationService(
	orderService *OrderService,
	inventoryService *InventoryService,
	balanceService *BalanceService,
	couponService *CouponService,
	manualService *ManualHandlingService,
) *CompensationService {
	return &CompensationService{
		db:               database.GetDB(),
		orderService:     orderService,
		inventoryService: inventoryService,
		balanceService:   balanceService,
		couponService:    couponService,
		manualService:    manualService,
	}
}

type CompensationPayload struct {
	OrderID   string  `json:"order_id"`
	ProductID string  `json:"product_id"`
	UserID    string  `json:"user_id"`
	Quantity  int     `json:"quantity"`
	Amount    float64 `json:"amount"`
	CouponID  string  `json:"coupon_id,omitempty"`
}

func (s *CompensationService) CreateTask(
	saga *models.SagaInstance,
	step *models.SagaStep,
	order *models.Order,
) error {
	payload := CompensationPayload{
		OrderID:   order.ID,
		ProductID: order.ProductID,
		UserID:    order.UserID,
		Quantity:  order.Quantity,
		Amount:    order.PayAmount,
		CouponID:  order.CouponID,
	}

	payloadJSON, _ := json.Marshal(payload)

	task := &models.CompensationTask{
		ID:           utils.GenerateTaskID(),
		SagaID:       saga.ID,
		StepID:       step.ID,
		StepName:     step.StepName,
		ServiceName:  step.ServiceName,
		Compensation: step.Compensation,
		Payload:      string(payloadJSON),
		Status:       models.CompensationStatusPending,
		RetryCount:   0,
		MaxRetries:   5,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	return s.db.Create(task).Error
}

func (s *CompensationService) GetPendingTasks() ([]models.CompensationTask, error) {
	var tasks []models.CompensationTask
	err := s.db.Where("status = ? OR (status = ? AND retry_count < max_retries)",
		models.CompensationStatusPending,
		models.CompensationStatusFailed,
	).Order("created_at ASC").Find(&tasks).Error
	return tasks, err
}

func (s *CompensationService) ExecuteTask(task *models.CompensationTask) error {
	task.Status = models.CompensationStatusRunning
	task.UpdatedAt = time.Now()
	s.db.Save(task)

	var payload CompensationPayload
	if err := json.Unmarshal([]byte(task.Payload), &payload); err != nil {
		return s.markTaskFailed(task, fmt.Sprintf("failed to unmarshal payload: %v", err))
	}

	var err error
	switch task.ServiceName {
	case "coupon":
		err = s.executeCouponCompensation(task, &payload)
	case "inventory":
		err = s.executeInventoryCompensation(task, &payload)
	case "balance":
		err = s.executeBalanceCompensation(task, &payload)
	case "order":
		err = s.executeOrderCompensation(task, &payload)
	default:
		err = fmt.Errorf("unknown service: %s", task.ServiceName)
	}

	if err != nil {
		return s.handleTaskFailure(task, err)
	}

	return s.markTaskCompleted(task)
}

func (s *CompensationService) executeCouponCompensation(task *models.CompensationTask, payload *CompensationPayload) error {
	if payload.CouponID == "" {
		return nil
	}

	switch task.Compensation {
	case "release":
		return s.couponService.ReleaseCoupon(payload.OrderID, payload.CouponID)
	case "restore":
		return s.couponService.ReleaseCoupon(payload.OrderID, payload.CouponID)
	default:
		return fmt.Errorf("unknown coupon compensation: %s", task.Compensation)
	}
}

func (s *CompensationService) executeInventoryCompensation(task *models.CompensationTask, payload *CompensationPayload) error {
	switch task.Compensation {
	case "release":
		return s.inventoryService.ReleaseInventory(payload.OrderID, payload.ProductID, payload.Quantity)
	case "restore":
		return s.inventoryService.ReleaseInventory(payload.OrderID, payload.ProductID, payload.Quantity)
	default:
		return fmt.Errorf("unknown inventory compensation: %s", task.Compensation)
	}
}

func (s *CompensationService) executeBalanceCompensation(task *models.CompensationTask, payload *CompensationPayload) error {
	switch task.Compensation {
	case "release":
		return s.balanceService.ReleaseBalance(payload.OrderID, payload.UserID, payload.Amount)
	case "restore":
		return s.balanceService.ReleaseBalance(payload.OrderID, payload.UserID, payload.Amount)
	default:
		return fmt.Errorf("unknown balance compensation: %s", task.Compensation)
	}
}

func (s *CompensationService) executeOrderCompensation(task *models.CompensationTask, payload *CompensationPayload) error {
	switch task.Compensation {
	case "cancel":
		return s.orderService.CancelOrder(payload.OrderID)
	default:
		return fmt.Errorf("unknown order compensation: %s", task.Compensation)
	}
}

func (s *CompensationService) handleTaskFailure(task *models.CompensationTask, err error) error {
	task.RetryCount++
	task.ErrorMessage = err.Error()
	now := time.Now()
	task.LastRetryAt = &now

	if task.RetryCount >= task.MaxRetries {
		log.Printf("Compensation task %s failed after %d retries, creating manual handling task", task.ID, task.MaxRetries)
		task.Status = models.CompensationStatusFailed
		task.UpdatedAt = time.Now()
		s.db.Save(task)

		if s.manualService != nil {
			_, createErr := s.manualService.CreateTask(
				task.SagaID,
				task.StepName,
				fmt.Sprintf("Compensation failed for step %s: %v", task.StepName, err),
			)
			if createErr != nil {
				log.Printf("Failed to create manual handling task: %v", createErr)
			}
		}

		return fmt.Errorf("compensation task failed after max retries: %w", err)
	}

	task.Status = models.CompensationStatusFailed
	task.UpdatedAt = time.Now()
	s.db.Save(task)

	return err
}

func (s *CompensationService) markTaskFailed(task *models.CompensationTask, errorMsg string) error {
	task.Status = models.CompensationStatusFailed
	task.ErrorMessage = errorMsg
	task.UpdatedAt = time.Now()
	s.db.Save(task)
	return fmt.Errorf(errorMsg)
}

func (s *CompensationService) markTaskCompleted(task *models.CompensationTask) error {
	task.Status = models.CompensationStatusCompleted
	task.UpdatedAt = time.Now()
	s.db.Save(task)

	var pendingCount int64
	s.db.Model(&models.CompensationTask{}).
		Where("saga_id = ? AND status IN ?", task.SagaID,
			[]models.CompensationStatus{
				models.CompensationStatusPending,
				models.CompensationStatusRunning,
				models.CompensationStatusFailed,
			}).Count(&pendingCount)

	if pendingCount == 0 {
		var saga models.SagaInstance
		if err := s.db.Where("id = ?", task.SagaID).First(&saga).Error; err == nil {
			saga.Status = models.SagaStatusCompensated
			saga.UpdatedAt = time.Now()
			s.db.Save(&saga)

			if err := s.orderService.UpdateOrderStatus(saga.OrderID, models.OrderStatusCompensated); err != nil {
				log.Printf("Failed to update order status to compensated: %v", err)
			}
		}
	}

	return nil
}

func (s *CompensationService) ProcessPendingTasks() error {
	tasks, err := s.GetPendingTasks()
	if err != nil {
		return err
	}

	for i := range tasks {
		task := &tasks[i]
		if err := s.ExecuteTask(task); err != nil {
			log.Printf("Failed to execute compensation task %s: %v", task.ID, err)
		}
	}

	return nil
}

func (s *CompensationService) GetTasksBySaga(sagaID string) ([]models.CompensationTask, error) {
	var tasks []models.CompensationTask
	err := s.db.Where("saga_id = ?", sagaID).Order("created_at ASC").Find(&tasks).Error
	return tasks, err
}

func (s *CompensationService) GetAllTasks() ([]models.CompensationTask, error) {
	var tasks []models.CompensationTask
	err := s.db.Order("created_at DESC").Find(&tasks).Error
	return tasks, err
}
