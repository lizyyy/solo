package service

import (
	"encoding/json"
	"fmt"
	"time"

	"export-quota-api/models"
	"export-quota-api/storage"
)

type QuotaManager struct {
	storage *storage.SQLiteStorage
}

func NewQuotaManager(storage *storage.SQLiteStorage) *QuotaManager {
	return &QuotaManager{storage: storage}
}

type CreateTaskRequest struct {
	TenantID string `json:"tenant_id"`
	FileName string `json:"file_name"`
	FileSize int64  `json:"file_size"`
	FileType string `json:"file_type"`
	Priority int    `json:"priority"`
}

type TaskResult struct {
	Task         *models.ExportTask       `json:"task"`
	Rejected     bool                     `json:"rejected"`
	RejectReason *models.RejectReason     `json:"reject_reason,omitempty"`
	RejectDetail string                   `json:"reject_detail,omitempty"`
}

func (qm *QuotaManager) CreateTask(req *CreateTaskRequest) (*TaskResult, error) {
	rawRequest, _ := json.Marshal(req)
	task := models.NewExportTask(req.TenantID, req.FileName, req.FileSize, req.FileType, string(rawRequest), req.Priority)

	tenant, err := qm.storage.GetTenant(req.TenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant: %w", err)
	}
	if tenant == nil {
		return nil, fmt.Errorf("tenant not found: %s", req.TenantID)
	}

	result := &TaskResult{Task: task}

	if err := qm.checkQuota(tenant, task, result); err != nil {
		return nil, err
	}

	if result.Rejected {
		task.Status = models.StatusRejected
		task.RejectReason = result.RejectReason
		task.RejectDetail = &result.RejectDetail
		task.ProcessingLog = fmt.Sprintf("Rejected at %s: %s - %s", time.Now().Format(time.RFC3339), *result.RejectReason, result.RejectDetail)
	}

	if err := qm.storage.CreateTask(task); err != nil {
		return nil, fmt.Errorf("failed to create task: %w", err)
	}

	if !result.Rejected {
		if err := qm.transitionTaskStatus(task, models.StatusPending, models.StatusQueued, "Task accepted and queued for execution", nil); err != nil {
			return nil, fmt.Errorf("failed to transition task status: %w", err)
		}
	}

	return result, nil
}

func (qm *QuotaManager) checkQuota(tenant *models.Tenant, task *models.ExportTask, result *TaskResult) error {
	maxFileSize := tenant.MaxDailySize / 2
	if task.FileSize > maxFileSize {
		result.Rejected = true
		reason := models.RejectFileTooLarge
		result.RejectReason = &reason
		result.RejectDetail = fmt.Sprintf("File size %d exceeds maximum allowed size %d", task.FileSize, maxFileSize)
		return nil
	}

	runningCount, err := qm.storage.CountTasksByStatus(tenant.ID, models.StatusRunning)
	if err != nil {
		return fmt.Errorf("failed to count running tasks: %w", err)
	}

	queuedCount, err := qm.storage.CountTasksByStatus(tenant.ID, models.StatusQueued)
	if err != nil {
		return fmt.Errorf("failed to count queued tasks: %w", err)
	}

	if runningCount >= tenant.MaxConcurrent {
		if queuedCount >= tenant.MaxQueueSize {
			result.Rejected = true
			reason := models.RejectQueueFull
			result.RejectReason = &reason
			result.RejectDetail = fmt.Sprintf("Queue is full (max %d), cannot accept more tasks", tenant.MaxQueueSize)
			return nil
		}
		return nil
	}

	window, err := qm.getOrCreateDailyWindow(tenant)
	if err != nil {
		return fmt.Errorf("failed to get quota window: %w", err)
	}

	if window.UsedSize+task.FileSize > window.MaxSize {
		result.Rejected = true
		reason := models.RejectQuotaExceeded
		result.RejectReason = &reason
		result.RejectDetail = fmt.Sprintf("Daily quota exceeded. Used: %d, Max: %d, Requested: %d", window.UsedSize, window.MaxSize, task.FileSize)
		return nil
	}

	return nil
}

