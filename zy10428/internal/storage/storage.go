package storage

import (
	"encoding/json"
	"shadow-test-api/internal/model"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type Storage struct {
	db *gorm.DB
}

func NewStorage(dbPath string) (*Storage, error) {
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	err = db.AutoMigrate(
		&model.ProxyRule{},
		&model.SampleRequest{},
		&model.ShadowBatch{},
		&model.HitResult{},
		&model.DiffReason{},
		&model.TestReport{},
	)
	if err != nil {
		return nil, err
	}

	return &Storage{db: db}, nil
}

func (s *Storage) GetDB() *gorm.DB {
	return s.db
}

func (s *Storage) CreateRule(rule *model.ProxyRule) error {
	if rule.ID == "" {
		rule.ID = uuid.NewString()
	}
	rule.CreatedAt = time.Now()
	rule.UpdatedAt = time.Now()
	return s.db.Create(rule).Error
}

func (s *Storage) GetRule(id string) (*model.ProxyRule, error) {
	var rule model.ProxyRule
	err := s.db.Where("id = ?", id).First(&rule).Error
	return &rule, err
}

func (s *Storage) ListRules(page, pageSize int) ([]model.ProxyRule, int64, error) {
	var rules []model.ProxyRule
	var total int64

	offset := (page - 1) * pageSize
	err := s.db.Model(&model.ProxyRule{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = s.db.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&rules).Error
	return rules, total, err
}

func (s *Storage) GetRulesByIDs(ids []string) ([]model.ProxyRule, error) {
	var rules []model.ProxyRule
	err := s.db.Where("id IN ?", ids).Find(&rules).Error
	return rules, err
}

func (s *Storage) CreateSampleRequest(req *model.SampleRequest) error {
	if req.ID == "" {
		req.ID = uuid.NewString()
	}
	req.CreatedAt = time.Now()
	return s.db.Create(req).Error
}

func (s *Storage) GetSampleRequest(id string) (*model.SampleRequest, error) {
	var req model.SampleRequest
	err := s.db.Where("id = ?", id).First(&req).Error
	return &req, err
}

func (s *Storage) ListSampleRequests(page, pageSize int) ([]model.SampleRequest, int64, error) {
	var reqs []model.SampleRequest
	var total int64

	offset := (page - 1) * pageSize
	err := s.db.Model(&model.SampleRequest{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = s.db.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&reqs).Error
	return reqs, total, err
}

func (s *Storage) GetAllSampleRequests() ([]model.SampleRequest, error) {
	var reqs []model.SampleRequest
	err := s.db.Find(&reqs).Error
	return reqs, err
}

func (s *Storage) CreateBatch(batch *model.ShadowBatch) error {
	if batch.ID == "" {
		batch.ID = uuid.NewString()
	}
	batch.Status = "pending"
	batch.CreatedAt = time.Now()
	return s.db.Create(batch).Error
}

func (s *Storage) GetBatch(id string) (*model.ShadowBatch, error) {
	var batch model.ShadowBatch
	err := s.db.Where("id = ?", id).First(&batch).Error
	return &batch, err
}

func (s *Storage) ListBatches(page, pageSize int) ([]model.ShadowBatch, int64, error) {
	var batches []model.ShadowBatch
	var total int64

	offset := (page - 1) * pageSize
	err := s.db.Model(&model.ShadowBatch{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = s.db.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&batches).Error
	return batches, total, err
}

func (s *Storage) UpdateBatch(batch *model.ShadowBatch) error {
	batch.UpdatedAt = time.Now()
	return s.db.Save(batch).Error
}

func (s *Storage) CreateHitResult(result *model.HitResult) error {
	if result.ID == "" {
		result.ID = uuid.NewString()
	}
	result.CreatedAt = time.Now()
	result.UpdatedAt = time.Now()
	return s.db.Create(result).Error
}

func (s *Storage) GetHitResult(id string) (*model.HitResult, error) {
	var result model.HitResult
	err := s.db.Where("id = ?", id).First(&result).Error
	return &result, err
}

func (s *Storage) ListHitResultsByBatch(batchID string, page, pageSize int) ([]model.HitResult, int64, error) {
	var results []model.HitResult
	var total int64

	offset := (page - 1) * pageSize
	err := s.db.Model(&model.HitResult{}).Where("batch_id = ?", batchID).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = s.db.Where("batch_id = ?", batchID).Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&results).Error
	return results, total, err
}

func (s *Storage) UpdateHitResult(result *model.HitResult) error {
	result.UpdatedAt = time.Now()
	return s.db.Save(result).Error
}

func (s *Storage) CreateDiffReason(diff *model.DiffReason) error {
	if diff.ID == "" {
		diff.ID = uuid.NewString()
	}
	diff.CreatedAt = time.Now()
	return s.db.Create(diff).Error
}

func (s *Storage) CreateReport(report *model.TestReport) error {
	if report.ID == "" {
		report.ID = uuid.NewString()
	}
	report.CreatedAt = time.Now()
	return s.db.Create(report).Error
}

func (s *Storage) GetReport(id string) (*model.TestReport, error) {
	var report model.TestReport
	err := s.db.Where("id = ?", id).First(&report).Error
	return &report, err
}

func (s *Storage) ListReports(page, pageSize int) ([]model.TestReport, int64, error) {
	var reports []model.TestReport
	var total int64

	offset := (page - 1) * pageSize
	err := s.db.Model(&model.TestReport{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = s.db.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&reports).Error
	return reports, total, err
}

func ToJSON(v interface{}) model.JSON {
	data, _ := json.Marshal(v)
	return model.JSON(data)
}

func FromJSON(j model.JSON, v interface{}) error {
	return json.Unmarshal([]byte(j), v)
}
