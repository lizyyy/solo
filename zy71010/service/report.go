package service

import (
	"encoding/csv"
	"fmt"
	"os"
	"strconv"
	"time"

	"vet-vaccine-cold-chain/models"
	"vet-vaccine-cold-chain/repository"
)

type ColdChainReportData struct {
	ReportID       string              `json:"report_id"`
	ReportType     string              `json:"report_type"`
	GeneratedAt    time.Time           `json:"generated_at"`
	GeneratedBy    string              `json:"generated_by"`
	Summary        ReportSummary       `json:"summary"`
	Validations    []ValidationDetail  `json:"validations"`
	TransferTrails []TransferTrailDetail `json:"transfer_trails"`
	DiscardRecords []DiscardDetail     `json:"discard_records"`
}

type ReportSummary struct {
	TotalVaccines      int `json:"total_vaccines"`
	TotalFridges       int `json:"total_fridges"`
	CompliantCount     int `json:"compliant_count"`
	NonCompliantCount  int `json:"non_compliant_count"`
	TempBreakpoints    int `json:"temp_breakpoints"`
	ExpiredOpenVials   int `json:"expired_open_vials"`
}

type ValidationDetail struct {
	BatchNumber    string `json:"batch_number"`
	FridgeID       string `json:"fridge_id"`
	FridgeName     string `json:"fridge_name"`
	Status         string `json:"status"`
	Issues         string `json:"issues"`
	LastChecked    time.Time `json:"last_checked"`
}

type TransferTrailDetail struct {
	BatchNumber    string                `json:"batch_number"`
	TotalTransfers int                   `json:"total_transfers"`
	CurrentFridge  string                `json:"current_fridge"`
	Transfers      []models.TransferRecord `json:"transfers"`
}

type DiscardDetail struct {
	ID          string    `json:"id"`
	BatchNumber string    `json:"batch_number"`
	DosesCount  int       `json:"doses_count"`
	Reason      string    `json:"reason"`
	DiscardedAt time.Time `json:"discarded_at"`
	Confirmed   bool      `json:"confirmed"`
}

func GenerateColdChainReport(startDate, endDate time.Time, generatedBy string) (*ColdChainReportData, error) {
	reportData := &ColdChainReportData{
		ReportType:  "full_cold_chain",
		GeneratedAt: time.Now(),
		GeneratedBy: generatedBy,
	}

	fridges, err := repository.GetAllRefrigerators()
	if err != nil {
		return nil, err
	}
	reportData.Summary.TotalFridges = len(fridges)

	for _, fridge := range fridges {
		validation, err := ValidateColdChainWindow(fridge.ID, startDate, endDate)
		if err != nil {
			continue
		}

		detail := ValidationDetail{
			FridgeID:    fridge.ID,
			FridgeName:  fridge.Name,
			Status:      "compliant",
			LastChecked: time.Now(),
		}

		if !validation.Valid {
			detail.Status = "non_compliant"
			detail.Issues = fmt.Sprintf("发现 %d 个温度断点", len(validation.Breakpoints))
			reportData.Summary.TempBreakpoints += len(validation.Breakpoints)
			reportData.Summary.NonCompliantCount++
		} else {
			reportData.Summary.CompliantCount++
		}

		reportData.Validations = append(reportData.Validations, detail)
	}

	report := &models.ColdChainReport{
		ReportType:  "full_cold_chain",
		StartDate:   startDate,
		EndDate:     endDate,
		ReportData:  repository.SerializeData(reportData),
		GeneratedBy: generatedBy,
	}

	if err := repository.CreateColdChainReport(report); err != nil {
		return nil, err
	}

	reportData.ReportID = report.ID
	return reportData, nil
}

func ExportReportToCSV(reportID string, filePath string) error {
	report, err := repository.GetColdChainReport(reportID)
	if err != nil {
		return err
	}

	var reportData ColdChainReportData
	if err := repository.DeserializeData(report.ReportData, &reportData); err != nil {
		return err
	}

	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	writer.Write([]string{"兽医疫苗冷链报告"})
	writer.Write([]string{"报告ID", reportData.ReportID})
	writer.Write([]string{"报告类型", reportData.ReportType})
	writer.Write([]string{"生成时间", reportData.GeneratedAt.Format(time.RFC3339)})
	writer.Write([]string{"生成人", reportData.GeneratedBy})
	writer.Write([]string{})

	writer.Write([]string{"汇总信息"})
	writer.Write([]string{"冰箱总数", strconv.Itoa(reportData.Summary.TotalFridges)})
	writer.Write([]string{"合规数量", strconv.Itoa(reportData.Summary.CompliantCount)})
	writer.Write([]string{"不合规数量", strconv.Itoa(reportData.Summary.NonCompliantCount)})
	writer.Write([]string{"温度断点数", strconv.Itoa(reportData.Summary.TempBreakpoints)})
	writer.Write([]string{"超时开瓶数", strconv.Itoa(reportData.Summary.ExpiredOpenVials)})
	writer.Write([]string{})

	writer.Write([]string{"温度验证详情"})
	writer.Write([]string{"冰箱ID", "冰箱名称", "状态", "问题", "检查时间"})
	for _, v := range reportData.Validations {
		writer.Write([]string{
			v.FridgeID,
			v.FridgeName,
			v.Status,
			v.Issues,
			v.LastChecked.Format(time.RFC3339),
		})
	}

	return nil
}

func HealthCheck() (map[string]interface{}, error) {
	result := make(map[string]interface{})
	result["status"] = "healthy"
	result["timestamp"] = time.Now()

	fridges, err := repository.GetAllRefrigerators()
	if err != nil {
		result["database"] = "error"
		return result, err
	}
	result["database"] = "connected"
	result["refrigerator_count"] = len(fridges)

	return result, nil
}

func DataConsistencyCheck() (map[string]interface{}, error) {
	result := make(map[string]interface{})
	result["status"] = "consistent"
	issues := []string{}

	fridges, _ := repository.GetAllRefrigerators()
	for _, fridge := range fridges {
		endTime := time.Now()
		startTime := endTime.Add(-24 * time.Hour)
		records, _ := repository.GetTemperatureRecords(fridge.ID, startTime, endTime)
		if len(records) == 0 {
			issues = append(issues, fmt.Sprintf("冰箱 %s 最近24小时无温度记录", fridge.Name))
		}
	}

	if len(issues) > 0 {
		result["status"] = "warnings"
		result["issues"] = issues
	}

	result["check_time"] = time.Now()
	result["total_issues"] = len(issues)
	return result, nil
}
