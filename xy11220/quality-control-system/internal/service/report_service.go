package service

import (
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"quality-control-system/internal/config"
	"quality-control-system/internal/model"
	"quality-control-system/internal/repository"
)

type ReportService struct {
	sampleRepo *repository.SampleRepository
	tempRepo   *repository.TemperatureRepository
	wasteRepo  *repository.WasteRepository
	ruleRepo   *repository.RuleRepository
	cfg        *config.ExportConfig
}

func NewReportService(cfg *config.ExportConfig) *ReportService {
	return &ReportService{
		sampleRepo: repository.NewSampleRepository(),
		tempRepo:   repository.NewTemperatureRepository(),
		wasteRepo:  repository.NewWasteRepository(),
		ruleRepo:   repository.NewRuleRepository(),
		cfg:        cfg,
	}
}

type BatchSummary struct {
	DishBatch    string            `json:"dish_batch"`
	Stores       []string          `json:"stores"`
	SampleCount  int               `json:"sample_count"`
	WasteCount   int               `json:"waste_count"`
	TotalWeight  float64           `json:"total_weight"`
	RuleResults  []*model.RuleResult `json:"rule_results"`
}

func (s *ReportService) GetBatchSummary(dishBatch string) (*BatchSummary, error) {
	samples, err := s.sampleRepo.GetByBatch(dishBatch)
	if err != nil {
		return nil, err
	}

	wastes, err := s.wasteRepo.GetByBatch(dishBatch)
	if err != nil {
		return nil, err
	}

	storeMap := make(map[string]bool)
	for _, sample := range samples {
		storeMap[sample.StoreID] = true
	}
	for _, waste := range wastes {
		storeMap[waste.StoreID] = true
	}

	stores := make([]string, 0, len(storeMap))
	for store := range storeMap {
		stores = append(stores, store)
	}

	totalWeight := 0.0
	for _, waste := range wastes {
		totalWeight += waste.WasteWeight
	}

	var ruleResults []*model.RuleResult
	for _, sample := range samples {
		if sample.Status == "isolated" {
			logs, _ := s.ruleRepo.GetLogsByRecord("sample", sample.SampleNo)
			for _, log := range logs {
				ruleResults = append(ruleResults, &model.RuleResult{
					Passed:    false,
					RuleName:  log.RuleName,
					Action:    log.ActionTaken,
					Reason:    log.Reason,
					Details:   fmt.Sprintf("门店:%s,留样:%s", sample.StoreID, sample.SampleNo),
				})
			}
		}
	}

	return &BatchSummary{
		DishBatch:   dishBatch,
		Stores:      stores,
		SampleCount: len(samples),
		WasteCount:  len(wastes),
		TotalWeight: totalWeight,
		RuleResults: ruleResults,
	}, nil
}

type DailyReport struct {
	Date         string              `json:"date"`
	StoreID      string              `json:"store_id"`
	SampleStats  SampleStats         `json:"sample_stats"`
	TempStats    TemperatureStats    `json:"temp_stats"`
	WasteStats   WasteStats          `json:"waste_stats"`
	Alerts       []*model.RuleResult `json:"alerts"`
}

type SampleStats struct {
	Total       int `json:"total"`
	Normal      int `json:"normal"`
	Isolated    int `json:"isolated"`
	Destroyed   int `json:"destroyed"`
}

type TemperatureStats struct {
	Total       int `json:"total"`
	Normal      int `json:"normal"`
	Anomalies   int `json:"anomalies"`
}

type WasteStats struct {
	Total       int     `json:"total"`
	TotalWeight float64 `json:"total_weight"`
}

