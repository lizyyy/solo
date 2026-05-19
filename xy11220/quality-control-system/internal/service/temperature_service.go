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

type TemperatureService struct {
	tempRepo *repository.TemperatureRepository
	ruleRepo *repository.RuleRepository
	cfg      *config.RulesConfig
}

func NewTemperatureService(cfg *config.RulesConfig) *TemperatureService {
	return &TemperatureService{
		tempRepo: repository.NewTemperatureRepository(),
		ruleRepo: repository.NewRuleRepository(),
		cfg:      cfg,
	}
}

func (s *TemperatureService) CreateRecord(record *model.TemperatureRecord, idempotentKey string) (*model.TemperatureRecord, error) {
	if idempotentKey == "" {
		idempotentKey = s.generateIdempotentKey(record)
	}

	existing, err := s.tempRepo.GetByIdempotentKey(idempotentKey)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, nil
	}

	record.RecordNo = s.generateRecordNo(record.StoreID)
	record.IdempotentKey = idempotentKey

	record.IsNormal = 1
	if record.Temperature < s.cfg.MinTemperature || record.Temperature > s.cfg.MaxTemperature {
		record.IsNormal = 0
		record.AnomalyReason = fmt.Sprintf("温度异常，范围[%.1f-%.1f]℃，实际%.2f℃",
			s.cfg.MinTemperature, s.cfg.MaxTemperature, record.Temperature)
	}

	err = s.tempRepo.Create(record)
	if err != nil {
		return nil, err
	}

	if record.IsNormal == 0 {
		go s.createAnomalyReminder(record)
	}

	return record, nil
}

func (s *TemperatureService) GetRecord(recordNo string) (*model.TemperatureRecord, error) {
	return s.tempRepo.GetByNo(recordNo)
}

func (s *TemperatureService) ListRecords(storeID string, page, pageSize int) ([]*model.TemperatureRecord, int, error) {
	return s.tempRepo.ListByStore(storeID, page, pageSize)
}

func (s *TemperatureService) CheckTemperatureGap(storeID string, fridgeID string, startTime, endTime time.Time) ([]*model.RuleResult, error) {
	records, err := s.tempRepo.GetByTimeRange(storeID, startTime, endTime)
	if err != nil {
		return nil, err
	}

	var results []*model.RuleResult
	interval := time.Duration(s.cfg.TemperatureCheckIntervalMinutes) * time.Minute

	lastCheckTime := startTime
	for _, record := range records {
		if record.FridgeID != fridgeID {
			continue
		}

		gap := record.CheckTime.Sub(lastCheckTime)
		if gap > interval+5*time.Minute {
			result := &model.RuleResult{
				Passed:     false,
				RuleName:   "TemperatureIntervalRule",
				Action:     "alert",
				Reason:     fmt.Sprintf("温度检测间隔超标，应每%d分钟检测一次，实际间隔%.0f分钟",
					s.cfg.TemperatureCheckIntervalMinutes, gap.Minutes()),
				Details:    fmt.Sprintf("上次检测:%s，本次:%s",
					lastCheckTime.Format("2006-01-02 15:04:05"),
					record.CheckTime.Format("2006-01-02 15:04:05")),
			}
			results = append(results, result)

			log := &model.RuleExecutionLog{
				RuleName:    "TemperatureIntervalRule",
				RecordType:  "temperature",
				RecordRefNo: record.RecordNo,
				StoreID:     storeID,
				ActionTaken: "alert",
				Reason:      result.Reason,
				Details:     result.Details,
			}
			s.ruleRepo.LogExecution(log)
		}

		if record.Temperature < s.cfg.MinTemperature || record.Temperature > s.cfg.MaxTemperature {
			result := &model.RuleResult{
				Passed:     false,
				RuleName:   "TemperatureRangeRule",
				Action:     "flagged",
				Reason:     fmt.Sprintf("温度超出正常范围[%.1f-%.1f]℃",
					s.cfg.MinTemperature, s.cfg.MaxTemperature),
				Details:    fmt.Sprintf("检测时间:%s，温度:%.2f℃",
					record.CheckTime.Format("2006-01-02 15:04:05"),
					record.Temperature),
			}
			results = append(results, result)
		}

		lastCheckTime = record.CheckTime
	}

	return results, nil
}

func (s *TemperatureService) GetRecordsByTimeRange(storeID string, startTime, endTime time.Time) ([]*model.TemperatureRecord, error) {
	return s.tempRepo.GetByTimeRange(storeID, startTime, endTime)
}

func (s *TemperatureService) generateRecordNo(storeID string) string {
	now := time.Now()
	return fmt.Sprintf("TMP%s%s%06d",
		storeID,
		now.Format("20060102"),
		now.Unix()%1000000,
	)
}

func (s *TemperatureService) generateIdempotentKey(record *model.TemperatureRecord) string {
	data := fmt.Sprintf("%s|%s|%s",
		record.StoreID,
		record.FridgeID,
		record.CheckTime.Format("20060102150405"),
	)
	hash := md5.Sum([]byte(data))
	return hex.EncodeToString(hash[:])
}

func (s *TemperatureService) createAnomalyReminder(record *model.TemperatureRecord) {
	reminder := &model.Reminder{
		ReminderNo:   fmt.Sprintf("REM%s%d", record.RecordNo, time.Now().Unix()),
		StoreID:      record.StoreID,
		ReminderType: "temperature_anomaly",
		RelatedRefNo: record.RecordNo,
		Message:      fmt.Sprintf("冰箱[%s]温度异常: %.2f℃，请及时处理", record.FridgeName, record.Temperature),
		RemindTime:   time.Now(),
	}
	s.ruleRepo.CreateReminder(reminder)
}
