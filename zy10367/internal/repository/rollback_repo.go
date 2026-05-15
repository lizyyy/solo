package repository

import (
	"cert-renewal/internal/model"

	"gorm.io/gorm"
)

type RollbackRepository interface {
	Create(record *model.RollbackRecord, tx *gorm.DB) error
	GetByID(id string) (*model.RollbackRecord, error)
	List(params *model.HistoryQueryParams) ([]model.RollbackRecord, int64, error)
}

type rollbackRepository struct {
	db *gorm.DB
}

func NewRollbackRepository() RollbackRepository {
	return &rollbackRepository{db: GetDB()}
}

func (r *rollbackRepository) getDB(tx *gorm.DB) *gorm.DB {
	if tx != nil {
		return tx
	}
	return r.db
}

func (r *rollbackRepository) Create(record *model.RollbackRecord, tx *gorm.DB) error {
	record.BeforeCreate()
	return r.getDB(tx).Create(record).Error
}

func (r *rollbackRepository) GetByID(id string) (*model.RollbackRecord, error) {
	var record model.RollbackRecord
	err := r.db.Where("id = ?", id).First(&record).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &record, err
}

func (r *rollbackRepository) List(params *model.HistoryQueryParams) ([]model.RollbackRecord, int64, error) {
	var records []model.RollbackRecord
	var total int64

	query := r.db.Model(&model.RollbackRecord{})

	if params.PartnerID != "" {
		query = query.Where("partner_id = ?", params.PartnerID)
	}
	if !params.StartTime.IsZero() {
		query = query.Where("created_at >= ?", params.StartTime)
	}
	if !params.EndTime.IsZero() {
		query = query.Where("created_at <= ?", params.EndTime)
	}

	offset := (params.Page - 1) * params.PageSize
	err := query.Count(&total).Offset(offset).Limit(params.PageSize).Order("created_at DESC").Find(&records).Error
	return records, total, err
}
