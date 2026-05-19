package service

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"time"

	"quality-control-system/internal/config"
	"quality-control-system/internal/model"
	"quality-control-system/internal/repository"
)

type SampleService struct {
	sampleRepo *repository.SampleRepository
	ruleRepo   *repository.RuleRepository
	cfg        *config.RulesConfig
}

func NewSampleService(cfg *config.RulesConfig) *SampleService {
	return &SampleService{
		sampleRepo: repository.NewSampleRepository(),
		ruleRepo:   repository.NewRuleRepository(),
		cfg:        cfg,
	}
}

func (s *SampleService) CreateSample(sample *model.FoodSample, idempotentKey string) (*model.FoodSample, error) {
	if idempotentKey == "" {
		idempotentKey = s.generateIdempotentKey(sample)
	}

	existing, err := s.sampleRepo.GetByIdempotentKey(idempotentKey)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, nil
	}

	sample.SampleNo = s.generateSampleNo(sample.StoreID)
	sample.IdempotentKey = idempotentKey
	sample.Status = "normal"
	sample.ExpireTime = sample.SampleTime.Add(time.Duration(s.cfg.SampleRetentionHours) * time.Hour)

	err = s.sampleRepo.Create(sample)
	if err != nil {
		return nil, err
	}

	go s.createExpireReminder(sample)

	return sample, nil
}

func (s *SampleService) GetSample(sampleNo string) (*model.FoodSample, error) {
	return s.sampleRepo.GetByNo(sampleNo)
}

func (s *SampleService) ListSamples(storeID string, page, pageSize int) ([]*model.FoodSample, int, error) {
	return s.sampleRepo.ListByStore(storeID, page, pageSize)
}

func (s *SampleService) DestroySample(sampleNo, operator, reason string) error {
	sample, err := s.sampleRepo.GetByNo(sampleNo)
	if err != nil {
		return err
	}
	if sample.IsDestroyed == 1 {
		return fmt.Errorf("sample already destroyed")
	}

	err = s.sampleRepo.Destroy(sampleNo, operator, reason)
	if err != nil {
		return err
	}

	log := &model.RuleExecutionLog{
		RuleName:     "ManualDestroy",
		RecordType:   "sample",
		RecordRefNo:  sampleNo,
		StoreID:      sample.StoreID,
		ActionTaken:  "destroyed",
		Reason:       reason,
		Operator:     operator,
	}
	return s.ruleRepo.LogExecution(log)
}

func (s *SampleService) CheckAndIsolateExpiredSamples() (int, error) {
	now := time.Now()
	samples, err := s.sampleRepo.GetExpiredSamples(now)
	if err != nil {
		return 0, err
	}

	count := 0
	for _, sample := range samples {
		err := s.sampleRepo.UpdateStatus(sample.SampleNo, "isolated")
		if err != nil {
			continue
		}

		log := &model.RuleExecutionLog{
			RuleName:     "SampleRetentionRule",
			RecordType:   "sample",
			RecordRefNo:  sample.SampleNo,
			StoreID:      sample.StoreID,
			ActionTaken:  "isolated",
			Reason:       fmt.Sprintf("留样已过期，留样时间:%s，保留期:%d小时",
				sample.SampleTime.Format("2006-01-02 15:04:05"),
				s.cfg.SampleRetentionHours),
		}
		s.ruleRepo.LogExecution(log)
		count++
	}

	return count, nil
}

func (s *SampleService) GetSamplesByBatch(dishBatch string) ([]*model.FoodSample, error) {
	return s.sampleRepo.GetByBatch(dishBatch)
}

func (s *SampleService) GetRuleExecutionLogs(recordType, recordRefNo string) ([]*model.RuleExecutionLog, error) {
	return s.ruleRepo.GetLogsByRecord(recordType, recordRefNo)
}

func (s *SampleService) generateSampleNo(storeID string) string {
	now := time.Now()
	return fmt.Sprintf("SMP%s%s%06d",
		storeID,
		now.Format("20060102"),
		now.Unix()%1000000,
	)
}

func (s *SampleService) generateIdempotentKey(sample *model.FoodSample) string {
	data := fmt.Sprintf("%s|%s|%s",
		sample.StoreID,
		sample.DishBatch,
		sample.SampleTime.Format("20060102150405"),
	)
	hash := md5.Sum([]byte(data))
	return hex.EncodeToString(hash[:])
}

func (s *SampleService) createExpireReminder(sample *model.FoodSample) {
	remindTime := sample.ExpireTime.Add(-1 * time.Hour)
	reminder := &model.Reminder{
		ReminderNo:   fmt.Sprintf("REM%s%d", sample.SampleNo, time.Now().Unix()),
		StoreID:      sample.StoreID,
		ReminderType: "sample_expire",
		RelatedRefNo: sample.SampleNo,
		Message:      fmt.Sprintf("菜品留样[%s]即将过期，请及时处理", sample.DishName),
		RemindTime:   remindTime,
	}
	s.ruleRepo.CreateReminder(reminder)
}
