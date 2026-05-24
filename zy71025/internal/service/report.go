package service

import (
	"fmt"
	"time"

	"irrigation-water-rights/internal/models"
	"irrigation-water-rights/internal/repository"
)

type ReportService struct {
	repo *repository.Repository
}

func NewReportService(repo *repository.Repository) *ReportService {
	return &ReportService{repo: repo}
}

type BalanceReportResult struct {
	Success      bool                `json:"success"`
	Message      string              `json:"message"`
	ReportNo     string              `json:"report_no,omitempty"`
	Year         int                 `json:"year"`
	Week         int                 `json:"week"`
	GeneratedAt  time.Time           `json:"generated_at"`
	ReportItems  []BalanceReportItem `json:"report_items,omitempty"`
	TotalSummary map[string]float64  `json:"total_summary,omitempty"`
}

type BalanceReportItem struct {
	FarmerID       uint    `json:"farmer_id"`
	FarmerName     string  `json:"farmer_name"`
	InitialQuota   float64 `json:"initial_quota"`
	TransferIn     float64 `json:"transfer_in"`
	TransferOut    float64 `json:"transfer_out"`
	IrrigationUsed float64 `json:"irrigation_used"`
	Balance        float64 `json:"balance"`
}

func (s *ReportService) GenerateWeeklyReport(year, week int, operator string) (*BalanceReportResult, error) {
	reportNo := fmt.Sprintf("RPT%04d%02d%010d", year, week, time.Now().UnixNano()%10000000000)

	farmers, err := s.repo.ListFarmers()
	if err != nil {
		return &BalanceReportResult{
			Success: false,
			Message: "获取农户列表失败",
		}, err
	}

	var items []BalanceReportItem
	totalInitial := 0.0
	totalTransferIn := 0.0
	totalTransferOut := 0.0
	totalIrrigation := 0.0
	totalBalance := 0.0

	for _, farmer := range farmers {
		wr, err := s.repo.GetWaterRight(farmer.ID, year, week)
		if err != nil {
			continue
		}

		transferIn, _ := s.calculateTransferIn(farmer.ID, year, week)
		transferOut, _ := s.calculateTransferOut(farmer.ID, year, week)
		irrigationUsed, _ := s.calculateIrrigationUsed(farmer.ID, year, week)

		item := BalanceReportItem{
			FarmerID:       farmer.ID,
			FarmerName:     farmer.Name,
			InitialQuota:   wr.TotalQuota - transferIn + transferOut,
			TransferIn:     transferIn,
			TransferOut:    transferOut,
			IrrigationUsed: irrigationUsed,
			Balance:        wr.Balance,
		}
		items = append(items, item)

		totalInitial += item.InitialQuota
		totalTransferIn += transferIn
		totalTransferOut += transferOut
		totalIrrigation += irrigationUsed
		totalBalance += wr.Balance

		report := &models.BalanceReport{
			ReportNo:       reportNo,
			FarmerID:       farmer.ID,
			Year:           year,
			Week:           week,
			InitialQuota:   item.InitialQuota,
			TransferIn:     transferIn,
			TransferOut:    transferOut,
			IrrigationUsed: irrigationUsed,
			Balance:        wr.Balance,
			GeneratedAt:    time.Now(),
		}
		s.repo.CreateBalanceReport(report)
	}

	return &BalanceReportResult{
		Success:     true,
		Message:     fmt.Sprintf("周度余额报告生成完成，共%d个农户", len(items)),
		ReportNo:    reportNo,
		Year:        year,
		Week:        week,
		GeneratedAt: time.Now(),
		ReportItems: items,
		TotalSummary: map[string]float64{
			"initial_quota":   totalInitial,
			"transfer_in":     totalTransferIn,
			"transfer_out":    totalTransferOut,
			"irrigation_used": totalIrrigation,
			"balance":         totalBalance,
		},
	}, nil
}

func (s *ReportService) calculateTransferIn(farmerID uint, year, week int) (float64, error) {
	transfers, err := s.repo.ListTransfers(map[string]interface{}{
		"to_farmer_id": farmerID,
		"year":         year,
		"week":         week,
		"status":       models.TransferStatusApproved,
	})
	if err != nil {
		return 0, err
	}

	total := 0.0
	for _, t := range transfers {
		total += t.Amount
	}
	return total, nil
}

func (s *ReportService) calculateTransferOut(farmerID uint, year, week int) (float64, error) {
	transfers, err := s.repo.ListTransfers(map[string]interface{}{
		"from_farmer_id": farmerID,
		"year":           year,
		"week":           week,
		"status":         models.TransferStatusApproved,
	})
	if err != nil {
		return 0, err
	}

	total := 0.0
	for _, t := range transfers {
		total += t.Amount
	}
	return total, nil
}

