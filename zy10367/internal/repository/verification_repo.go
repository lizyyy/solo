package repository

import (
	"cert-renewal/internal/model"

	"gorm.io/gorm"
)

type VerificationRepository interface {
	Create(verification *model.VerificationRequest, tx *gorm.DB) error
	GetByID(id string) (*model.VerificationRequest, error)
	GetByRequestID(requestID string) (*model.VerificationRequest, error)
	List(params *model.QueryParams) ([]model.VerificationRequest, int64, error)
	Update(verification *model.VerificationRequest, tx *gorm.DB) error
}

type verificationRepository struct {
	db *gorm.DB
}

func NewVerificationRepository() VerificationRepository {
	return &verificationRepository{db: GetDB()}
}

func (r *verificationRepository) getDB(tx *gorm.DB) *gorm.DB {
	if tx != nil {
		return tx
	}
	return r.db
}

func (r *verificationRepository) Create(verification *model.VerificationRequest, tx *gorm.DB) error {
	verification.BeforeCreate()
	return r.getDB(tx).Create(verification).Error
}

func (r *verificationRepository) GetByID(id string) (*model.VerificationRequest, error) {
	var verification model.VerificationRequest
	err := r.db.Where("id = ?", id).First(&verification).Error
	if err == gorm.ErrRecordNotFound {
		return nil, model.ErrVerificationNotFound
	}
	return &verification, err
}

func (r *verificationRepository) GetByRequestID(requestID string) (*model.VerificationRequest, error) {
	var verification model.VerificationRequest
	err := r.db.Where("request_id = ?", requestID).First(&verification).Error
	if err == gorm.ErrRecordNotFound {
		return nil, model.ErrVerificationNotFound
	}
	return &verification, err
}

func (r *verificationRepository) List(params *model.QueryParams) ([]model.VerificationRequest, int64, error) {
	var verifications []model.VerificationRequest
	var total int64

	query := r.db.Model(&model.VerificationRequest{})

	if params.PartnerID != "" {
		query = query.Where("partner_id = ?", params.PartnerID)
	}
	if params.Status != "" {
		query = query.Where("status = ?", params.Status)
	}

	offset := (params.Page - 1) * params.PageSize
	err := query.Count(&total).Offset(offset).Limit(params.PageSize).Order("created_at DESC").Find(&verifications).Error
	return verifications, total, err
}

func (r *verificationRepository) Update(verification *model.VerificationRequest, tx *gorm.DB) error {
	return r.getDB(tx).Save(verification).Error
}
