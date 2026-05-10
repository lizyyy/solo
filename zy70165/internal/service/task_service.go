package service

import (
	"certificate-renewal-api/internal/config"
	"certificate-renewal-api/internal/models"
	"certificate-renewal-api/internal/repository"
	"certificate-renewal-api/internal/util"
	"fmt"
	"log"
)

type TaskService struct {
	store       repository.Store
	certService *CertificateService
	config      *config.Config
	healthCheck *HealthCheckService
	deployer    *DeployerService
	rollback    *RollbackService
}

func NewTaskService(store repository.Store, certService *CertificateService, config *config.Config) *TaskService {
	healthCheck := NewHealthCheckService(config)
	deployer := NewDeployerService(healthCheck)
	rollback := NewRollbackService(store, healthCheck, config)
	
	return &TaskService{
		store:       store,
		certService: certService,
		config:      config,
		healthCheck: healthCheck,
		deployer:    deployer,
		rollback:    rollback,
	}
}

func (s *TaskService) CreateTask(cert *models.Certificate, targets []models.DeploymentTarget) (*models.RenewalTask, error) {
	activeTasks := s.store.FindActiveTasks()
	for _, t := range activeTasks {
		if t.CertificateID == cert.ID && !t.IsRollback {
			return nil, fmt.Errorf("%w: active task %s exists for certificate %s", 
				models.ErrTaskConflict, t.ID, cert.ID)
		}
	}
	
	newCert, err := s.certService.RenewCertificate(cert)
	if err != nil {
		return nil, err
	}
	
	now := util.Now()
	timeoutAt := now.Add(s.config.TaskScheduler.TaskTimeout)
	
	task := &models.RenewalTask{
		ID:             util.GenerateID("task"),
		CertificateID:  cert.ID,
		NewCertificate: newCert,
		OldCertificate: cert,
		Status:         models.TaskStatusPending,
		Targets:        targets,
		Priority:       50,
		RetryCount:     0,
		MaxRetries:     s.config.TaskScheduler.MaxRetries,
		CreatedAt:      now,
		TimeoutAt:      &timeoutAt,
		IsRollback:     false,
	}
	
	if err := s.store.CreateTask(task); err != nil {
		return nil, err
	}
	
	for _, target := range targets {
		receipt := &models.DeploymentReceipt{
			ID:            util.GenerateID("receipt"),
			TaskID:        task.ID,
			TargetID:      target.ID,
			TargetType:    target.Type,
			CertificateID: newCert.ID,
			Status:        models.ReceiptStatusPending,
			CreatedAt:     util.Now(),
			UpdatedAt:     util.Now(),
		}
		if err := s.store.CreateReceipt(receipt); err != nil {
			return nil, err
		}
	}
	
	return task, nil
}

func (s *TaskService) GetTask(id string) (*models.RenewalTask, error) {
	return s.store.GetTask(id)
}

func (s *TaskService) ListTasks() []*models.RenewalTask {
	return s.store.ListTasks()
}

