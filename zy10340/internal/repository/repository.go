package repository

import (
	"api-replay-throttler/internal/model"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var ErrDuplicateKey = errors.New("duplicate idempotency key")

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CheckIdempotency(key string) (*model.IdempotencyRecord, error) {
	var record model.IdempotencyRecord
	err := r.db.Where("key = ?", key).First(&record).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &record, err
}

func (r *Repository) SaveIdempotency(key, resource, result string) error {
	existing, err := r.CheckIdempotency(key)
	if err != nil {
		return err
	}
	if existing != nil {
		return ErrDuplicateKey
	}

	record := model.IdempotencyRecord{
		ID:        uuid.New().String(),
		Key:       key,
		Resource:  resource,
		Result:    result,
		CreatedAt: time.Now(),
	}
	return r.db.Create(&record).Error
}

func (r *Repository) CreateTenant(tenant *model.Tenant) error {
	return r.db.Create(tenant).Error
}

func (r *Repository) GetTenantByID(id string) (*model.Tenant, error) {
	var tenant model.Tenant
	err := r.db.First(&tenant, "id = ?", id).Error
	return &tenant, err
}

func (r *Repository) CreateSample(sample *model.TrafficSample) error {
	return r.db.Create(sample).Error
}

func (r *Repository) GetSampleByID(id string) (*model.TrafficSample, error) {
	var sample model.TrafficSample
	err := r.db.First(&sample, "id = ?", id).Error
	return &sample, err
}

func (r *Repository) GetSamplesByTenant(tenantID string, limit, offset int) ([]model.TrafficSample, int64, error) {
	var samples []model.TrafficSample
	var count int64
	r.db.Model(&model.TrafficSample{}).Where("tenant_id = ?", tenantID).Count(&count)
	err := r.db.Where("tenant_id = ?", tenantID).Limit(limit).Offset(offset).Find(&samples).Error
	return samples, count, err
}

func (r *Repository) CreateRule(rule *model.ThrottleRule) error {
	return r.db.Create(rule).Error
}

func (r *Repository) GetRuleByID(id string) (*model.ThrottleRule, error) {
	var rule model.ThrottleRule
	err := r.db.First(&rule, "id = ?", id).Error
	return &rule, err
}

func (r *Repository) GetRulesByTenant(tenantID string) ([]model.ThrottleRule, error) {
	var rules []model.ThrottleRule
	err := r.db.Where("tenant_id = ?", tenantID).Find(&rules).Error
	return rules, err
}

func (r *Repository) CreatePlan(plan *model.ReplayPlan) error {
	return r.db.Create(plan).Error
}

func (r *Repository) GetPlanByID(id string) (*model.ReplayPlan, error) {
	var plan model.ReplayPlan
	err := r.db.First(&plan, "id = ?", id).Error
	return &plan, err
}

func (r *Repository) UpdatePlan(plan *model.ReplayPlan) error {
	return r.db.Save(plan).Error
}

func (r *Repository) GetPlansByTenant(tenantID string, limit, offset int) ([]model.ReplayPlan, int64, error) {
	var plans []model.ReplayPlan
	var count int64
	r.db.Model(&model.ReplayPlan{}).Where("tenant_id = ?", tenantID).Count(&count)
	err := r.db.Where("tenant_id = ?", tenantID).Limit(limit).Offset(offset).Order("created_at DESC").Find(&plans).Error
	return plans, count, err
}

func (r *Repository) CreatePausePoint(pause *model.PausePoint) error {
	return r.db.Create(pause).Error
}

func (r *Repository) UpdatePausePoint(pause *model.PausePoint) error {
	return r.db.Save(pause).Error
}

func (r *Repository) GetPausePointsByPlan(planID string) ([]model.PausePoint, error) {
	var pauses []model.PausePoint
	err := r.db.Where("plan_id = ?", planID).Order("created_at DESC").Find(&pauses).Error
	return pauses, err
}

func (r *Repository) CreateResult(result *model.ReplayResult) error {
	return r.db.Create(result).Error
}

func (r *Repository) GetResultsByPlan(planID string, limit, offset int) ([]model.ReplayResult, int64, error) {
	var results []model.ReplayResult
	var count int64
	r.db.Model(&model.ReplayResult{}).Where("plan_id = ?", planID).Count(&count)
	err := r.db.Where("plan_id = ?", planID).Limit(limit).Offset(offset).Order("created_at DESC").Find(&results).Error
	return results, count, err
}

func (r *Repository) GetAllResultsByPlan(planID string) ([]model.ReplayResult, error) {
	var results []model.ReplayResult
	err := r.db.Where("plan_id = ?", planID).Order("created_at ASC").Find(&results).Error
	return results, err
}

func (r *Repository) GetResultStatistics(planID string) (map[string]interface{}, error) {
	var total int64
	var success int64
	var failed int64

	r.db.Model(&model.ReplayResult{}).Where("plan_id = ?", planID).Count(&total)
	r.db.Model(&model.ReplayResult{}).Where("plan_id = ? AND status = ?", planID, model.ResultStatusSuccess).Count(&success)
	r.db.Model(&model.ReplayResult{}).Where("plan_id = ? AND status = ?", planID, model.ResultStatusFailed).Count(&failed)

	errorCategories := make(map[string]int64)
	rows, err := r.db.Model(&model.ReplayResult{}).
		Select("error_category, COUNT(*) as count").
		Where("plan_id = ? AND status = ?", planID, model.ResultStatusFailed).
		Group("error_category").
		Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var category string
		var count int64
		rows.Scan(&category, &count)
		errorCategories[category] = count
	}

	return map[string]interface{}{
		"total":            total,
		"success":          success,
		"failed":           failed,
		"error_categories": errorCategories,
	}, nil
}
