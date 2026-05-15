package service

import (
	"customer-probe-api/internal/models"
	"customer-probe-api/internal/repository"
	"customer-probe-api/pkg/utils"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

type TaskService struct {
	taskRepo        *repository.TaskRepository
	envRepo         *repository.EnvironmentRepository
	networkRepo     *repository.NetworkResultRepository
	dnsRepo         *repository.DNSRecordRepository
	conclusionRepo  *repository.ConclusionRepository
}

func NewTaskService() *TaskService {
	return &TaskService{
		taskRepo:       repository.NewTaskRepository(),
		envRepo:        repository.NewEnvironmentRepository(),
		networkRepo:    repository.NewNetworkResultRepository(),
		dnsRepo:        repository.NewDNSRecordRepository(),
		conclusionRepo: repository.NewConclusionRepository(),
	}
}

type CreateTaskRequest struct {
	EnvID          string `json:"env_id"`
	TaskType       string `json:"task_type"`
	TargetURL      string `json:"target_url"`
	Priority       int    `json:"priority"`
	TimeoutSeconds int    `json:"timeout_seconds"`
	MaxRetries     int    `json:"max_retries"`
	IdempotencyKey string `json:"idempotency_key"`
}

func (s *TaskService) CreateTask(req CreateTaskRequest) (*models.ProbeTask, bool, error) {
	if req.EnvID == "" {
		return nil, false, errors.New("env_id is required")
	}
	if req.TaskType == "" {
		return nil, false, errors.New("task_type is required")
	}

	_, err := s.envRepo.GetByID(req.EnvID)
	if err != nil {
		return nil, false, errors.New("environment not found")
	}

	idempotencyKey := req.IdempotencyKey
	if idempotencyKey == "" {
		idempotencyKey = s.generateIdempotencyKey(req)
	}

	task := &models.ProbeTask{
		EnvID:          req.EnvID,
		TaskType:       req.TaskType,
		TargetURL:      req.TargetURL,
		Priority:       req.Priority,
		TimeoutSeconds: req.TimeoutSeconds,
		MaxRetries:     req.MaxRetries,
		Status:         models.TaskStatusPending,
	}

	return s.taskRepo.CreateWithIdempotency(task, idempotencyKey)
}

func (s *TaskService) generateIdempotencyKey(req CreateTaskRequest) string {
	data := map[string]interface{}{
		"env_id":     req.EnvID,
		"task_type":  req.TaskType,
		"target_url": req.TargetURL,
		"date":       time.Now().Format("20060102"),
	}
	jsonData, _ := json.Marshal(data)
	return utils.GenerateIdempotencyKey(jsonData)
}

func (s *TaskService) GetTask(id string) (*models.ProbeTask, error) {
	return s.taskRepo.GetByID(id)
}

func (s *TaskService) GetTaskByIdempotencyKey(key string) (*models.ProbeTask, error) {
	return s.taskRepo.GetByIdempotencyKey(key)
}

func (s *TaskService) ListTasksByEnv(envID string, page, pageSize int) ([]models.ProbeTask, int64, error) {
	return s.taskRepo.ListByEnvID(envID, page, pageSize)
}

func (s *TaskService) ListTasksByStatus(status string, page, pageSize int) ([]models.ProbeTask, int64, error) {
	return s.taskRepo.ListByStatus(status, page, pageSize)
}

func (s *TaskService) AssignTask(taskID, agent string) error {
	return s.taskRepo.AssignTask(taskID, agent)
}

func (s *TaskService) StartTask(taskID string) error {
	task, err := s.taskRepo.GetByID(taskID)
	if err != nil {
		return err
	}
	if task.Status != models.TaskStatusAssigned && task.Status != models.TaskStatusPending {
		return errors.New("task is not in assignable or pending status")
	}
	return s.taskRepo.UpdateStatus(taskID, models.TaskStatusRunning, "")
}

func (s *TaskService) CompleteTask(taskID string, networkResult *models.NetworkResult, dnsRecords []models.DNSRecord) error {
	if networkResult != nil {
		networkResult.TaskID = taskID
		if _, err := s.networkRepo.Create(networkResult); err != nil {
			return err
		}
	}

	for i := range dnsRecords {
		dnsRecords[i].TaskID = taskID
		if _, err := s.dnsRepo.Create(&dnsRecords[i]); err != nil {
			return err
		}
	}

	if err := s.taskRepo.UpdateStatus(taskID, models.TaskStatusCompleted, ""); err != nil {
		return err
	}

	go s.GenerateConclusion(taskID)
	return nil
}

func (s *TaskService) FailTask(taskID, errorMsg string) error {
	if err := s.taskRepo.UpdateStatus(taskID, models.TaskStatusFailed, errorMsg); err != nil {
		return err
	}
	go s.GenerateConclusion(taskID)
	return nil
}

func (s *TaskService) TimeoutTask(taskID string) error {
	return s.taskRepo.UpdateStatus(taskID, models.TaskStatusTimeout, "task execution timeout")
}

func (s *TaskService) GetTaskHistory(envID string, startTime, endTime time.Time) ([]models.ProbeTask, error) {
	return s.taskRepo.GetTaskHistory(envID, startTime, endTime)
}

func (s *TaskService) GenerateConclusion(taskID string) error {
	task, err := s.taskRepo.GetByID(taskID)
	if err != nil {
		return err
	}

	networkResults, _ := s.networkRepo.GetByTaskID(taskID)
	dnsRecords, _ := s.dnsRepo.GetByTaskID(taskID)

	conclusion := &models.DiagnosisConclusion{
		TaskID:      taskID,
		GeneratedBy: "system",
	}

	if task.Status == models.TaskStatusCompleted {
		hasSuccess := false
		for _, nr := range networkResults {
			if nr.Success && nr.HTTPStatusCode >= 200 && nr.HTTPStatusCode < 300 {
				hasSuccess = true
				break
			}
		}

		if hasSuccess {
			conclusion.Conclusion = "探针任务执行成功，网络连接正常"
			conclusion.Severity = models.SeverityLow
			conclusion.RootCause = "无"
			conclusion.Suggestions = "继续监控网络状态"
		} else {
			conclusion.Conclusion = "探针任务完成但网络请求异常"
			conclusion.Severity = models.SeverityMedium
			conclusion.RootCause = s.analyzeRootCause(networkResults, dnsRecords)
			conclusion.Suggestions = "检查目标服务可用性和网络配置"
		}
	} else {
		conclusion.Conclusion = fmt.Sprintf("探针任务执行失败: %s", task.ErrorMsg)
		conclusion.Severity = models.SeverityHigh
		conclusion.RootCause = task.ErrorMsg
		conclusion.Suggestions = "排查探针执行环境和网络连通性"
	}

	_, err = s.conclusionRepo.Create(conclusion)
	return err
}

func (s *TaskService) analyzeRootCause(networkResults []models.NetworkResult, dnsRecords []models.DNSRecord) string {
	for _, dns := range dnsRecords {
		if dns.ErrorMsg != "" {
			return fmt.Sprintf("DNS解析失败: %s", dns.ErrorMsg)
		}
	}

	for _, nr := range networkResults {
		if nr.ErrorMessage != "" {
			return fmt.Sprintf("网络连接错误: %s", nr.ErrorMessage)
		}
		if nr.HTTPStatusCode >= 500 {
			return fmt.Sprintf("服务器错误: HTTP %d", nr.HTTPStatusCode)
		}
		if nr.HTTPStatusCode >= 400 {
			return fmt.Sprintf("客户端错误: HTTP %d", nr.HTTPStatusCode)
		}
	}

	return "未知原因，建议检查完整日志"
}

func (s *TaskService) GetTaskFullData(taskID string) (map[string]interface{}, error) {
	task, err := s.taskRepo.GetByID(taskID)
	if err != nil {
		return nil, err
	}

	networkResults, _ := s.networkRepo.GetByTaskID(taskID)
	dnsRecords, _ := s.dnsRepo.GetByTaskID(taskID)
	conclusion, _ := s.conclusionRepo.GetByTaskID(taskID)

	result := map[string]interface{}{
		"task":            task,
		"network_results": networkResults,
		"dns_records":     dnsRecords,
		"conclusion":      conclusion,
	}

	return result, nil
}
