package service

import (
	"encoding/csv"
	"encoding/json"
	"io"
	"strconv"
	"time"

	"lab-reagent-api/internal/database"
	"lab-reagent-api/internal/model"
)

type ReportService struct {
	reagentRepo  *database.ReagentRepo
	usageRepo    *database.UsageRepo
	orderRepo    *database.OrderRepo
	judgmentRepo *database.JudgmentRepo
}

func NewReportService(reagentRepo *database.ReagentRepo, usageRepo *database.UsageRepo, orderRepo *database.OrderRepo, judgmentRepo *database.JudgmentRepo) *ReportService {
	return &ReportService{
		reagentRepo:  reagentRepo,
		usageRepo:    usageRepo,
		orderRepo:    orderRepo,
		judgmentRepo: judgmentRepo,
	}
}

type ReagentReport struct {
	Reagent      model.Reagent       `json:"reagent"`
	UsageRecords []model.UsageRecord `json:"usage_records"`
	Projects     []string            `json:"shared_projects"`
}

type FullReport struct {
	GeneratedAt time.Time         `json:"generated_at"`
	Reagents    []ReagentReport   `json:"reagents"`
	Orders      []model.ProcessingOrder `json:"processing_orders"`
	Summary     ReportSummary     `json:"summary"`
}

type ReportSummary struct {
	TotalReagents     int `json:"total_reagents"`
	FrozenCount       int `json:"frozen_count"`
	ThawedCount       int `json:"thawed_count"`
	InUseCount        int `json:"in_use_count"`
	ExpiredCount      int `json:"expired_count"`
	DiscardedCount    int `json:"discarded_count"`
	TotalUsageRecords int `json:"total_usage_records"`
	TotalOrders       int `json:"total_orders"`
}

func (s *ReportService) GenerateFullReport() (*FullReport, *model.APIError) {
	reagents, err := s.reagentRepo.ListAll()
	if err != nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "查询试剂失败",
			Details: err.Error(),
		}
	}

	usageRecords, err := s.usageRepo.ListAll()
	if err != nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "查询领用记录失败",
			Details: err.Error(),
		}
	}

	orders, err := s.orderRepo.ListAll()
	if err != nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "查询处理单失败",
			Details: err.Error(),
		}
	}

	for i := range orders {
		if history, err := s.judgmentRepo.GetByOrderID(orders[i].ID); err == nil {
			orders[i].JudgmentHistory = history
		}
	}

	usageMap := make(map[string][]model.UsageRecord)
	projectMap := make(map[string]map[string]bool)
	for _, u := range usageRecords {
		usageMap[u.BatchNo] = append(usageMap[u.BatchNo], u)
		if _, ok := projectMap[u.BatchNo]; !ok {
			projectMap[u.BatchNo] = make(map[string]bool)
		}
		projectMap[u.BatchNo][u.Project] = true
	}

	reagentReports := make([]ReagentReport, 0, len(reagents))
	summary := ReportSummary{
		TotalReagents:     len(reagents),
		TotalUsageRecords: len(usageRecords),
		TotalOrders:       len(orders),
	}

	for _, r := range reagents {
		report := ReagentReport{
			Reagent:      r,
			UsageRecords: usageMap[r.BatchNo],
			Projects:     make([]string, 0),
		}
		for p := range projectMap[r.BatchNo] {
			report.Projects = append(report.Projects, p)
		}
		reagentReports = append(reagentReports, report)

		switch r.Status {
		case model.StatusFrozen:
			summary.FrozenCount++
		case model.StatusThawed:
			summary.ThawedCount++
		case model.StatusInUse:
			summary.InUseCount++
		case model.StatusExpired:
			summary.ExpiredCount++
		case model.StatusDiscarded:
			summary.DiscardedCount++
		}
	}

	return &FullReport{
		GeneratedAt: time.Now(),
		Reagents:    reagentReports,
		Orders:      orders,
		Summary:     summary,
	}, nil
}

func (s *ReportService) ExportJSON(w io.Writer) *model.APIError {
	report, apiErr := s.GenerateFullReport()
	if apiErr != nil {
		return apiErr
	}

	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(report); err != nil {
		return &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "导出JSON失败",
			Details: err.Error(),
		}
	}
	return nil
}

func (s *ReportService) ExportCSV(w io.Writer) *model.APIError {
	report, apiErr := s.GenerateFullReport()
	if apiErr != nil {
		return apiErr
	}

	cw := csv.NewWriter(w)
	defer cw.Flush()

	if err := cw.Write([]string{"=== 试剂状态汇总 ==="}); err != nil {
		return csvError(err)
	}
	summaryHeaders := []string{"总数", "冷冻", "已解冻", "使用中", "已过期", "已废弃", "领用记录数", "处理单数"}
	if err := cw.Write(summaryHeaders); err != nil {
		return csvError(err)
	}
	summaryRow := []string{
		strconv.Itoa(report.Summary.TotalReagents),
		strconv.Itoa(report.Summary.FrozenCount),
		strconv.Itoa(report.Summary.ThawedCount),
		strconv.Itoa(report.Summary.InUseCount),
		strconv.Itoa(report.Summary.ExpiredCount),
		strconv.Itoa(report.Summary.DiscardedCount),
		strconv.Itoa(report.Summary.TotalUsageRecords),
		strconv.Itoa(report.Summary.TotalOrders),
	}
	if err := cw.Write(summaryRow); err != nil {
		return csvError(err)
	}

	if err := cw.Write([]string{""}); err != nil {
		return csvError(err)
	}

	if err := cw.Write([]string{"=== 试剂详情 ==="}); err != nil {
		return csvError(err)
	}
	reagentHeaders := []string{"批号", "类型", "状态", "解冻时间", "解冻人", "项目", "过期时间", "废弃时间", "废弃原因"}
	if err := cw.Write(reagentHeaders); err != nil {
		return csvError(err)
	}

	for _, rr := range report.Reagents {
		r := rr.Reagent
		row := []string{
			r.BatchNo,
			r.ReagentType,
			string(r.Status),
			formatTime(r.ThawedAt),
			r.ThawedBy,
			r.Project,
			formatTime(r.ExpireAt),
			formatTime(r.DiscardedAt),
			r.DiscardReason,
		}
		if err := cw.Write(row); err != nil {
			return csvError(err)
		}
	}

	if err := cw.Write([]string{""}); err != nil {
		return csvError(err)
	}

	if err := cw.Write([]string{"=== 领用记录 ==="}); err != nil {
		return csvError(err)
	}
	usageHeaders := []string{"批号", "领用人", "项目", "用量", "备注", "领用时间"}
	if err := cw.Write(usageHeaders); err != nil {
		return csvError(err)
	}

	for _, rr := range report.Reagents {
		for _, u := range rr.UsageRecords {
			row := []string{
				u.BatchNo,
				u.UsedBy,
				u.Project,
				u.Volume,
				u.Notes,
				u.UsedAt.Format(time.RFC3339),
			}
			if err := cw.Write(row); err != nil {
				return csvError(err)
			}
		}
	}

	return nil
}

func formatTime(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format(time.RFC3339)
}

func csvError(err error) *model.APIError {
	return &model.APIError{
		Code:    model.ErrCodeMissingMaterial,
		Message: "导出CSV失败",
		Details: err.Error(),
	}
}
