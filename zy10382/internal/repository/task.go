package repository

import (
	"customer-probe-api/internal/models"
	"customer-probe-api/pkg/database"
	"customer-probe-api/pkg/utils"
	"time"

	"gorm.io/gorm"
)

type TaskRepository struct{}

func NewTaskRepository() *TaskRepository {
	return &TaskRepository{}
}

func (r *TaskRepository) CreateWithIdempotency(task *models.ProbeTask, idempotencyKey string) (*models.ProbeTask, bool, error) {
	var existingTask models.ProbeTask
	err := database.GetDB().Where("idempotency_key = ?", idempotencyKey).First(&existingTask).Error
	if err == nil {
		return &existingTask, true, nil
	}

	task.IdempotencyKey = idempotencyKey
	if task.ID == "" {
		task.ID = utils.GenerateID()
	}
	if task.Status == "" {
		task.Status = models.TaskStatusPending
	}

	if err := database.GetDB().Create(task).Error; err != nil {
		return nil, false, err
	}
	return task, false, nil
}

func (r *TaskRepository) GetByID(id string) (*models.ProbeTask, error) {
	var task models.ProbeTask
	if err := database.GetDB().First(&task, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *TaskRepository) GetByIdempotencyKey(key string) (*models.ProbeTask, error) {
	var task models.ProbeTask
	if err := database.GetDB().Where("idempotency_key = ?", key).First(&task).Error; err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *TaskRepository) UpdateStatus(taskID, status, errorMsg string) error {
	updates := map[string]interface{}{
		"status":     status,
		"updated_at": time.Now(),
	}
	if errorMsg != "" {
		updates["error_msg"] = errorMsg
	}
	if status == models.TaskStatusRunning {
		updates["started_at"] = time.Now()
	}
	if status == models.TaskStatusCompleted || status == models.TaskStatusFailed || status == models.TaskStatusTimeout {
		updates["completed_at"] = time.Now()
	}
	return database.GetDB().Model(&models.ProbeTask{}).Where("id = ?", taskID).Updates(updates).Error
}

func (r *TaskRepository) AssignTask(taskID, agent string) error {
	return database.GetDB().Model(&models.ProbeTask{}).
		Where("id = ? AND status = ?", taskID, models.TaskStatusPending).
		Updates(map[string]interface{}{
			"status":        models.TaskStatusAssigned,
			"assigned_agent": agent,
			"updated_at":    time.Now(),
		}).Error
}

func (r *TaskRepository) IncrementRetry(taskID string) error {
	return database.GetDB().Model(&models.ProbeTask{}).
		Where("id = ?", taskID).
		Updates(map[string]interface{}{
			"retry_count": database.GetDB().Raw("retry_count + 1"),
			"updated_at":  time.Now(),
		}).Error
}

func (r *TaskRepository) ListByEnvID(envID string, page, pageSize int) ([]models.ProbeTask, int64, error) {
	var tasks []models.ProbeTask
	var total int64
	db := database.GetDB().Model(&models.ProbeTask{}).Where("env_id = ?", envID)
	db.Count(&total)
	offset := (page - 1) * pageSize
	if err := db.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&tasks).Error; err != nil {
		return nil, 0, err
	}
	return tasks, total, nil
}

func (r *TaskRepository) ListByStatus(status string, page, pageSize int) ([]models.ProbeTask, int64, error) {
	var tasks []models.ProbeTask
	var total int64
	db := database.GetDB().Model(&models.ProbeTask{})
	if status != "" {
		db = db.Where("status = ?", status)
	}
	db.Count(&total)
	offset := (page - 1) * pageSize
	if err := db.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&tasks).Error; err != nil {
		return nil, 0, err
	}
	return tasks, total, nil
}

func (r *TaskRepository) GetTaskHistory(envID string, startTime, endTime time.Time) ([]models.ProbeTask, error) {
	var tasks []models.ProbeTask
	db := database.GetDB().Where("env_id = ? AND created_at >= ? AND created_at <= ?", envID, startTime, endTime)
	if err := db.Order("created_at DESC").Find(&tasks).Error; err != nil {
		return nil, err
	}
	return tasks, nil
}

func (r *TaskRepository) Delete(id string) error {
	return database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(&models.NetworkResult{}, "task_id = ?", id).Error; err != nil {
			return err
		}
		if err := tx.Delete(&models.DNSRecord{}, "task_id = ?", id).Error; err != nil {
			return err
		}
		if err := tx.Delete(&models.DiagnosisConclusion{}, "task_id = ?", id).Error; err != nil {
			return err
		}
		if err := tx.Delete(&models.ProbeTask{}, "id = ?", id).Error; err != nil {
			return err
		}
		return nil
	})
}
