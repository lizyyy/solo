package repository

import (
	"customer-probe-api/internal/models"
	"customer-probe-api/pkg/database"
	"customer-probe-api/pkg/utils"
)

type ProxySettingRepository struct{}

func NewProxySettingRepository() *ProxySettingRepository {
	return &ProxySettingRepository{}
}

func (r *ProxySettingRepository) Create(setting *models.ProxySetting) (*models.ProxySetting, error) {
	if setting.ID == "" {
		setting.ID = utils.GenerateID()
	}
	if err := database.GetDB().Create(setting).Error; err != nil {
		return nil, err
	}
	return setting, nil
}

func (r *ProxySettingRepository) GetByID(id string) (*models.ProxySetting, error) {
	var setting models.ProxySetting
	if err := database.GetDB().First(&setting, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &setting, nil
}

func (r *ProxySettingRepository) GetByEnvID(envID string) ([]models.ProxySetting, error) {
	var settings []models.ProxySetting
	if err := database.GetDB().Where("env_id = ?", envID).Find(&settings).Error; err != nil {
		return nil, err
	}
	return settings, nil
}

func (r *ProxySettingRepository) Update(setting *models.ProxySetting) error {
	return database.GetDB().Save(setting).Error
}

func (r *ProxySettingRepository) Delete(id string) error {
	return database.GetDB().Delete(&models.ProxySetting{}, "id = ?", id).Error
}
