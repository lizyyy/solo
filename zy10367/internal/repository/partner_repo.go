package repository

import (
	"cert-renewal/internal/model"

	"gorm.io/gorm"
)

type PartnerRepository interface {
	Create(partner *model.Partner) error
	GetByID(id string) (*model.Partner, error)
	GetByCode(code string) (*model.Partner, error)
	List(params *model.QueryParams) ([]model.Partner, int64, error)
	Update(partner *model.Partner) error
}

type partnerRepository struct {
	db *gorm.DB
}

func NewPartnerRepository() PartnerRepository {
	return &partnerRepository{db: GetDB()}
}

func (r *partnerRepository) Create(partner *model.Partner) error {
	partner.BeforeCreate()
	return r.db.Create(partner).Error
}

func (r *partnerRepository) GetByID(id string) (*model.Partner, error) {
	var partner model.Partner
	err := r.db.Where("id = ?", id).First(&partner).Error
	if err == gorm.ErrRecordNotFound {
		return nil, model.ErrPartnerNotFound
	}
	return &partner, err
}

func (r *partnerRepository) GetByCode(code string) (*model.Partner, error) {
	var partner model.Partner
	err := r.db.Where("code = ?", code).First(&partner).Error
	if err == gorm.ErrRecordNotFound {
		return nil, model.ErrPartnerNotFound
	}
	return &partner, err
}

func (r *partnerRepository) List(params *model.QueryParams) ([]model.Partner, int64, error) {
	var partners []model.Partner
	var total int64

	query := r.db.Model(&model.Partner{})

	if params.Status != "" {
		query = query.Where("status = ?", params.Status)
	}

	offset := (params.Page - 1) * params.PageSize
	err := query.Count(&total).Offset(offset).Limit(params.PageSize).Find(&partners).Error
	return partners, total, err
}

func (r *partnerRepository) Update(partner *model.Partner) error {
	return r.db.Save(partner).Error
}
