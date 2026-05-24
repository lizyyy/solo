package repository

import (
	"compliance-exemption-api/internal/model"
	"time"

	"gorm.io/gorm"
)

type ExemptionRepository interface {
	Create(exemption *model.Exemption) error
	GetByID(id string) (*model.Exemption, error)
	GetByIdempotencyKey(key string) (*model.Exemption, error)
	Update(exemption *model.Exemption) error
	Query(req *model.QueryRequest) ([]model.Exemption, int64, error)
	GetExpiredApproved(currentTime time.Time) ([]model.Exemption, error)
	GetByScriptVersion(scriptVersion string) ([]model.Exemption, error)
	GetStatistics() (*model.StatisticsSummary, error)
	GetAllForExport() ([]model.Exemption, error)
}

type exemptionRepository struct {
	db *gorm.DB
}

func NewExemptionRepository(db *gorm.DB) ExemptionRepository {
	return &exemptionRepository{db: db}
}

func (r *exemptionRepository) Create(exemption *model.Exemption) error {
	return r.db.Create(exemption).Error
}

func (r *exemptionRepository) GetByID(id string) (*model.Exemption, error) {
	var exemption model.Exemption
	err := r.db.Preload("Samples").Preload("ApprovalHistory").Preload("OperationLogs").
		Where("id = ?", id).First(&exemption).Error
	if err != nil {
		return nil, err
	}
	return &exemption, nil
}

func (r *exemptionRepository) GetByIdempotencyKey(key string) (*model.Exemption, error) {
	var exemption model.Exemption
	err := r.db.Preload("Samples").Preload("ApprovalHistory").
		Where("idempotency_key = ?", key).First(&exemption).Error
	if err != nil {
		return nil, err
	}
	return &exemption, nil
}

func (r *exemptionRepository) Update(exemption *model.Exemption) error {
	return r.db.Save(exemption).Error
}

func (r *exemptionRepository) Query(req *model.QueryRequest) ([]model.Exemption, int64, error) {
	var exemptions []model.Exemption
	var total int64

	query := r.db.Model(&model.Exemption{})

	if req.ScriptVersion != "" {
		query = query.Where("script_version = ?", req.ScriptVersion)
	}
	if req.AgentID != "" {
		query = query.Where("agent_id = ?", req.AgentID)
	}
	if req.Status != "" {
		query = query.Where("status = ?", req.Status)
	}
	if req.CallID != "" {
		query = query.Where("call_id = ?", req.CallID)
	}
	if req.StartDate != nil {
		query = query.Where("created_at >= ?", *req.StartDate)
	}
	if req.EndDate != nil {
		query = query.Where("created_at <= ?", *req.EndDate)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (req.Page - 1) * req.PageSize
	err := query.Preload("Samples").Preload("ApprovalHistory").
		Order("created_at DESC").
		Limit(req.PageSize).Offset(offset).
		Find(&exemptions).Error

	return exemptions, total, err
}

func (r *exemptionRepository) GetExpiredApproved(currentTime time.Time) ([]model.Exemption, error) {
	var exemptions []model.Exemption
	err := r.db.Where("status = ? AND expire_at < ?", model.StatusApproved, currentTime).
		Find(&exemptions).Error
	return exemptions, err
}

func (r *exemptionRepository) GetByScriptVersion(scriptVersion string) ([]model.Exemption, error) {
	var exemptions []model.Exemption
	err := r.db.Where("script_version = ? AND status IN (?, ?)", scriptVersion, model.StatusApproved, model.StatusPending).
		Find(&exemptions).Error
	return exemptions, err
}

func (r *exemptionRepository) GetStatistics() (*model.StatisticsSummary, error) {
	var stats model.StatisticsSummary

	r.db.Model(&model.Exemption{}).Count(&stats.TotalCount)
	r.db.Model(&model.Exemption{}).Where("status = ?", model.StatusPending).Count(&stats.PendingCount)
	r.db.Model(&model.Exemption{}).Where("status = ?", model.StatusApproved).Count(&stats.ApprovedCount)
	r.db.Model(&model.Exemption{}).Where("status = ?", model.StatusRejected).Count(&stats.RejectedCount)
	r.db.Model(&model.Exemption{}).Where("status = ?", model.StatusExpired).Count(&stats.ExpiredCount)

	r.db.Model(&model.ApprovalLog{}).Where("is_conflict = ?", true).Count(&stats.ConflictCount)

	var noSampleCount int64
	r.db.Raw(`
		SELECT COUNT(*) FROM exemptions e
		WHERE NOT EXISTS (
			SELECT 1 FROM samples s WHERE s.exemption_id = e.id
		)
	`).Scan(&noSampleCount)
	stats.NoSampleCount = noSampleCount

	return &stats, nil
}

func (r *exemptionRepository) GetAllForExport() ([]model.Exemption, error) {
	var exemptions []model.Exemption
	err := r.db.Preload("Samples").Preload("ApprovalHistory").
		Order("created_at DESC").
		Find(&exemptions).Error
	return exemptions, err
}
