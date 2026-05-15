package repository

import (
	"time"

	"api-gateway-tester/internal/model"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func NewDB(path string) (*gorm.DB, error) {
	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	err = db.AutoMigrate(
		&model.UpstreamService{},
		&model.MatchCondition{},
		&model.RouteRule{},
		&model.RequestSample{},
		&model.ConflictRule{},
		&model.TrialRequest{},
		&model.TrialResult{},
	)
	if err != nil {
		return nil, err
	}

	return db, nil
}

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateUpstream(upstream *model.UpstreamService) error {
	upstream.ID = uuid.NewString()
	upstream.CreatedAt = time.Now()
	upstream.UpdatedAt = time.Now()
	return r.db.Create(upstream).Error
}

func (r *Repository) GetUpstreamByID(id string) (*model.UpstreamService, error) {
	var upstream model.UpstreamService
	err := r.db.First(&upstream, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &upstream, nil
}

func (r *Repository) ListUpstreams() ([]model.UpstreamService, error) {
	var upstreams []model.UpstreamService
	err := r.db.Find(&upstreams).Error
	return upstreams, err
}

func (r *Repository) CreateRouteRule(rule *model.RouteRule) error {
	rule.ID = uuid.NewString()
	rule.CreatedAt = time.Now()
	rule.UpdatedAt = time.Now()
	for i := range rule.Conditions {
		rule.Conditions[i].ID = uuid.NewString()
		rule.Conditions[i].RuleID = rule.ID
		rule.Conditions[i].CreatedAt = time.Now()
	}
	return r.db.Create(rule).Error
}

func (r *Repository) GetRouteRuleByID(id string) (*model.RouteRule, error) {
	var rule model.RouteRule
	err := r.db.Preload("Conditions").Preload("Upstream").First(&rule, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

func (r *Repository) ListRouteRules() ([]model.RouteRule, error) {
	var rules []model.RouteRule
	err := r.db.Preload("Conditions").Preload("Upstream").Order("priority DESC").Find(&rules).Error
	return rules, err
}

func (r *Repository) GetRouteRulesByIDs(ids []string) ([]model.RouteRule, error) {
	var rules []model.RouteRule
	err := r.db.Preload("Conditions").Preload("Upstream").Where("id IN ?", ids).Order("priority DESC").Find(&rules).Error
	return rules, err
}

func (r *Repository) CreateRequestSample(sample *model.RequestSample) error {
	sample.ID = uuid.NewString()
	sample.CreatedAt = time.Now()
	return r.db.Create(sample).Error
}

func (r *Repository) GetRequestSampleByID(id string) (*model.RequestSample, error) {
	var sample model.RequestSample
	err := r.db.First(&sample, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &sample, nil
}

func (r *Repository) ListRequestSamples() ([]model.RequestSample, error) {
	var samples []model.RequestSample
	err := r.db.Find(&samples).Error
	return samples, err
}

func (r *Repository) CreateConflictRule(conflict *model.ConflictRule) error {
	conflict.ID = uuid.NewString()
	conflict.DetectedAt = time.Now()
	return r.db.Create(conflict).Error
}

func (r *Repository) GetConflictsByRuleIDs(ruleID1, ruleID2 string) ([]model.ConflictRule, error) {
	var conflicts []model.ConflictRule
	err := r.db.Where("(rule_id_1 = ? AND rule_id_2 = ?) OR (rule_id_1 = ? AND rule_id_2 = ?)",
		ruleID1, ruleID2, ruleID2, ruleID1).Find(&conflicts).Error
	return conflicts, err
}

func (r *Repository) CreateTrialRequest(request *model.TrialRequest) error {
	request.ID = uuid.NewString()
	request.CreatedAt = time.Now()
	return r.db.Create(request).Error
}

func (r *Repository) GetTrialRequestByIdempotencyKey(key string) (*model.TrialRequest, error) {
	var request model.TrialRequest
	err := r.db.Where("idempotency_key = ?", key).First(&request).Error
	if err != nil {
		return nil, err
	}
	return &request, nil
}

func (r *Repository) UpdateTrialRequestStatus(id string, status model.TrialStatus) error {
	return r.db.Model(&model.TrialRequest{}).Where("id = ?", id).Update("status", status).Error
}

func (r *Repository) CreateTrialResult(result *model.TrialResult) error {
	result.ID = uuid.NewString()
	result.CreatedAt = time.Now()
	return r.db.Create(result).Error
}

func (r *Repository) UpdateTrialResult(result *model.TrialResult) error {
	return r.db.Save(result).Error
}

func (r *Repository) GetTrialResultByID(id string) (*model.TrialResult, error) {
	var result model.TrialResult
	err := r.db.Preload("RequestSample").Preload("MatchedRule").Preload("MatchedRule.Conditions").Preload("Conflicts").First(&result, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func (r *Repository) GetTrialResultByTrialRequestID(trialRequestID string) (*model.TrialResult, error) {
	var result model.TrialResult
	err := r.db.Preload("RequestSample").Preload("MatchedRule").Preload("MatchedRule.Conditions").Preload("Conflicts").Where("trial_request_id = ?", trialRequestID).First(&result).Error
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func (r *Repository) QueryTrialHistory(query *model.TrialHistoryQuery) ([]model.TrialResult, int64, error) {
	db := r.db.Model(&model.TrialResult{})

	if query.Status != nil {
		db = db.Where("status = ?", *query.Status)
	}
	if query.StartTime != nil {
		db = db.Where("created_at >= ?", *query.StartTime)
	}
	if query.EndTime != nil {
		db = db.Where("created_at <= ?", *query.EndTime)
	}

	var total int64
	db.Count(&total)

	var results []model.TrialResult
	offset := (query.Page - 1) * query.PageSize
	err := db.Preload("RequestSample").Preload("MatchedRule").Preload("Conflicts").
		Order("created_at DESC").
		Limit(query.PageSize).
		Offset(offset).
		Find(&results).Error

	return results, total, err
}

func (r *Repository) GetTrialResultsByIDs(ids []string) ([]model.TrialResult, error) {
	var results []model.TrialResult
	err := r.db.Preload("RequestSample").Preload("MatchedRule").Preload("MatchedRule.Conditions").Preload("Conflicts").
		Where("id IN ?", ids).Find(&results).Error
	return results, err
}
