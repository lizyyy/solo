package repository

import (
	"time"
	"webhook-migration/model"

	"github.com/google/uuid"
)

type MigrationRepository struct{}

func NewMigrationRepository() *MigrationRepository {
	return &MigrationRepository{}
}

func (r *MigrationRepository) Create(migration *model.Migration) error {
	migration.ID = uuid.NewString()
	migration.CreatedAt = time.Now()
	migration.UpdatedAt = time.Now()
	return DB.Create(migration).Error
}

func (r *MigrationRepository) GetByID(id string) (*model.Migration, error) {
	var migration model.Migration
	err := DB.Where("id = ?", id).First(&migration).Error
	if err != nil {
		return nil, err
	}
	return &migration, nil
}

func (r *MigrationRepository) List(page, pageSize int) ([]model.Migration, int64, error) {
	var migrations []model.Migration
	var total int64

	offset := (page - 1) * pageSize
	err := DB.Model(&model.Migration{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = DB.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&migrations).Error
	return migrations, total, err
}

func (r *MigrationRepository) UpdateStatus(id string, status model.MigrationStatus, conclusion, failureReason string) error {
	updates := map[string]interface{}{
		"status":      status,
		"updated_at":  time.Now(),
	}
	if conclusion != "" {
		updates["switch_conclusion"] = conclusion
	}
	if failureReason != "" {
		updates["failure_reason"] = failureReason
	}
	if status == model.StatusSwitched || status == model.StatusFailed || status == model.StatusRolledBack {
		updates["completed_at"] = time.Now()
	}
	return DB.Model(&model.Migration{}).Where("id = ?", id).Updates(updates).Error
}

func (r *MigrationRepository) UpdateStats(id string, total, matched, mismatched, missing int, successRate float64) error {
	return DB.Model(&model.Migration{}).Where("id = ?", id).Updates(map[string]interface{}{
		"total_events":      total,
		"matched_events":    matched,
		"mismatched_events": mismatched,
		"missing_events":    missing,
		"success_rate":      successRate,
		"updated_at":        time.Now(),
	}).Error
}

func (r *MigrationRepository) UpdateMigration(id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now()
	return DB.Model(&model.Migration{}).Where("id = ?", id).Updates(updates).Error
}

func (r *MigrationRepository) GetAllForExport() []model.Migration {
	var migrations []model.Migration
	DB.Order("created_at DESC").Find(&migrations)
	return migrations
}