func (s *TaskService) ProcessTask(taskID string) error {
	task, err := s.store.GetTask(taskID)
	if err != nil {
		return err
	}
	
	if task.HasTimedOut() {
		task.Status = models.TaskStatusTimeout
		task.ErrorMessages = append(task.ErrorMessages, "task timed out")
		if err := s.store.UpdateTask(task); err != nil {
			return err
		}
		if s.config.Rollback.Enabled {
			return s.rollback.ExecuteRollback(task)
		}
		return models.ErrTaskTimeout
	}
	
	if !task.IsPending() {
		return fmt.Errorf("%w: task is not in pending state", models.ErrInvalidStatus)
	}
	
	now := util.Now()
	task.Status = models.TaskStatusProcessing
	task.StartedAt = &now
	if err := s.store.UpdateTask(task); err != nil {
		return err
	}
	
	receipts := s.store.ListReceiptsByTask(task.ID)
	task.Receipts = make([]models.DeploymentReceipt, 0, len(receipts))
	
	for i := range receipts {
		receipt := receipts[i]
		target := s.findTarget(task, receipt.TargetID)
		if target == nil {
			continue
		}
		
		result := s.deployer.Deploy(task, target, receipt)
		receipt.Status = result.Status
		receipt.Error = result.Error
		receipt.HealthCheck = result.HealthCheck
		receipt.DeployedAt = result.DeployedAt
		receipt.VerifiedAt = result.VerifiedAt
		receipt.UpdatedAt = util.Now()
		
		if err := s.store.UpdateReceipt(receipt); err != nil {
			return err
		}
		task.Receipts = append(task.Receipts, *receipt)
	}
	
	finalStatus := models.DetermineFinalStatus(task)
	task.Status = finalStatus
	
	if task.HasUnresolvedConflicts() {
		task.Status = models.TaskStatusConflict
	}
	
	if task.Status == models.TaskStatusPendingRetry {
		delay := util.CalculateRetryDelay(task.RetryCount, s.config.TaskScheduler.RetryBackoffBase)
		nextRetry := util.Now().Add(delay)
		task.NextRetryAt = &nextRetry
	}
	
	if task.Status == models.TaskStatusCompleted {
		completedAt := util.Now()
		task.CompletedAt = &completedAt
		
		if task.NewCertificate != nil {
			task.NewCertificate.Status = models.CertStatusRenewed
			if err := s.store.UpdateCertificate(task.NewCertificate); err != nil {
				return err
			}
		}
		
		if task.OldCertificate != nil {
			task.OldCertificate.Status = models.CertStatusRolledBack
			if err := s.store.UpdateCertificate(task.OldCertificate); err != nil {
				return err
			}
		}
	}
	
	if err := s.store.UpdateTask(task); err != nil {
		return err
	}
	
	if task.Status == models.TaskStatusFailed || 
	   task.Status == models.TaskStatusConflict ||
	   task.Status == models.TaskStatusTimeout {
		
		if s.config.Rollback.Enabled && task.CanRetry() == false {
			if err := s.rollback.ExecuteRollback(task); err != nil {
				log.Printf("Rollback failed for task %s: %v", task.ID, err)
			}
		}
	}
	
	return nil
}

func (s *TaskService) CancelTask(taskID string) error {
	return s.store.CancelTask(taskID)
}

func (s *TaskService) RetryTask(taskID string) error {
	task, err := s.store.GetTask(taskID)
	if err != nil {
		return err
	}
	
	if task.Status != models.TaskStatusPendingRetry {
		return fmt.Errorf("%w: task is not in pending_retry state", models.ErrInvalidStatus)
	}
	
	if !task.CanRetry() {
		return models.ErrMaxRetriesExceeded
	}
	
	task.RetryCount++
	task.Status = models.TaskStatusRetrying
	task.LastRetryAt = util.TimePtr(util.Now())
	task.ErrorMessages = append(task.ErrorMessages, 
		fmt.Sprintf("retry attempt %d of %d", task.RetryCount, task.MaxRetries))
	
	if err := s.store.UpdateTask(task); err != nil {
		return err
	}
	
	return s.ProcessTask(task.ID)
}

func (s *TaskService) ResolveConflict(taskID, conflictID, resolution string) error {
	task, err := s.store.GetTask(taskID)
	if err != nil {
		return err
	}
	
	for i := range task.Conflicts {
		if task.Conflicts[i].ConflictID == conflictID {
			task.Conflicts[i].Resolved = true
			task.Conflicts[i].Resolution = resolution
			resolvedAt := util.Now()
			task.Conflicts[i].ResolvedAt = &resolvedAt
		}
	}
	
	if !task.HasUnresolvedConflicts() && task.Status == models.TaskStatusConflict {
		if task.CanRetry() {
			task.Status = models.TaskStatusPendingRetry
		} else {
			return s.rollback.ExecuteRollback(task)
		}
	}
	
	return s.store.UpdateTask(task)
}

func (s *TaskService) findTarget(task *models.RenewalTask, targetID string) *models.DeploymentTarget {
	for i := range task.Targets {
		if task.Targets[i].ID == targetID {
			return &task.Targets[i]
		}
	}
	return nil
}
