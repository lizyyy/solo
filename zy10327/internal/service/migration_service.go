package service

import (
	"encoding/json"
	"fmt"
	"tenant-migration-api/internal/models"
	"tenant-migration-api/internal/repository"
	"tenant-migration-api/pkg/logger"
	"tenant-migration-api/pkg/utils"
	"time"
)

type MigrationService interface {
	CreateMigration(req *models.CreateMigrationRequest) (*models.CreateMigrationResponse, error)
	ValidateMigration(req *models.ValidateMigrationRequest) (*models.ValidateMigrationResponse, error)
	AdvanceStatus(req *models.AdvanceStatusRequest) (*models.AdvanceStatusResponse, error)
	RollbackMigration(req *models.RollbackRequest) (*models.RollbackResponse, error)
	GetMigrationTask(taskID string) (*models.GetMigrationTaskResponse, error)
	ListMigrationTasks(req *models.ListMigrationTasksRequest) (*models.ListMigrationTasksResponse, error)
	GetMigrationHistory(taskID string) (*models.GetHistoryResponse, error)
	GetValidationReport(taskID string, reportType string) (*models.GetValidationReportResponse, error)
	InitSampleData() error
}

type migrationService struct {
	repo         repository.MigrationRepository
	stateMachine *StateMachine
}

func NewMigrationService(repo repository.MigrationRepository) MigrationService {
	return &migrationService{
		repo:         repo,
		stateMachine: NewStateMachine(),
	}
}

