package repository

import (
	"cert-renewal/internal/model"

	"gorm.io/gorm"
)

type RenewalWindowRepository interface {
	Create(window *model.RenewalWindow, tx *gorm.DB) error
	GetByID(id string) (*model.RenewalWindow, error)
	List(params *model.QueryParams) ([]model.RenewalWindow, int64, error)
	ListOpenWindows() ([]model.RenewalWindow, error)
	Update(window *model.RenewalWindow, tx *gorm.DB) error
}

type renewalWindowRepository struct {
	db *gorm.DB
}

func NewRenewalWindowRepository() RenewalWindowRepository {
	return &renewalWindowRepository{db: GetDB()}
}

func (r *renewalWindowRepository) getDB(tx *gorm.DB) *gorm.DB {
	if tx != nil {
		return tx
	}
	return r.db
}

func (r *renewalWindowRepository) Create(window *model.RenewalWindow, tx *gorm.DB) error {
	window.BeforeCreate()
	return r.getDB(tx).Create(window).Error
}

func (r *renewalWindowRepository) GetByID(id string) (*model.RenewalWindow, error) {
	var window model.RenewalWindow
	err := r.db.Where("id = ?", id).First(&window).Error
	if err == gorm.ErrRecordNotFound {
		return nil, model.ErrRenewalWindowNotFound
	}
	return &window, err
}

func (r *renewalWindowRepository) List(params *model.QueryParams) ([]model.RenewalWindow, int64, error) {
	var windows []model.RenewalWindow
	var total int64

	query := r.db.Model(&model.RenewalWindow{})

	if params.PartnerID != "" {
		query = query.Where("partner_id = ?", params.PartnerID)
	}
	if params.Status != "" {
		query = query.Where("status = ?", params.Status)
	}

	offset := (params.Page - 1) * params.PageSize
	err := query.Count(&total).Offset(offset).Limit(params.PageSize).Order("created_at DESC").Find(&windows).Error
	return windows, total, err
}

func (r *renewalWindowRepository) ListOpenWindows() ([]model.RenewalWindow, error) {
	var windows []model.RenewalWindow
	err := r.db.Where("status = ? AND reminder_sent = ?", model.RenewalWindowStatusOpen, false).Find(&windows).Error
	return windows, err
}

func (r *renewalWindowRepository) Update(window *model.RenewalWindow, tx *gorm.DB) error {
	return r.getDB(tx).Save(window).Error
}
