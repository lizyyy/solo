package services

import (
	"fmt"
	"time"

	"gorm.io/gorm"

	"saga-demo/internal/database"
	"saga-demo/internal/models"
	"saga-demo/internal/utils"
)

type ManualHandlingService struct {
	db *gorm.DB
}

func NewManualHandlingService() *ManualHandlingService {
	return &ManualHandlingService{
		db: database.GetDB(),
	}
}

func (s *ManualHandlingService) CreateTask(sagaID, issueType, description string) (*models.ManualHandling, error) {
	var saga models.SagaInstance
	if err := s.db.Where("id = ?", sagaID).First(&saga).Error; err != nil {
		return nil, fmt.Errorf("saga not found: %w", err)
	}

	task := &models.ManualHandling{
		ID:          utils.GenerateTaskID(),
		SagaID:      sagaID,
		OrderID:     saga.OrderID,
		IssueType:   issueType,
		Description: description,
		Status:      models.ManualHandlingStatusPending,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.db.Create(task).Error; err != nil {
		return nil, fmt.Errorf("failed to create manual handling task: %w", err)
	}

	saga.Status = models.SagaStatusManualHandling
	saga.UpdatedAt = time.Now()
	s.db.Save(&saga)

	return task, nil
}

func (s *ManualHandlingService) GetTask(taskID string) (*models.ManualHandling, error) {
	var task models.ManualHandling
	if err := s.db.Where("id = ?", taskID).First(&task).Error; err != nil {
		return nil, fmt.Errorf("manual handling task not found: %w", err)
	}
	return &task, nil
}

func (s *ManualHandlingService) GetTasksBySaga(sagaID string) ([]models.ManualHandling, error) {
	var tasks []models.ManualHandling
	err := s.db.Where("saga_id = ?", sagaID).Order("created_at DESC").Find(&tasks).Error
	return tasks, err
}

func (s *ManualHandlingService) GetTasksByStatus(status models.ManualHandlingStatus) ([]models.ManualHandling, error) {
	var tasks []models.ManualHandling
	err := s.db.Where("status = ?", status).Order("created_at ASC").Find(&tasks).Error
	return tasks, err
}

func (s *ManualHandlingService) GetAllTasks() ([]models.ManualHandling, error) {
	var tasks []models.ManualHandling
	err := s.db.Order("created_at DESC").Find(&tasks).Error
	return tasks, err
}

func (s *ManualHandlingService) GetPendingTasks() ([]models.ManualHandling, error) {
	var tasks []models.ManualHandling
	err := s.db.Where("status = ?", models.ManualHandlingStatusPending).
		Order("created_at ASC").Find(&tasks).Error
	return tasks, err
}

func (s *ManualHandlingService) StartProcessing(taskID, assignedTo string) error {
	task, err := s.GetTask(taskID)
	if err != nil {
		return err
	}

	if task.Status != models.ManualHandlingStatusPending {
		return fmt.Errorf("task is not in pending status: %s", task.Status)
	}

	task.Status = models.ManualHandlingStatusProcessing
	task.AssignedTo = assignedTo
	task.UpdatedAt = time.Now()
	return s.db.Save(task).Error
}

func (s *ManualHandlingService) Resolve(taskID, resolution string) error {
	task, err := s.GetTask(taskID)
	if err != nil {
		return err
	}

	if task.Status != models.ManualHandlingStatusProcessing {
		return fmt.Errorf("task is not in processing status: %s", task.Status)
	}

	now := time.Now()
	task.Status = models.ManualHandlingStatusResolved
	task.Resolution = resolution
	task.ResolvedAt = &now
	task.UpdatedAt = now

	tx := s.db.Begin()

	if err := tx.Save(task).Error; err != nil {
		tx.Rollback()
		return err
	}

	var saga models.SagaInstance
	if err := tx.Where("id = ?", task.SagaID).First(&saga).Error; err == nil {
		if saga.Status == models.SagaStatusManualHandling {
			saga.Status = models.SagaStatusCompensated
			saga.UpdatedAt = now
			tx.Save(&saga)
		}
	}

	return tx.Commit().Error
}

func (s *ManualHandlingService) Escalate(taskID string) error {
	task, err := s.GetTask(taskID)
	if err != nil {
		return err
	}

	task.Status = models.ManualHandlingStatusEscalated
	task.UpdatedAt = time.Now()
	return s.db.Save(task).Error
}

func (s *ManualHandlingService) Assign(taskID, assignedTo string) error {
	task, err := s.GetTask(taskID)
	if err != nil {
		return err
	}

	task.AssignedTo = assignedTo
	task.UpdatedAt = time.Now()
	return s.db.Save(task).Error
}

func (s *ManualHandlingService) UpdateDescription(taskID, description string) error {
	task, err := s.GetTask(taskID)
	if err != nil {
		return err
	}

	task.Description = description
	task.UpdatedAt = time.Now()
	return s.db.Save(task).Error
}