func (s *migrationService) CreateMigration(req *models.CreateMigrationRequest) (*models.CreateMigrationResponse, error) {
	logger.Infof("Creating migration task for tenant: %s", req.TenantID)

	_, err := s.repo.GetTenantByID(req.TenantID)
	if err != nil {
		logger.Errorf("Tenant not found: %s", req.TenantID)
		return nil, models.NewBusinessError(models.ErrTenantNotFound, "租户不存在")
	}

	_, err = s.repo.GetClusterByID(req.SourceClusterID)
	if err != nil {
		logger.Errorf("Source cluster not found: %s", req.SourceClusterID)
		return nil, models.NewBusinessError(models.ErrClusterNotFound, "源集群不存在")
	}

	_, err = s.repo.GetClusterByID(req.TargetClusterID)
	if err != nil {
		logger.Errorf("Target cluster not found: %s", req.TargetClusterID)
		return nil, models.NewBusinessError(models.ErrClusterNotFound, "目标集群不存在")
	}

	existingTask, _ := s.repo.GetTaskByTenantAndClusters(req.TenantID, req.SourceClusterID, req.TargetClusterID)
	if existingTask != nil {
		logger.Warnf("Duplicate migration task found: %s", existingTask.ID)
		return nil, models.NewBusinessError(models.ErrDuplicateTask, "该租户已有进行中的迁移任务")
	}

	taskID := utils.GenerateTaskID()
	task := &models.MigrationTask{
		ID:              taskID,
		TenantID:        req.TenantID,
		SourceClusterID: req.SourceClusterID,
		TargetClusterID: req.TargetClusterID,
		Status:          models.StatusCreated,
		CurrentPhase:    "CREATED",
		RetryCount:      0,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	err = s.repo.CreateTask(task)
	if err != nil {
		logger.Errorf("Failed to create task: %v", err)
		return nil, models.NewBusinessErrorWithCause(models.ErrInternalError, "创建任务失败", err)
	}

	history := &models.MigrationHistory{
		ID:              utils.GenerateHistoryID(),
		MigrationTaskID: taskID,
		FromStatus:      "",
		ToStatus:        models.StatusCreated,
		Operator:        req.Operator,
		Remark:          "创建迁移任务",
		CreatedAt:       time.Now(),
	}
	s.repo.CreateHistory(history)

	logger.Infof("Migration task created: %s", taskID)
	return &models.CreateMigrationResponse{
		TaskID:       taskID,
		Status:       models.StatusCreated,
		CurrentPhase: "CREATED",
	}, nil
}

func (s *migrationService) ValidateMigration(req *models.ValidateMigrationRequest) (*models.ValidateMigrationResponse, error) {
	logger.Infof("Validating migration task: %s", req.TaskID)

	task, err := s.repo.GetTaskByID(req.TaskID)
	if err != nil {
		return nil, models.NewBusinessError(models.ErrTaskNotFound, "任务不存在")
	}

	if !s.stateMachine.CanTransition(task.Status, models.StatusValidating) {
		return nil, models.NewBusinessError(models.ErrStatusTransition, "当前状态不允许开始校验")
	}

	s.recordStatusChange(task.ID, task.Status, models.StatusValidating, req.Operator, "开始校验")
	s.repo.UpdateTaskStatus(task.ID, models.StatusValidating, "VALIDATING", "")

	checkItems := s.initCheckItems(task.ID)
	allPassed := true

	for i := range checkItems {
		item := &checkItems[i]
		item.Status = models.CheckRunning
		s.repo.UpdateCheckItem(item)

		s.executeCheck(item)

		if item.Status == models.CheckFailed {
			allPassed = false
		}
		s.repo.UpdateCheckItem(item)
	}

	passedCount := 0
	failedCount := 0
	for _, item := range checkItems {
		if item.Status == models.CheckPassed {
			passedCount++
		} else if item.Status == models.CheckFailed {
			failedCount++
		}
	}

	var finalStatus models.MigrationStatus
	var finalPhase string
	var errorMsg string

	if allPassed {
		finalStatus = models.StatusValidationPassed
		finalPhase = "VALIDATION_PASSED"
		s.recordStatusChange(task.ID, models.StatusValidating, finalStatus, req.Operator, "校验通过")
	} else {
		finalStatus = models.StatusFailed
		finalPhase = "FAILED"
		errorMsg = "存在校验失败项"
		s.recordStatusChange(task.ID, models.StatusValidating, finalStatus, req.Operator, "校验失败")
	}

	s.repo.UpdateTaskStatus(task.ID, finalStatus, finalPhase, errorMsg)
	s.createRollbackPoint(task.ID, finalPhase, req.Operator)
	s.generateValidationReport(task.ID, "validation", checkItems)

	return &models.ValidateMigrationResponse{
		TaskID:       task.ID,
		Status:       models.CheckPassed,
		TotalChecks:  len(checkItems),
		PassedChecks: passedCount,
		FailedChecks: failedCount,
		CheckItems:   checkItems,
	}, nil
}

func (s *migrationService) executeCheck(item *models.CheckItem) {
	time.Sleep(100 * time.Millisecond)

	switch item.CheckType {
	case models.CheckTypeConnectivity:
		if item.Name == "源集群连通性" || item.Name == "目标集群连通性" {
			item.Status = models.CheckPassed
			item.ActualValue = "connected"
		}
	case models.CheckTypeSchema:
		item.Status = models.CheckPassed
		item.ActualValue = "matched"
	case models.CheckTypeDataCount:
		item.Status = models.CheckPassed
		item.ActualValue = "10000"
	case models.CheckTypeDataConsistency:
		item.Status = models.CheckPassed
		item.ActualValue = "99.99%"
	case models.CheckTypePerformance:
		item.Status = models.CheckPassed
		item.ActualValue = "100ms"
	}

	now := time.Now()
	item.ExecutedAt = &now
}

func (s *migrationService) initCheckItems(taskID string) []models.CheckItem {
	checks := []struct {
		checkType models.CheckType
		name      string
		expected  string
	}{
		{models.CheckTypeConnectivity, "源集群连通性", "connected"},
		{models.CheckTypeConnectivity, "目标集群连通性", "connected"},
		{models.CheckTypeSchema, "表结构一致性", "matched"},
		{models.CheckTypeSchema, "索引一致性", "matched"},
		{models.CheckTypeDataCount, "行数对比", "same"},
		{models.CheckTypeDataConsistency, "数据一致性", "100%"},
		{models.CheckTypePerformance, "写入性能", "<200ms"},
	}

	var items []models.CheckItem
	for _, c := range checks {
		item := models.CheckItem{
			ID:              utils.GenerateCheckItemID(),
			MigrationTaskID: taskID,
			CheckType:       c.checkType,
			Name:            c.name,
			Status:          models.CheckPending,
			ExpectedValue:   c.expected,
			CreatedAt:       time.Now(),
			UpdatedAt:       time.Now(),
		}
		s.repo.CreateCheckItem(&item)
		items = append(items, item)
	}
	return items
}

func (s *migrationService) AdvanceStatus(req *models.AdvanceStatusRequest) (*models.AdvanceStatusResponse, error) {
	logger.Infof("Advancing status for task %s to phase: %s", req.TaskID, req.TargetPhase)

	task, err := s.repo.GetTaskByID(req.TaskID)
	if err != nil {
		return nil, models.NewBusinessError(models.ErrTaskNotFound, "任务不存在")
	}

	prevStatus := task.Status
	targetStatus := s.phaseToStatus(req.TargetPhase)

	if !s.stateMachine.CanTransition(task.Status, targetStatus) {
		validTransitions := s.stateMachine.GetValidTransitions(task.Status)
		logger.Warnf("Invalid status transition from %s to %s", task.Status, targetStatus)
		return nil, models.NewBusinessError(models.ErrStatusTransition, "状态转换不合法，允许的目标状态: "+formatTransitions(validTransitions))
	}

	s.recordStatusChange(task.ID, task.Status, targetStatus, req.Operator, req.Remark)
	s.repo.UpdateTaskStatus(task.ID, targetStatus, req.TargetPhase, "")
	s.createRollbackPoint(task.ID, req.TargetPhase, req.Operator)

	if req.TargetPhase == "DUAL_WRITING" {
		s.simulateDualWriting(task.ID)
	} else if req.TargetPhase == "SWITCHING_READ" {
		s.simulateSwitchReadTraffic(task.ID)
	}

	logger.Infof("Status advanced from %s to %s", prevStatus, targetStatus)
	return &models.AdvanceStatusResponse{
		TaskID:       task.ID,
		PrevStatus:   prevStatus,
		CurrStatus:   targetStatus,
		CurrentPhase: req.TargetPhase,
	}, nil
}

func (s *migrationService) simulateDualWriting(taskID string) {
	logger.Infof("Starting dual writing simulation for task: %s", taskID)

	operations := []string{"INSERT", "UPDATE", "DELETE"}
	for i, op := range operations {
		record := &models.DualWriteRecord{
			ID:              utils.GenerateDualWriteID(),
			MigrationTaskID: taskID,
			OperationType:   op,
			SourceResult:    "success",
			TargetResult:    "success",
			IsConsistent:    true,
			CheckedAt:       time.Now(),
		}
		if i == 2 {
			record.IsConsistent = true
		}
		s.repo.CreateDualWriteRecord(record)
	}
}

func (s *migrationService) simulateSwitchReadTraffic(taskID string) {
	logger.Infof("Switching read traffic to target cluster for task: %s", taskID)
	time.Sleep(200 * time.Millisecond)
}

func (s *migrationService) RollbackMigration(req *models.RollbackRequest) (*models.RollbackResponse, error) {
	logger.Infof("Rolling back migration task: %s, rollback point: %s", req.TaskID, req.RollbackPointID)

	task, err := s.repo.GetTaskByID(req.TaskID)
	if err != nil {
		return nil, models.NewBusinessError(models.ErrTaskNotFound, "任务不存在")
	}

	if task.Status == models.StatusRolledBack {
		return nil, models.NewBusinessError(models.ErrAlreadyRolledBack, "任务已处于回滚完成状态，不能重复回滚")
	}

	if !s.stateMachine.CanTransition(task.Status, models.StatusRollingBack) {
		validTransitions := s.stateMachine.GetValidTransitions(task.Status)
		return nil, models.NewBusinessError(models.ErrStatusTransition,
			"当前状态不允许回滚，允许的目标状态: "+formatTransitions(validTransitions))
	}

	if req.RollbackPointID == "" {
		return nil, models.NewBusinessError(models.ErrInvalidRequest, "回滚点ID不能为空")
	}

	rollbackPoint, err := s.repo.GetRollbackPointByID(req.RollbackPointID)
	if err != nil {
		return nil, models.NewBusinessError(models.ErrRollbackPointNotFound, "回滚点不存在")
	}

	if rollbackPoint.MigrationTaskID != task.ID {
		return nil, models.NewBusinessError(models.ErrRollbackPointMismatch, "回滚点不属于当前任务")
	}

	s.recordStatusChange(task.ID, task.Status, models.StatusRollingBack, req.Operator,
		fmt.Sprintf("执行回滚至阶段: %s, 原因: %s", rollbackPoint.Phase, req.Reason))
	s.repo.UpdateTaskStatus(task.ID, models.StatusRollingBack, "ROLLING_BACK", "")

	restoredPhase, err := s.restoreFromRollbackPoint(task, rollbackPoint)
	if err != nil {
		logger.Errorf("Failed to restore from rollback point: %v", err)
		s.repo.UpdateTaskStatus(task.ID, models.StatusFailed, "FAILED", "回滚失败: "+err.Error())
		return nil, models.NewBusinessErrorWithCause(models.ErrRollbackFailed, "回滚执行失败", err)
	}

	s.recordStatusChange(task.ID, models.StatusRollingBack, models.StatusRolledBack, req.Operator,
		fmt.Sprintf("回滚完成，已恢复至阶段: %s", restoredPhase))
	s.repo.UpdateTaskStatus(task.ID, models.StatusRolledBack, restoredPhase, "")

	logger.Infof("Migration task rolled back successfully: %s to phase: %s", req.TaskID, restoredPhase)
	return &models.RollbackResponse{
		TaskID:            task.ID,
		Status:            models.StatusRolledBack,
		RollbackPointID:   req.RollbackPointID,
		RolledBackToPhase: restoredPhase,
	}, nil
}

func (s *migrationService) restoreFromRollbackPoint(task *models.MigrationTask, point *models.RollbackPoint) (string, error) {
	logger.Infof("Restoring task %s from rollback point %s to phase %s", task.ID, point.ID, point.Phase)

	var snapshot map[string]interface{}
	if err := json.Unmarshal([]byte(point.SnapshotData), &snapshot); err != nil {
		logger.Warnf("Failed to parse snapshot data: %v, using default restore logic", err)
	}

	restoredPhase := point.Phase
	if snapshotPhase, ok := snapshot["task_current_phase"].(string); ok {
		restoredPhase = snapshotPhase
	}

	time.Sleep(300 * time.Millisecond)

	s.simulateRollbackByPhase(point.Phase, snapshot)

	logger.Infof("Task %s restored to phase %s successfully (snapshot applied)", task.ID, restoredPhase)
	return restoredPhase, nil
}

func (s *migrationService) simulateRollbackByPhase(phase string, snapshot map[string]interface{}) {
	originalStatus := ""
	if status, ok := snapshot["task_status"].(string); ok {
		originalStatus = status
	}

	logger.Infof("Rolling back from current state to original state: %s (phase: %s)", originalStatus, phase)

	switch phase {
	case "VALIDATION_PASSED":
		logger.Info("  - Clearing dual-write configurations")
		logger.Info("  - Restoring database connection pool settings")
		logger.Info("  - Resetting routing rules to source-only")
	case "DUAL_WRITING":
		logger.Info("  - Stopping dual-write operations")
		logger.Info("  - Reverting data synchronization state")
		logger.Info("  - Clearing read traffic split configuration")
	case "VERIFYING":
		logger.Info("  - Removing verification checkpoints")
		logger.Info("  - Rolling back data consistency checks")
		logger.Info("  - Restoring original data comparison state")
	case "SWITCHING_READ":
		logger.Info("  - Reverting read traffic to source cluster")
		logger.Info("  - Restoring connection routing configuration")
		logger.Info("  - Clearing failover configuration")
	case "COMPLETED":
		logger.Info("  - Full rollback: restoring all cluster configurations")
		logger.Info("  - Reverting database connections to source-only")
		logger.Info("  - Clearing all migration-related states")
	default:
		logger.Infof("  - Applying rollback operations for phase: %s", phase)
	}
}

func (s *migrationService) GetMigrationTask(taskID string) (*models.GetMigrationTaskResponse, error) {
	task, err := s.repo.GetTaskByID(taskID)
	if err != nil {
		return nil, models.NewBusinessError(models.ErrTaskNotFound, "任务不存在")
	}

	checkItems, _ := s.repo.GetCheckItemsByTaskID(taskID)
	rollbackPoints, _ := s.repo.GetRollbackPointsByTaskID(taskID)
	histories, _ := s.repo.GetHistoriesByTaskID(taskID)

	return &models.GetMigrationTaskResponse{
		MigrationTask:  *task,
		CheckItems:     checkItems,
		RollbackPoints: rollbackPoints,
		Histories:      histories,
	}, nil
}

func (s *migrationService) ListMigrationTasks(req *models.ListMigrationTasksRequest) (*models.ListMigrationTasksResponse, error) {
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 10
	}

	tasks, total, err := s.repo.ListTasks(req)
	if err != nil {
		return nil, models.NewBusinessErrorWithCause(models.ErrInternalError, "查询任务列表失败", err)
	}

	return &models.ListMigrationTasksResponse{
		Total: total,
		Page:  req.Page,
		Size:  req.PageSize,
		Tasks: tasks,
	}, nil
}

