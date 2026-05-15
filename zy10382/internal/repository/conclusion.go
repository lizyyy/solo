package repository

import (
	"customer-probe-api/internal/models"
	"customer-probe-api/pkg/database"
	"customer-probe-api/pkg/utils"
)

type ConclusionRepository struct{}

func NewConclusionRepository() *ConclusionRepository {
	return &ConclusionRepository{}
}

func (r *ConclusionRepository) Create(conclusion *models.DiagnosisConclusion) (*models.DiagnosisConclusion, error) {
	if conclusion.ID == "" {
		conclusion.ID = utils.GenerateID()
	}
	if err := database.GetDB().Create(conclusion).Error; err != nil {
		return nil, err
	}
	return conclusion, nil
}

func (r *ConclusionRepository) GetByID(id string) (*models.DiagnosisConclusion, error) {
	var conclusion models.DiagnosisConclusion
	if err := database.GetDB().First(&conclusion, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &conclusion, nil
}

func (r *ConclusionRepository) GetByTaskID(taskID string) (*models.DiagnosisConclusion, error) {
	var conclusion models.DiagnosisConclusion
	if err := database.GetDB().Where("task_id = ?", taskID).First(&conclusion).Error; err != nil {
		return nil, err
	}
	return &conclusion, nil
}

func (r *ConclusionRepository) Update(conclusion *models.DiagnosisConclusion) error {
	return database.GetDB().Save(conclusion).Error
}

func (r *ConclusionRepository) DeleteByTaskID(taskID string) error {
	return database.GetDB().Delete(&models.DiagnosisConclusion{}, "task_id = ?", taskID).Error
}