func (qm *QuotaManager) getOrCreateDailyWindow(tenant *models.Tenant) (*models.QuotaWindow, error) {
	window, err := qm.storage.GetCurrentQuotaWindow(tenant.ID, "daily")
	if err != nil {
		return nil, err
	}

	if window == nil {
		now := time.Now()
		startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		endOfDay := startOfDay.Add(24 * time.Hour)
		window = models.NewQuotaWindow(tenant.ID, "daily", startOfDay, endOfDay, tenant.MaxDailySize, 100)
		if err := qm.storage.CreateQuotaWindow(window); err != nil {
			return nil, fmt.Errorf("failed to create quota window: %w", err)
		}
	}

	return window, nil
}

func (qm *QuotaManager) transitionTaskStatus(task *models.ExportTask, fromStatus, toStatus models.ExportTaskStatus, reason string, operator *string) error {
	history := models.NewTaskHistory(task.ID, fromStatus, toStatus, reason, operator)
	if err := qm.storage.CreateTaskHistory(history); err != nil {
		return fmt.Errorf("failed to create task history: %w", err)
	}

	task.Status = toStatus
	task.ProcessingLog += fmt.Sprintf("\n[%s] %s -> %s: %s", time.Now().Format(time.RFC3339), fromStatus, toStatus, reason)
	if err := qm.storage.UpdateTask(task); err != nil {
		return fmt.Errorf("failed to update task status: %w", err)
	}

	return nil
}

func (qm *QuotaManager) StartTask(taskID string) (*models.ExportTask, error) {
	task, err := qm.storage.GetTask(taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to get task: %w", err)
	}
	if task == nil {
		return nil, fmt.Errorf("task not found: %s", taskID)
	}

	if task.Status != models.StatusQueued {
		return nil, fmt.Errorf("task is not in queued state: %s", task.Status)
	}

	tenant, err := qm.storage.GetTenant(task.TenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant: %w", err)
	}

	runningCount, err := qm.storage.CountTasksByStatus(tenant.ID, models.StatusRunning)
	if err != nil {
		return nil, fmt.Errorf("failed to count running tasks: %w", err)
	}

	if runningCount >= tenant.MaxConcurrent {
		return nil, fmt.Errorf("concurrent task limit reached: %d", tenant.MaxConcurrent)
	}

	window, err := qm.getOrCreateDailyWindow(tenant)
	if err != nil {
		return nil, fmt.Errorf("failed to get quota window: %w", err)
	}

	window.UsedSize += task.FileSize
	window.UsedCount++
	if err := qm.storage.UpdateQuotaWindow(window); err != nil {
		return nil, fmt.Errorf("failed to update quota window: %w", err)
	}

	now := time.Now()
	task.StartedAt = &now
	if err := qm.transitionTaskStatus(task, models.StatusQueued, models.StatusRunning, "Task started for execution", nil); err != nil {
		return nil, err
	}

	return task, nil
}

func (qm *QuotaManager) CompleteTask(taskID string, downloadURL string) (*models.ExportTask, error) {
	task, err := qm.storage.GetTask(taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to get task: %w", err)
	}
	if task == nil {
		return nil, fmt.Errorf("task not found: %s", taskID)
	}

	if task.Status != models.StatusRunning {
		return nil, fmt.Errorf("task is not in running state: %s", task.Status)
	}

	now := time.Now()
	task.CompletedAt = &now
	task.DownloadURL = &downloadURL

	if err := qm.transitionTaskStatus(task, models.StatusRunning, models.StatusCompleted, "Task completed successfully", nil); err != nil {
		return nil, err
	}

	return task, nil
}

func (qm *QuotaManager) FailTask(taskID string, reason string) (*models.ExportTask, error) {
	task, err := qm.storage.GetTask(taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to get task: %w", err)
	}
	if task == nil {
		return nil, fmt.Errorf("task not found: %s", taskID)
	}

	if task.Status != models.StatusRunning {
		return nil, fmt.Errorf("task is not in running state: %s", task.Status)
	}

	now := time.Now()
	task.CompletedAt = &now

	if err := qm.transitionTaskStatus(task, models.StatusRunning, models.StatusFailed, fmt.Sprintf("Task failed: %s", reason), nil); err != nil {
		return nil, err
	}

	return task, nil
}

