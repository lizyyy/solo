package repository

import (
	"compliance-exemption-api/internal/model"

	"gorm.io/gorm"
)

type ApprovalLogRepository interface {
	Create(log *model.ApprovalLog) error
	GetByExemptionID(exemptionID string) ([]model.ApprovalLog, error)
	HasSupervisorApproved(exemptionID, supervisorID string) (bool, *model.ApprovalLog, error)
}

type OperationLogRepository interface {
	Create(log *model.OperationLog) error
	GetByExemptionID(exemptionID string) ([]model.OperationLog, error)
}

type approvalLogRepository struct {
	db *gorm.DB
}

type operationLogRepository struct {
	db *gorm.DB
}

func NewApprovalLogRepository(db *gorm.DB) ApprovalLogRepository {
	return &approvalLogRepository{db: db}
}

func NewOperationLogRepository(db *gorm.DB) OperationLogRepository {
	return &operationLogRepository{db: db}
}

func (r *approvalLogRepository) Create(log *model.ApprovalLog) error {
	return r.db.Create(log).Error
}

func (r *approvalLogRepository) GetByExemptionID(exemptionID string) ([]model.ApprovalLog, error) {
	var logs []model.ApprovalLog
	err := r.db.Where("exemption_id = ?", exemptionID).Order("created_at DESC").Find(&logs).Error
	return logs, err
}

func (r *approvalLogRepository) HasSupervisorApproved(exemptionID, supervisorID string) (bool, *model.ApprovalLog, error) {
	var log model.ApprovalLog
	err := r.db.Where("exemption_id = ? AND supervisor_id = ?", exemptionID, supervisorID).
		First(&log).Error
	if err == gorm.ErrRecordNotFound {
		return false, nil, nil
	}
	if err != nil {
		return false, nil, err
	}
	return true, &log, nil
}

func (r *operationLogRepository) Create(log *model.OperationLog) error {
	return r.db.Create(log).Error
}

func (r *operationLogRepository) GetByExemptionID(exemptionID string) ([]model.OperationLog, error) {
	var logs []model.OperationLog
	err := r.db.Where("exemption_id = ?", exemptionID).Order("created_at DESC").Find(&logs).Error
	return logs, err
}
