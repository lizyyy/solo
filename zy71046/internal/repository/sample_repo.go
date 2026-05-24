package repository

import (
	"compliance-exemption-api/internal/model"

	"gorm.io/gorm"
)

type SampleRepository interface {
	Create(sample *model.Sample) error
	GetByID(id string) (*model.Sample, error)
	GetByExemptionID(exemptionID string) ([]model.Sample, error)
	Delete(id string) error
	CountByExemptionID(exemptionID string) (int64, error)
}

type sampleRepository struct {
	db *gorm.DB
}

func NewSampleRepository(db *gorm.DB) SampleRepository {
	return &sampleRepository{db: db}
}

func (r *sampleRepository) Create(sample *model.Sample) error {
	return r.db.Create(sample).Error
}

func (r *sampleRepository) GetByID(id string) (*model.Sample, error) {
	var sample model.Sample
	err := r.db.Where("id = ?", id).First(&sample).Error
	if err != nil {
		return nil, err
	}
	return &sample, nil
}

func (r *sampleRepository) GetByExemptionID(exemptionID string) ([]model.Sample, error) {
	var samples []model.Sample
	err := r.db.Where("exemption_id = ?", exemptionID).Find(&samples).Error
	return samples, err
}

func (r *sampleRepository) Delete(id string) error {
	return r.db.Delete(&model.Sample{}, "id = ?", id).Error
}

func (r *sampleRepository) CountByExemptionID(exemptionID string) (int64, error) {
	var count int64
	err := r.db.Model(&model.Sample{}).Where("exemption_id = ?", exemptionID).Count(&count).Error
	return count, err
}