func (qm *QuotaManager) ManualRetry(taskID string, operator string) (*models.ExportTask, error) {
	task, err := qm.storage.GetTask(taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to get task: %w", err)
	}
	if task == nil {
		return nil, fmt.Errorf("task not found: %s", taskID)
	}

	if task.Status != models.StatusFailed && task.Status != models.StatusRejected {
		return nil, fmt.Errorf("task cannot be retried from state: %s", task.Status)
	}

	task.StartedAt = nil
	task.CompletedAt = nil
	task.RejectReason = nil
	task.RejectDetail = nil

	if err := qm.transitionTaskStatus(task, task.Status, models.StatusQueued, fmt.Sprintf("Manual retry by operator: %s", operator), &operator); err != nil {
		return nil, err
	}

	return task, nil
}

func (qm *QuotaManager) ManualAdjustQuota(tenantID string, additionalSize int64, operator string) (*models.QuotaWindow, error) {
	tenant, err := qm.storage.GetTenant(tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant: %w", err)
	}
	if tenant == nil {
		return nil, fmt.Errorf("tenant not found: %s", tenantID)
	}

	window, err := qm.getOrCreateDailyWindow(tenant)
	if err != nil {
		return nil, fmt.Errorf("failed to get quota window: %w", err)
	}

	window.MaxSize += additionalSize
	window.UpdatedAt = time.Now()

	if err := qm.storage.UpdateQuotaWindow(window); err != nil {
		return nil, fmt.Errorf("failed to update quota window: %w", err)
	}

	return window, nil
}

func (qm *QuotaManager) ProcessNextTasks(tenantID string) ([]*models.ExportTask, error) {
	tenant, err := qm.storage.GetTenant(tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant: %w", err)
	}
	if tenant == nil {
		return nil, fmt.Errorf("tenant not found: %s", tenantID)
	}

	runningCount, err := qm.storage.CountTasksByStatus(tenantID, models.StatusRunning)
	if err != nil {
		return nil, fmt.Errorf("failed to count running tasks: %w", err)
	}

	availableSlots := tenant.MaxConcurrent - runningCount
	if availableSlots <= 0 {
		return []*models.ExportTask{}, nil
	}

	queuedTasks, err := qm.storage.GetQueuedTasksForExecution(tenantID, availableSlots)
	if err != nil {
		return nil, fmt.Errorf("failed to get queued tasks: %w", err)
	}

	var startedTasks []*models.ExportTask
	for _, task := range queuedTasks {
		startedTask, err := qm.StartTask(task.ID)
		if err != nil {
			continue
		}
		startedTasks = append(startedTasks, startedTask)
	}

	return startedTasks, nil
}

func (qm *QuotaManager) GetTaskWithHistory(taskID string) (*models.ExportTask, []*models.TaskHistory, error) {
	task, err := qm.storage.GetTask(taskID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get task: %w", err)
	}
	if task == nil {
		return nil, nil, fmt.Errorf("task not found: %s", taskID)
	}

	history, err := qm.storage.GetTaskHistory(taskID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get task history: %w", err)
	}

	return task, history, nil
}

func (qm *QuotaManager) GetTenantStatus(tenantID string) (map[string]interface{}, error) {
	tenant, err := qm.storage.GetTenant(tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant: %w", err)
	}
	if tenant == nil {
		return nil, fmt.Errorf("tenant not found: %s", tenantID)
	}

	runningCount, _ := qm.storage.CountTasksByStatus(tenantID, models.StatusRunning)
	queuedCount, _ := qm.storage.CountTasksByStatus(tenantID, models.StatusQueued)
	completedCount, _ := qm.storage.CountTasksByStatus(tenantID, models.StatusCompleted)
	failedCount, _ := qm.storage.CountTasksByStatus(tenantID, models.StatusFailed)
	rejectedCount, _ := qm.storage.CountTasksByStatus(tenantID, models.StatusRejected)

	window, err := qm.getOrCreateDailyWindow(tenant)
	if err != nil {
		return nil, err
	}

	status := map[string]interface{}{
		"tenant": tenant,
		"tasks": map[string]int{
			"running":   runningCount,
			"queued":    queuedCount,
			"completed": completedCount,
			"failed":    failedCount,
			"rejected":  rejectedCount,
		},
		"quota_window": window,
	}

	return status, nil
}