func (s *migrationService) GetMigrationHistory(taskID string) (*models.GetHistoryResponse, error) {
	_, err := s.repo.GetTaskByID(taskID)
	if err != nil {
		return nil, models.NewBusinessError(models.ErrTaskNotFound, "任务不存在")
	}

	histories, err := s.repo.GetHistoriesByTaskID(taskID)
	if err != nil {
		return nil, models.NewBusinessErrorWithCause(models.ErrInternalError, "查询历史失败", err)
	}

	return &models.GetHistoryResponse{
		TaskID:    taskID,
		Histories: histories,
	}, nil
}

func (s *migrationService) GetValidationReport(taskID string, reportType string) (*models.GetValidationReportResponse, error) {
	_, err := s.repo.GetTaskByID(taskID)
	if err != nil {
		return nil, models.NewBusinessError(models.ErrTaskNotFound, "任务不存在")
	}

	report, err := s.repo.GetValidationReportByTaskID(taskID, reportType)
	if err != nil {
		return nil, models.NewBusinessErrorWithCause(models.ErrInternalError, "查询报告失败", err)
	}

	return &models.GetValidationReportResponse{
		TaskID:     taskID,
		ReportType: reportType,
		Report:     *report,
	}, nil
}

func (s *migrationService) recordStatusChange(taskID string, from, to models.MigrationStatus, operator, remark string) {
	history := &models.MigrationHistory{
		ID:              utils.GenerateHistoryID(),
		MigrationTaskID: taskID,
		FromStatus:      from,
		ToStatus:        to,
		Operator:        operator,
		Remark:          remark,
		CreatedAt:       time.Now(),
	}
	s.repo.CreateHistory(history)
}

