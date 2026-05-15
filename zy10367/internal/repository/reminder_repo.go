package repository

import (
	"cert-renewal/internal/model"

	"gorm.io/gorm"
)

type ReminderRepository interface {
	Create(reminder *model.RenewalReminder, tx *gorm.DB) error
	GetByID(id string) (*model.RenewalReminder, error)
	List(params *model.ReminderQueryParams) ([]model.RenewalReminder, int64, error)
	Update(reminder *model.RenewalReminder, tx *gorm.DB) error
}

type reminderRepository struct{}

func NewReminderRepository() ReminderRepository {
	return &reminderRepository{}
}

func (r *reminderRepository) getDB(tx *gorm.DB) *gorm.DB {
	if tx != nil {
		return tx
	}
	return GetDB()
}

func (r *reminderRepository) Create(reminder *model.RenewalReminder, tx *gorm.DB) error {
	reminder.BeforeCreate()
	return r.getDB(tx).Create(reminder).Error
}

func (r *reminderRepository) GetByID(id string) (*model.RenewalReminder, error) {
	var reminder model.RenewalReminder
	err := GetDB().Where("id = ?", id).First(&reminder).Error
	if err != nil {
		return nil, err
	}
	return &reminder, nil
}

func (r *reminderRepository) List(params *model.ReminderQueryParams) ([]model.RenewalReminder, int64, error) {
	var reminders []model.RenewalReminder
	var total int64

	query := GetDB().Model(&model.RenewalReminder{})

	if params.PartnerID != "" {
		query = query.Where("partner_id = ?", params.PartnerID)
	}
	if params.IsSent {
		query = query.Where("status = ?", model.ReminderStatusSent)
	} else {
		query = query.Where("status = ?", model.ReminderStatusPending)
	}
	if !params.StartTime.IsZero() {
		query = query.Where("created_at >= ?", params.StartTime)
	}
	if !params.EndTime.IsZero() {
		query = query.Where("created_at <= ?", params.EndTime)
	}

	offset := (params.Page - 1) * params.PageSize
	err := query.Count(&total).Offset(offset).Limit(params.PageSize).Order("created_at DESC").Find(&reminders).Error
	return reminders, total, err
}

func (r *reminderRepository) Update(reminder *model.RenewalReminder, tx *gorm.DB) error {
	return r.getDB(tx).Save(reminder).Error
}
