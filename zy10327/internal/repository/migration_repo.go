package repository

import (
	"tenant-migration-api/internal/models"
	"gorm.io/gorm"
	"time"
)

type MigrationRepository interface {
	CreateTask(task *models.MigrationTask) error
	GetTaskByID(id string) (*models.MigrationTask, error)
	GetTaskByTenantAndClusters(tenantID, sourceClusterID, targetClusterID string) (*models.MigrationTask, error)
	UpdateTaskStatus(taskID string, status models.MigrationStatus, phase string, errorMsg string) error
	ListTasks(req *models.ListMigrationTasksRequest) ([]models.MigrationTask, int, error)
	CreateCheckItem(item *models.CheckItem) error
	UpdateCheckItem(item *models.CheckItem) error
	GetCheckItemsByTaskID(taskID string) ([]models.CheckItem, error)
	CreateRollbackPoint(point *models.RollbackPoint) error
	GetRollbackPointsByTaskID(taskID string) ([]models.RollbackPoint, error)
	GetRollbackPointByID(id string) (*models.RollbackPoint, error)
	CreateHistory(history *models.MigrationHistory) error
	GetHistoriesByTaskID(taskID string) ([]models.MigrationHistory, error)
	CreateValidationReport(report *models.ValidationReport) error
	GetValidationReportByTaskID(taskID string, reportType string) (*models.ValidationReport, error)
	CreateDualWriteRecord(record *models.DualWriteRecord) error
	GetDualWriteRecordsByTaskID(taskID string) ([]models.DualWriteRecord, error)
	GetTenantByID(id string) (*models.Tenant, error)
	GetClusterByID(id string) (*models.Cluster, error)
	CreateTenant(tenant *models.Tenant) error
	CreateCluster(cluster *models.Cluster) error
	Transaction(fn func(tx *gorm.DB) error) error
}

type migrationRepository struct {
	db *gorm.DB
}

func NewMigrationRepository(db *gorm.DB) MigrationRepository {
	return &migrationRepository{db: db}
}

func (r *migrationRepository) CreateTask(task *models.MigrationTask) error {
	return r.db.Create(task).Error
}

func (r *migrationRepository) GetTaskByID(id string) (*models.MigrationTask, error) {
	var task models.MigrationTask
	err := r.db.Where("id = ?", id).First(&task).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *migrationRepository) GetTaskByTenantAndClusters(tenantID, sourceClusterID, targetClusterID string) (*models.MigrationTask, error) {
	var task models.MigrationTask
	err := r.db.Where("tenant_id = ? AND source_cluster_id = ? AND target_cluster_id = ? AND status NOT IN ?",
		tenantID, sourceClusterID, targetClusterID,
		[]models.MigrationStatus{models.StatusCompleted, models.StatusRolledBack}).
		First(&task).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *migrationRepository) UpdateTaskStatus(taskID string, status models.MigrationStatus, phase string, errorMsg string) error {
	updates := map[string]interface{}{
		"status":       status,
		"current_phase": phase,
		"updated_at":   time.Now(),
	}
	if errorMsg != "" {
		updates["error_message"] = errorMsg
	}
	if status == models.StatusCompleted || status == models.StatusRolledBack {
		now := time.Now()
		updates["completed_at"] = &now
	}
	return r.db.Model(&models.MigrationTask{}).Where("id = ?", taskID).Updates(updates).Error
}

func (r *migrationRepository) ListTasks(req *models.ListMigrationTasksRequest) ([]models.MigrationTask, int, error) {
	var tasks []models.MigrationTask
	var total int64

	query := r.db.Model(&models.MigrationTask{})
	if req.TenantID != "" {
		query = query.Where("tenant_id = ?", req.TenantID)
	}
	if req.Status != "" {
		query = query.Where("status = ?", req.Status)
	}

	query.Count(&total)

	offset := (req.Page - 1) * req.PageSize
	if offset < 0 {
		offset = 0
	}
	err := query.Offset(offset).Limit(req.PageSize).Order("created_at DESC").Find(&tasks).Error
	if err != nil {
		return nil, 0, err
	}
	return tasks, int(total), nil
}

func (r *migrationRepository) CreateCheckItem(item *models.CheckItem) error {
	return r.db.Create(item).Error
}

func (r *migrationRepository) UpdateCheckItem(item *models.CheckItem) error {
	return r.db.Save(item).Error
}

func (r *migrationRepository) GetCheckItemsByTaskID(taskID string) ([]models.CheckItem, error) {
	var items []models.CheckItem
	err := r.db.Where("migration_task_id = ?", taskID).Order("created_at ASC").Find(&items).Error
	return items, err
}

func (r *migrationRepository) CreateRollbackPoint(point *models.RollbackPoint) error {
	return r.db.Create(point).Error
}

func (r *migrationRepository) GetRollbackPointsByTaskID(taskID string) ([]models.RollbackPoint, error) {
	var points []models.RollbackPoint
	err := r.db.Where("migration_task_id = ?", taskID).Order("created_at DESC").Find(&points).Error
	return points, err
}

func (r *migrationRepository) GetRollbackPointByID(id string) (*models.RollbackPoint, error) {
	var point models.RollbackPoint
	err := r.db.Where("id = ?", id).First(&point).Error
	return &point, err
}

func (r *migrationRepository) CreateHistory(history *models.MigrationHistory) error {
	return r.db.Create(history).Error
}

func (r *migrationRepository) GetHistoriesByTaskID(taskID string) ([]models.MigrationHistory, error) {
	var histories []models.MigrationHistory
	err := r.db.Where("migration_task_id = ?", taskID).Order("created_at DESC").Find(&histories).Error
	return histories, err
}

func (r *migrationRepository) CreateValidationReport(report *models.ValidationReport) error {
	return r.db.Create(report).Error
}

func (r *migrationRepository) GetValidationReportByTaskID(taskID string, reportType string) (*models.ValidationReport, error) {
	var report models.ValidationReport
	err := r.db.Where("migration_task_id = ? AND report_type = ?", taskID, reportType).
		Order("created_at DESC").First(&report).Error
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *migrationRepository) CreateDualWriteRecord(record *models.DualWriteRecord) error {
	return r.db.Create(record).Error
}

func (r *migrationRepository) GetDualWriteRecordsByTaskID(taskID string) ([]models.DualWriteRecord, error) {
	var records []models.DualWriteRecord
	err := r.db.Where("migration_task_id = ?", taskID).Order("checked_at DESC").Find(&records).Error
	return records, err
}

func (r *migrationRepository) GetTenantByID(id string) (*models.Tenant, error) {
	var tenant models.Tenant
	err := r.db.Where("id = ?", id).First(&tenant).Error
	if err != nil {
		return nil, err
	}
	return &tenant, nil
}

func (r *migrationRepository) GetClusterByID(id string) (*models.Cluster, error) {
	var cluster models.Cluster
	err := r.db.Where("id = ?", id).First(&cluster).Error
	if err != nil {
		return nil, err
	}
	return &cluster, nil
}

func (r *migrationRepository) CreateTenant(tenant *models.Tenant) error {
	return r.db.Create(tenant).Error
}

func (r *migrationRepository) CreateCluster(cluster *models.Cluster) error {
	return r.db.Create(cluster).Error
}

func (r *migrationRepository) Transaction(fn func(tx *gorm.DB) error) error {
	return r.db.Transaction(fn)
}
