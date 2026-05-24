package repository

import (
	"compliance-exemption-api/internal/model"

	"gorm.io/gorm"
)

type QualityReportRepository interface {
	Create(report *model.QualityReport) error
	GetByID(id string) (*model.QualityReport, error)
	GetByExemptionID(exemptionID string) ([]model.QualityReport, error)
	GetByReportNo(reportNo string) (*model.QualityReport, error)
	Update(report *model.QualityReport) error
	QueryByInspector(inspectorID string) ([]model.QualityReport, error)
}

type qualityReportRepository struct {
	db *gorm.DB
}

func NewQualityReportRepository(db *gorm.DB) QualityReportRepository {
	return &qualityReportRepository{db: db}
}

func (r *qualityReportRepository) Create(report *model.QualityReport) error {
	return r.db.Create(report).Error
}

func (r *qualityReportRepository) GetByID(id string) (*model.QualityReport, error) {
	var report model.QualityReport
	err := r.db.Where("id = ?", id).First(&report).Error
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *qualityReportRepository) GetByExemptionID(exemptionID string) ([]model.QualityReport, error) {
	var reports []model.QualityReport
	err := r.db.Where("exemption_id = ?", exemptionID).Order("created_at DESC").Find(&reports).Error
	return reports, err
}

func (r *qualityReportRepository) GetByReportNo(reportNo string) (*model.QualityReport, error) {
	var report model.QualityReport
	err := r.db.Where("report_no = ?", reportNo).First(&report).Error
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *qualityReportRepository) Update(report *model.QualityReport) error {
	return r.db.Save(report).Error
}

func (r *qualityReportRepository) QueryByInspector(inspectorID string) ([]model.QualityReport, error) {
	var reports []model.QualityReport
	err := r.db.Where("inspector_id = ?", inspectorID).Order("created_at DESC").Find(&reports).Error
	return reports, err
}
