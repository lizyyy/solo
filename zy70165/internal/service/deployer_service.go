package service

import (
	"certificate-renewal-api/internal/config"
	"certificate-renewal-api/internal/models"
	"certificate-renewal-api/internal/repository"
	"certificate-renewal-api/internal/util"
	"time"
)

type DeployResult struct {
	Status      models.ReceiptStatus
	Error       string
	HealthCheck *models.HealthCheckResult
	DeployedAt  *time.Time
	VerifiedAt  *time.Time
}

type DeployerService struct {
	healthCheck *HealthCheckService
}

func NewDeployerService(healthCheck *HealthCheckService) *DeployerService {
	return &DeployerService{healthCheck: healthCheck}
}

func (d *DeployerService) Deploy(task *models.RenewalTask, target *models.DeploymentTarget, receipt *models.DeploymentReceipt) *DeployResult {
	result := &DeployResult{
		Status: models.ReceiptStatusPending,
	}
	
	if target.HealthCheckEndpoint == "" {
		result.Status = models.ReceiptStatusFailed
		result.Error = "no health check endpoint configured"
		task.Conflicts = append(task.Conflicts, models.ConflictInfo{
			ConflictID:  util.GenerateID("conflict"),
			Type:        "missing_health_check",
			Description: "Target has no health check endpoint",
			Resolved:    false,
		})
		return result
	}
	
	deployedAt := util.Now()
	result.DeployedAt = &deployedAt
	result.Status = models.ReceiptStatusDeployed
	
	healthResult := d.healthCheck.Perform(target)
	result.HealthCheck = healthResult
	
	if healthResult.Success {
		verifiedAt := util.Now()
		result.VerifiedAt = &verifiedAt
		result.Status = models.ReceiptStatusVerified
	} else {
		result.Status = models.ReceiptStatusFailed
		result.Error = healthResult.Error
	}
	
	return result
}

type HealthCheckService struct {
	config *config.Config
}

func NewHealthCheckService(config *config.Config) *HealthCheckService {
	return &HealthCheckService{config: config}
}

func (h *HealthCheckService) Perform(target *models.DeploymentTarget) *models.HealthCheckResult {
	now := util.Now()
	latency := 100 * time.Millisecond
	
	if target.HealthCheckEndpoint == "" {
		return &models.HealthCheckResult{
			Success:   false,
			Timestamp: now,
			Latency:   latency,
			Error:     "no health check endpoint",
		}
	}
	
	return &models.HealthCheckResult{
		Success:   true,
		Timestamp: now,
		Latency:   latency,
		Details: map[string]interface{}{
			"target_type": target.Type,
			"endpoint":    target.HealthCheckEndpoint,
		},
	}
}

type RollbackService struct {
	store       repository.Store
	healthCheck *HealthCheckService
	config      *config.Config
}

func NewRollbackService(store repository.Store, healthCheck *HealthCheckService, config *config.Config) *RollbackService {
	return &RollbackService{
		store:       store,
		healthCheck: healthCheck,
		config:      config,
	}
}

func (r *RollbackService) ExecuteRollback(task *models.RenewalTask) error {
	if !r.config.Rollback.Enabled {
		return nil
	}
	
	now := util.Now()
	task.Status = models.TaskStatusRollingBack
	
	if err := r.store.UpdateTask(task); err != nil {
		return err
	}
	
	rollbackTask := &models.RenewalTask{
		ID:             util.GenerateID("task"),
		CertificateID:  task.CertificateID,
		NewCertificate: task.OldCertificate,
		OldCertificate: task.NewCertificate,
		Status:         models.TaskStatusProcessing,
		Targets:        task.Targets,
		Priority:       100,
		RetryCount:     0,
		MaxRetries:     1,
		CreatedAt:      now,
		StartedAt:      &now,
		IsRollback:     true,
		ParentTaskID:   &task.ID,
	}
	
	if err := r.store.CreateTask(rollbackTask); err != nil {
		return err
	}
	
	receipts := r.store.ListReceiptsByTask(task.ID)
	for _, receipt := range receipts {
		rollbackReceipt := &models.DeploymentReceipt{
			ID:            util.GenerateID("receipt"),
			TaskID:        rollbackTask.ID,
			TargetID:      receipt.TargetID,
			TargetType:    receipt.TargetType,
			CertificateID: task.OldCertificate.ID,
			Status:        models.ReceiptStatusRolledBack,
			CreatedAt:     util.Now(),
			UpdatedAt:     util.Now(),
		}
		
		target := r.findTarget(task, receipt.TargetID)
		if target != nil {
			healthResult := r.healthCheck.Perform(target)
			if healthResult.Success {
				rollbackReceipt.Status = models.ReceiptStatusVerified
				verifiedAt := util.Now()
				rollbackReceipt.VerifiedAt = &verifiedAt
			} else {
				rollbackReceipt.Status = models.ReceiptStatusFailed
				rollbackReceipt.Error = "rollback health check failed"
			}
			rollbackReceipt.HealthCheck = healthResult
		}
		
		if err := r.store.CreateReceipt(rollbackReceipt); err != nil {
			return err
		}
	}
	
	completedAt := util.Now()
	rollbackTask.Status = models.TaskStatusRolledBack
	rollbackTask.CompletedAt = &completedAt
	
	if err := r.store.UpdateTask(rollbackTask); err != nil {
		return err
	}
	
	task.Status = models.TaskStatusRolledBack
	if task.OldCertificate != nil {
		task.OldCertificate.Status = models.CertStatusRolledBack
		if err := r.store.UpdateCertificate(task.OldCertificate); err != nil {
			return err
		}
	}
	
	return r.store.UpdateTask(task)
}

func (r *RollbackService) findTarget(task *models.RenewalTask, targetID string) *models.DeploymentTarget {
	for i := range task.Targets {
		if task.Targets[i].ID == targetID {
			return &task.Targets[i]
		}
	}
	return nil
}