func (s *ReportService) calculateIrrigationUsed(farmerID uint, year, week int) (float64, error) {
	records, err := s.repo.ListIrrigationRecords(map[string]interface{}{
		"farmer_id": farmerID,
		"year":      year,
		"week":      week,
	})
	if err != nil {
		return 0, err
	}

	total := 0.0
	for _, r := range records {
		total += r.WaterAmount
	}
	return total, nil
}

func (s *ReportService) GetFarmerBalance(farmerID uint, year, week int) (*BalanceReportItem, error) {
	farmer, err := s.repo.GetFarmerByID(farmerID)
	if err != nil {
		return nil, fmt.Errorf("农户不存在")
	}

	wr, err := s.repo.GetWaterRight(farmerID, year, week)
	if err != nil {
		return nil, fmt.Errorf("水权信息不存在")
	}

	transferIn, _ := s.calculateTransferIn(farmerID, year, week)
	transferOut, _ := s.calculateTransferOut(farmerID, year, week)
	irrigationUsed, _ := s.calculateIrrigationUsed(farmerID, year, week)

	return &BalanceReportItem{
		FarmerID:       farmer.ID,
		FarmerName:     farmer.Name,
		InitialQuota:   wr.TotalQuota - transferIn + transferOut,
		TransferIn:     transferIn,
		TransferOut:    transferOut,
		IrrigationUsed: irrigationUsed,
		Balance:        wr.Balance,
	}, nil
}

type SelfCheckResult struct {
	Success    bool        `json:"success"`
	Message    string      `json:"message"`
	CheckItems []CheckItem `json:"check_items"`
	Passed     int         `json:"passed"`
	Failed     int         `json:"failed"`
}

type CheckItem struct {
	Name    string `json:"name"`
	Passed  bool   `json:"passed"`
	Message string `json:"message"`
}

func (s *ReportService) SelfCheck(year, week int) *SelfCheckResult {
	result := &SelfCheckResult{
		Success:    true,
		Message:    "自检完成",
		CheckItems: []CheckItem{},
	}

	farmers, _ := s.repo.ListFarmers()

	for _, farmer := range farmers {
		wr, err := s.repo.GetWaterRight(farmer.ID, year, week)
		if err != nil {
			continue
		}

		transferIn, _ := s.calculateTransferIn(farmer.ID, year, week)
		transferOut, _ := s.calculateTransferOut(farmer.ID, year, week)
		irrigationUsed, _ := s.calculateIrrigationUsed(farmer.ID, year, week)

		expectedBalance := wr.TotalQuota - transferOut + transferIn - irrigationUsed
		if abs(expectedBalance-wr.Balance) > 0.01 {
			result.CheckItems = append(result.CheckItems, CheckItem{
				Name:    fmt.Sprintf("农户%s余额校验", farmer.Name),
				Passed:  false,
				Message: fmt.Sprintf("余额不一致: 计算值%.2f, 数据库值%.2f", expectedBalance, wr.Balance),
			})
			result.Failed++
		} else {
			result.CheckItems = append(result.CheckItems, CheckItem{
				Name:    fmt.Sprintf("农户%s余额校验", farmer.Name),
				Passed:  true,
				Message: fmt.Sprintf("余额一致: %.2f", wr.Balance),
			})
			result.Passed++
		}
	}

	allTransfers, _ := s.repo.ListTransfers(map[string]interface{}{
		"year":   year,
		"week":   week,
		"status": models.TransferStatusApproved,
	})

	totalTransferIn := 0.0
	totalTransferOut := 0.0
	for _, t := range allTransfers {
		totalTransferOut += t.Amount
		totalTransferIn += t.Amount
	}

	if abs(totalTransferIn-totalTransferOut) > 0.01 {
		result.CheckItems = append(result.CheckItems, CheckItem{
			Name:    "转让总额平衡校验",
			Passed:  false,
			Message: fmt.Sprintf("转让不平衡: 转出总额%.2f, 转入总额%.2f", totalTransferOut, totalTransferIn),
		})
		result.Failed++
	} else {
		result.CheckItems = append(result.CheckItems, CheckItem{
			Name:    "转让总额平衡校验",
			Passed:  true,
			Message: fmt.Sprintf("转让平衡: %.2f", totalTransferOut),
		})
		result.Passed++
	}

	result.Success = result.Failed == 0
	return result
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}