func (s *ReportService) GetDailyReport(storeID string, date time.Time) (*DailyReport, error) {
	startTime := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	endTime := startTime.Add(24 * time.Hour)

	samples, err := s.sampleRepo.ListByStore(storeID, 1, 1000)
	if err != nil {
		return nil, err
	}

	tempRecords, err := s.tempRepo.GetByTimeRange(storeID, startTime, endTime)
	if err != nil {
		return nil, err
	}

	wastes, err := s.wasteRepo.ListByStore(storeID, 1, 1000)
	if err != nil {
		return nil, err
	}

	sampleStats := SampleStats{}
	for _, sample := range samples[0] {
		if sample.SampleTime.After(startTime) && sample.SampleTime.Before(endTime) {
			sampleStats.Total++
			switch sample.Status {
			case "normal":
				sampleStats.Normal++
			case "isolated":
				sampleStats.Isolated++
			case "destroyed":
				sampleStats.Destroyed++
			}
		}
	}

	tempStats := TemperatureStats{Total: len(tempRecords)}
	for _, record := range tempRecords {
		if record.IsNormal == 1 {
			tempStats.Normal++
		} else {
			tempStats.Anomalies++
		}
	}

	wasteStats := WasteStats{}
	for _, waste := range wastes[0] {
		if waste.WasteTime.After(startTime) && waste.WasteTime.Before(endTime) {
			wasteStats.Total++
			wasteStats.TotalWeight += waste.WasteWeight
		}
	}

	var alerts []*model.RuleResult
	for _, record := range tempRecords {
		if record.IsNormal == 0 {
			alerts = append(alerts, &model.RuleResult{
				Passed:   false,
				RuleName: "TemperatureRangeRule",
				Action:   "flagged",
				Reason:   record.AnomalyReason,
				Details:  fmt.Sprintf("冰箱:%s,时间:%s", record.FridgeID, record.CheckTime.Format("15:04:05")),
			})
		}
	}

	return &DailyReport{
		Date:        date.Format("2006-01-02"),
		StoreID:     storeID,
		SampleStats: sampleStats,
		TempStats:   tempStats,
		WasteStats:  wasteStats,
		Alerts:      alerts,
	}, nil
}

func (s *ReportService) ExportDailyReportCSV(storeID string, date time.Time) (string, error) {
	report, err := s.GetDailyReport(storeID, date)
	if err != nil {
		return "", err
	}

	if err := os.MkdirAll(s.cfg.OutputDir, 0755); err != nil {
		return "", err
	}

	filename := fmt.Sprintf("daily_report_%s_%s.csv", storeID, date.Format("20060102"))
	filepath := filepath.Join(s.cfg.OutputDir, filename)

	file, err := os.Create(filepath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	writer.Write([]string{"门店品控日报", report.Date, "门店:" + storeID})
	writer.Write([]string{})

	writer.Write([]string{"留样统计"})
	writer.Write([]string{"总数", "正常", "隔离", "已销毁"})
	writer.Write([]string{
		fmt.Sprintf("%d", report.SampleStats.Total),
		fmt.Sprintf("%d", report.SampleStats.Normal),
		fmt.Sprintf("%d", report.SampleStats.Isolated),
		fmt.Sprintf("%d", report.SampleStats.Destroyed),
	})
	writer.Write([]string{})

	writer.Write([]string{"温度统计"})
	writer.Write([]string{"检测次数", "正常", "异常"})
	writer.Write([]string{
		fmt.Sprintf("%d", report.TempStats.Total),
		fmt.Sprintf("%d", report.TempStats.Normal),
		fmt.Sprintf("%d", report.TempStats.Anomalies),
	})
	writer.Write([]string{})

	writer.Write([]string{"废弃统计"})
	writer.Write([]string{"记录数", "总重量(kg)"})
	writer.Write([]string{
		fmt.Sprintf("%d", report.WasteStats.Total),
		fmt.Sprintf("%.2f", report.WasteStats.TotalWeight),
	})
	writer.Write([]string{})

	if len(report.Alerts) > 0 {
		writer.Write([]string{"异常提醒"})
		writer.Write([]string{"规则名称", "动作", "原因", "详情"})
		for _, alert := range report.Alerts {
			writer.Write([]string{alert.RuleName, alert.Action, alert.Reason, alert.Details})
		}
	}

	return filepath, nil
}

func (s *ReportService) GetPendingReminders(storeID string) ([]*model.Reminder, error) {
	return s.ruleRepo.GetPendingReminders(storeID)
}

func (s *ReportService) AcknowledgeReminder(reminderNo, operator string) error {
	return s.ruleRepo.AcknowledgeReminder(reminderNo, operator)
}
