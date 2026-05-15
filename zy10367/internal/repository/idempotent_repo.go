package repository

import (
	"cert-renewal/internal/model"
	"time"

	"gorm.io/gorm"
)

type IdempotentRepository interface {
	Create(record *model.IdempotentRequest) error
	GetByRequestKey(requestKey string) (*model.IdempotentRequest, error)
	TryCreate(record *model.IdempotentRequest) (bool, error)
}

type idempotentRepository struct {
	db *gorm.DB
}

func NewIdempotentRepository() IdempotentRepository {
	return &idempotentRepository{db: GetDB()}
}

func (r *idempotentRepository) Create(record *model.IdempotentRequest) error {
	record.BeforeCreate()
	record.ProcessedAt = time.Now().UTC()
	return r.db.Create(record).Error
}

func (r *idempotentRepository) GetByRequestKey(requestKey string) (*model.IdempotentRequest, error) {
	var record model.IdempotentRequest
	err := r.db.Where("request_key = ?", requestKey).First(&record).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &record, err
}

func (r *idempotentRepository) TryCreate(record *model.IdempotentRequest) (bool, error) {
	record.BeforeCreate()
	record.ProcessedAt = time.Now().UTC()
	
	err := r.db.Create(record).Error
	if err != nil {
		return false, nil
	}
	return true, nil
}
