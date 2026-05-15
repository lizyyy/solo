package repository

import (
	"cert-renewal/internal/model"

	"gorm.io/gorm"
)

type EnablementRepository interface {
	Create(record *model.EnablementRecord, tx *gorm.DB) error
	GetByID(id string) (*model.EnablementRecord, error)
	List(params *model.HistoryQueryParams) ([]model.EnablementRecord, int64, error)
}

type enablementRepository struct {
	db *gorm.DB
}

func NewEnablementRepository() EnablementRepository {
	return &enablementRepository{db: GetDB()}
}

func (r *enablementRepository) getDB(tx *gorm.DB) *gorm.DB {
	if tx != nil {
		return tx
	}
	return r.db
}

func (r *enablementRepository) Create(record *model.EnablementRecord, tx *gorm.DB) error {
	record.BeforeCreate()
	return r.getDB(tx).Create(record).Error
}

func (r *enablementRepository) GetByID(id string) (*model.EnablementRecord, error) {
	var record model.EnablementRecord
	err := r.db.Where("id = ?", id).First(&record).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &record, err
}

func (r *enablementRepository) List(params *model.HistoryQueryParams) ([]model.EnablementRecord, int64, error) {
	var records []model.EnablementRecord
	var total int64

	query := r.db.Model(&model.EnablementRecord{})

	if params.PartnerID != "" {
		query = query.Where("partner_id = ?", params.PartnerID)
	}
	if params.CertID != "" {
		query = query.Where("cert_id = ?", params.CertID)
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