func (s *migrationService) createRollbackPoint(taskID, phase, operator string) {
	task, err := s.repo.GetTaskByID(taskID)
	if err != nil {
		logger.Warnf("Failed to get task %s for rollback point creation: %v", taskID, err)
	}

	statusBeforeSnapshot := ""
	if task != nil {
		statusBeforeSnapshot = string(task.Status)
	}

	snapshot := map[string]interface{}{
		"phase":              phase,
		"operator":           operator,
		"time":               time.Now().Format(time.RFC3339),
		"task_status":        statusBeforeSnapshot,
		"task_current_phase": phase,
	}
	snapshotData, _ := json.Marshal(snapshot)

	point := &models.RollbackPoint{
		ID:              utils.GenerateRollbackPointID(),
		MigrationTaskID: taskID,
		Phase:           phase,
		SnapshotData:    string(snapshotData),
		CreatedAt:       time.Now(),
	}
	s.repo.CreateRollbackPoint(point)
	logger.Infof("Rollback point %s created for task %s, phase: %s", point.ID, taskID, phase)
}

func (s *migrationService) generateValidationReport(taskID, reportType string, checkItems []models.CheckItem) {
	passed := 0
	for _, item := range checkItems {
		if item.Status == models.CheckPassed {
			passed++
		}
	}

	passRate := float64(passed) / float64(len(checkItems)) * 100

	content, _ := json.Marshal(checkItems)

	report := &models.ValidationReport{
		ID:              utils.GenerateReportID(),
		MigrationTaskID: taskID,
		ReportType:      reportType,
		Content:         string(content),
		PassRate:        passRate,
		TotalChecks:     len(checkItems),
		PassedChecks:    passed,
		FailedChecks:    len(checkItems) - passed,
		CreatedAt:       time.Now(),
	}
	s.repo.CreateValidationReport(report)
}

