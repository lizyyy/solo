package repository

import (
	"time"
	"webhook-migration/model"

	"github.com/google/uuid"
)

type EventRecordRepository struct{}

func NewEventRecordRepository() *EventRecordRepository {
	return &EventRecordRepository{}
}

func (r *EventRecordRepository) Create(event *model.EventRecord) error {
	event.ID = uuid.NewString()
	event.CreatedAt = time.Now()
	return DB.Create(event).Error
}

func (r *EventRecordRepository) BatchCreate(events []model.EventRecord) error {
	if len(events) == 0 {
		return nil
	}
	tx := DB.Begin()
	for i := range events {
		events[i].ID = uuid.NewString()
		events[i].CreatedAt = time.Now()
		if err := tx.Create(&events[i]).Error; err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit().Error
}

func (r *EventRecordRepository) GetByMigrationID(migrationID string, page, pageSize int) ([]model.EventRecord, int64, error) {
	var events []model.EventRecord
	var total int64
	offset := (page - 1) * pageSize
	err := DB.Model(&model.EventRecord{}).Where("migration_id = ?", migrationID).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = DB.Where("migration_id = ?", migrationID).Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&events).Error
	return events, total, err
}

func (r *EventRecordRepository) GetStatsByMigrationID(migrationID string) (int, int, int, int, error) {
	var total int64
	var matched int64
	var mismatched int64
	var missing int64

	DB.Model(&model.EventRecord{}).Where("migration_id = ?", migrationID).Count(&total)
	DB.Model(&model.EventRecord{}).Where("migration_id = ? AND compare_result = ?", migrationID, model.CompareMatch).Count(&matched)
	DB.Model(&model.EventRecord{}).Where("migration_id = ? AND compare_result = ?", migrationID, model.CompareMismatch).Count(&mismatched)
	DB.Model(&model.EventRecord{}).Where("migration_id = ? AND compare_result = ?", migrationID, model.CompareMissing).Count(&missing)

	return int(total), int(matched), int(mismatched), int(missing), nil
}

func (r *EventRecordRepository) GetByID(id string) (*model.EventRecord, error) {
	var event model.EventRecord
	err := DB.Where("id = ?", id).First(&event).Error
	return &event, err
}

func (r *EventRecordRepository) UpdateCompareResult(id string, result model.EventCompareResult, detail string) error {
	return DB.Model(&model.EventRecord{}).Where("id = ?", id).Updates(map[string]interface{}{
		"compare_result": result,
		"compare_detail": detail,
	}).Error
}

func (r *EventRecordRepository) GetAllByMigrationID(migrationID string) ([]model.EventRecord, error) {
	var events []model.EventRecord
	err := DB.Where("migration_id = ?", migrationID).Order("created_at DESC").Find(&events).Error
	return events, err
}

type StatusTransitionRepository struct{}

func NewStatusTransitionRepository() *StatusTransitionRepository {
	return &StatusTransitionRepository{}
}

func (r *StatusTransitionRepository) Create(transition *model.StatusTransition) error {
	transition.ID = uuid.NewString()
	transition.CreatedAt = time.Now()
	return DB.Create(transition).Error
}

func (r *StatusTransitionRepository) GetByMigrationID(migrationID string) ([]model.StatusTransition, error) {
	var transitions []model.StatusTransition
	err := DB.Where("migration_id = ?", migrationID).Order("created_at ASC").Find(&transitions).Error
	return transitions, err
}
