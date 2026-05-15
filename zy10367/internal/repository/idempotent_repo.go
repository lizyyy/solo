package repository

import (
	"cert-renewal/internal/model"
	"time"
)

type IdempotentRepository interface {
	Create(record *model.IdempotentRequest) error
	GetByRequestID(requestID string) (*model.IdempotentRequest, error)
}

type idempotentRepository struct{}

func NewIdempotentRepository() IdempotentRepository {
	return &idempotentRepository{}
}

func (r *idempotentRepository) Create(record *model.IdempotentRequest) error {
	record.BeforeCreate()
	record.ProcessedAt = time.Now().UTC()
	return GetDB().Create(record).Error
}

func (r *idempotentRepository) GetByRequestID(requestID string) (*model.IdempotentRequest, error) {
	var record model.IdempotentRequest
	err := GetDB().Where("request_id = ?", requestID).First(&record).Error
	if err != nil {
		return nil, nil
	}
	return &record, nil
}
