package repository

import (
	"customer-probe-api/internal/models"
	"customer-probe-api/pkg/database"
	"customer-probe-api/pkg/utils"
	"errors"
)

type EnvironmentRepository struct{}

func NewEnvironmentRepository() *EnvironmentRepository {
	return &EnvironmentRepository{}
}

func (r *EnvironmentRepository) Create(env *models.CustomerEnvironment) (*models.CustomerEnvironment, error) {
	if env.ID == "" {
		env.ID = utils.GenerateID()
	}
	if err := database.GetDB().Create(env).Error; err != nil {
		return nil, err
	}
	return env, nil
}

func (r *EnvironmentRepository) GetByID(id string) (*models.CustomerEnvironment, error) {
	var env models.CustomerEnvironment
	if err := database.GetDB().First(&env, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &env, nil
}

func (r *EnvironmentRepository) GetByCustomerID(customerID string, page, pageSize int) ([]models.CustomerEnvironment, int64, error) {
	var envs []models.CustomerEnvironment
	var total int64
	db := database.GetDB().Model(&models.CustomerEnvironment{}).Where("customer_id = ?", customerID)
	db.Count(&total)
	offset := (page - 1) * pageSize
	if err := db.Offset(offset).Limit(pageSize).Find(&envs).Error; err != nil {
		return nil, 0, err
	}
	return envs, total, nil
}

func (r *EnvironmentRepository) Update(env *models.CustomerEnvironment) error {
	return database.GetDB().Save(env).Error
}

func (r *EnvironmentRepository) Delete(id string) error {
	return database.GetDB().Delete(&models.CustomerEnvironment{}, "id = ?", id).Error
}

func (r *EnvironmentRepository) List(page, pageSize int) ([]models.CustomerEnvironment, int64, error) {
	var envs []models.CustomerEnvironment
	var total int64
	db := database.GetDB().Model(&models.CustomerEnvironment{})
	db.Count(&total)
	offset := (page - 1) * pageSize
	if err := db.Offset(offset).Limit(pageSize).Find(&envs).Error; err != nil {
		return nil, 0, err
	}
	return envs, total, nil
}
