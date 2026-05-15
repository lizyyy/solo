package repository

import (
	"customer-probe-api/internal/models"
	"customer-probe-api/pkg/database"
	"customer-probe-api/pkg/utils"
)

type NetworkResultRepository struct{}

func NewNetworkResultRepository() *NetworkResultRepository {
	return &NetworkResultRepository{}
}

func (r *NetworkResultRepository) Create(result *models.NetworkResult) (*models.NetworkResult, error) {
	if result.ID == "" {
		result.ID = utils.GenerateID()
	}
	if err := database.GetDB().Create(result).Error; err != nil {
		return nil, err
	}
	return result, nil
}

func (r *NetworkResultRepository) GetByID(id string) (*models.NetworkResult, error) {
	var result models.NetworkResult
	if err := database.GetDB().First(&result, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &result, nil
}

func (r *NetworkResultRepository) GetByTaskID(taskID string) ([]models.NetworkResult, error) {
	var results []models.NetworkResult
	if err := database.GetDB().Where("task_id = ?", taskID).Find(&results).Error; err != nil {
		return nil, err
	}
	return results, nil
}

func (r *NetworkResultRepository) DeleteByTaskID(taskID string) error {
	return database.GetDB().Delete(&models.NetworkResult{}, "task_id = ?", taskID).Error
}