func (s *migrationService) phaseToStatus(phase string) models.MigrationStatus {
	switch phase {
	case "VALIDATING":
		return models.StatusValidating
	case "VALIDATION_PASSED":
		return models.StatusValidationPassed
	case "DUAL_WRITING":
		return models.StatusDualWriting
	case "VERIFYING":
		return models.StatusVerifying
	case "SWITCHING_READ":
		return models.StatusSwitchingRead
	case "COMPLETED":
		return models.StatusCompleted
	case "ROLLING_BACK":
		return models.StatusRollingBack
	case "ROLLED_BACK":
		return models.StatusRolledBack
	default:
		return models.StatusFailed
	}
}

func formatTransitions(transitions []models.MigrationStatus) string {
	result := ""
	for i, t := range transitions {
		if i > 0 {
			result += ", "
		}
		result += string(t)
	}
	return result
}

func (s *migrationService) InitSampleData() error {
	logger.Info("Initializing sample data")

	tenants := []models.Tenant{
		{ID: "tenant-001", Name: "客户A", Code: "CUST_A", Status: "ACTIVE", CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{ID: "tenant-002", Name: "客户B", Code: "CUST_B", Status: "ACTIVE", CreatedAt: time.Now(), UpdatedAt: time.Now()},
	}

	for _, tenant := range tenants {
		if err := s.repo.CreateTenant(&tenant); err != nil {
			logger.Warnf("Tenant %s already exists", tenant.ID)
		}
	}

	clusters := []models.Cluster{
		{ID: "cluster-source-01", Name: "源集群-北京", Type: "mysql", Endpoint: "mysql-source:3306", Region: "beijing", Status: "ACTIVE", CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{ID: "cluster-target-01", Name: "目标集群-上海", Type: "mysql", Endpoint: "mysql-target:3306", Region: "shanghai", Status: "ACTIVE", CreatedAt: time.Now(), UpdatedAt: time.Now()},
	}

	for _, cluster := range clusters {
		if err := s.repo.CreateCluster(&cluster); err != nil {
			logger.Warnf("Cluster %s already exists", cluster.ID)
		}
	}

	logger.Info("Sample data initialized")
	return nil
}
