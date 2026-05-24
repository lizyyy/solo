package service

import (
	"encoding/csv"
	"fmt"
	"os"
	"strconv"
	"time"

	"vet-vaccine-cold-chain/config"
	"vet-vaccine-cold-chain/models"
	"vet-vaccine-cold-chain/repository"
)

type ColdChainReportData struct {
	ReportID       string                `json:"report_id"`
	ReportType     string                `json:"report_type"`
	GeneratedAt    time.Time             `json:"generated_at"`
	GeneratedBy    string                `json:"generated_by"`
	Summary        ReportSummary         `json:"summary"`
	Validations    []ValidationDetail    `json:"validations"`
	TransferTrails []TransferTrailDetail `json:"transfer_trails"`
	DiscardRecords []DiscardDetail       `json:"discard_records"`
}

type ReportSummary struct {
	TotalVaccines     int `json:"total_vaccines"`
	TotalFridges      int `json:"total_fridges"`
	CompliantCount    int `json:"compliant_count"`
	NonCompliantCount int `json:"non_compliant_count"`
	TempBreakpoints   int `json:"temp_breakpoints"`
	ExpiredOpenVials  int `json:"expired_open_vials"`
}

type ValidationDetail struct {
	BatchNumber string    `json:"batch_number"`
	FridgeID    string    `json:"fridge_id"`
	FridgeName  string    `json:"fridge_name"`
	Status      string    `json:"status"`
	Issues      string    `json:"issues"`
	LastChecked time.Time `json:"last_checked"`
}

type TransferTrailDetail struct {
	BatchNumber    string                  `json:"batch_number"`
	TotalTransfers int                     `json:"total_transfers"`
	CurrentFridge  string                  `json:"current_fridge"`
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
		return nil, fmt.Errorf("获取冰箱列表失败: %w", err)
	}
	reportData.Summary.TotalFridges = len(fridges)

	vaccines, err := repository.GetAllVaccines()
	if err != nil {
		return nil, fmt.Errorf("获取疫苗列表失败: %w", err)
	}
	reportData.Summary.TotalVaccines = len(vaccines)

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

	openRecords, err := repository.GetAllOpenRecords()
	if err != nil {
		return nil, fmt.Errorf("获取开瓶记录失败: %w", err)
	}

	cfg := config.Load()
	expiredCount := 0
	for _, or := range openRecords {
		if or.Status == "opened" {
			timeOpen := time.Since(or.OpenedAt)
			if timeOpen > cfg.MaxOpenHours {
				expiredCount++
			}
		} else if or.Status == "expired" {
			expiredCount++
		}
	}
	reportData.Summary.ExpiredOpenVials = expiredCount

	batchTransfers := make(map[string][]models.TransferRecord)
	for _, v := range vaccines {
		transfers, err := repository.GetTransfersByBatch(v.BatchNumber)
		if err != nil {
			continue
		}
		if len(transfers) > 0 {
			batchTransfers[v.BatchNumber] = transfers
		}
	}

	for batchNumber, transfers := range batchTransfers {
		currentFridge := ""
		if len(transfers) > 0 {
			currentFridge = transfers[len(transfers)-1].ToRefrigeratorID
		}
		fridge, _ := repository.GetRefrigeratorByID(currentFridge)
		currentFridgeName := currentFridge
		if fridge != nil {
			currentFridgeName = fridge.Name
		}

		trail := TransferTrailDetail{
			BatchNumber:    batchNumber,
			TotalTransfers: len(transfers),
			CurrentFridge:  currentFridgeName,
			Transfers:      transfers,
		}
		reportData.TransferTrails = append(reportData.TransferTrails, trail)
	}

	discards, err := repository.GetAllDiscardRecords()
	if err != nil {
		return nil, fmt.Errorf("获取废弃记录失败: %w", err)
	}

	for _, dr := range discards {
		detail := DiscardDetail{
			ID:          dr.ID,
			BatchNumber: dr.BatchNumber,
			DosesCount:  dr.DosesCount,
			Reason:      dr.Reason,
			DiscardedAt: dr.DiscardedAt,
			Confirmed:   dr.Confirmed,
		}
		reportData.DiscardRecords = append(reportData.DiscardRecords, detail)
	}

	report := &models.ColdChainReport{
		ReportType:  "full_cold_chain",
		StartDate:   startDate,
		EndDate:     endDate,
		ReportData:  repository.SerializeData(reportData),
		GeneratedBy: generatedBy,
	}

	if err := repository.CreateColdChainReport(report); err != nil {
		return nil, fmt.Errorf("创建报告失败: %w", err)
	}

	reportData.ReportID = report.ID
	return reportData, nil
}

func ExportReportToCSV(reportID string, filePath string) error {
	report, err := repository.GetColdChainReport(reportID)
	if err != nil {
		return fmt.Errorf("获取报告失败: %w", err)
	}

	var reportData ColdChainReportData
	if err := repository.DeserializeData(report.ReportData, &reportData); err != nil {
		return fmt.Errorf("解析报告数据失败: %w", err)
	}

	file, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("创建文件失败: %w", err)
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

	writer.Write([]string{"=== 汇总信息 ==="})
	writer.Write([]string{"疫苗种类数", strconv.Itoa(reportData.Summary.TotalVaccines)})
	writer.Write([]string{"冰箱总数", strconv.Itoa(reportData.Summary.TotalFridges)})
	writer.Write([]string{"合规冰箱数", strconv.Itoa(reportData.Summary.CompliantCount)})
	writer.Write([]string{"不合规冰箱数", strconv.Itoa(reportData.Summary.NonCompliantCount)})
	writer.Write([]string{"温度断点总数", strconv.Itoa(reportData.Summary.TempBreakpoints)})
	writer.Write([]string{"超时开瓶数", strconv.Itoa(reportData.Summary.ExpiredOpenVials)})
	writer.Write([]string{})

	writer.Write([]string{"=== 温度验证详情 ==="})
	writer.Write([]string{"冰箱ID", "冰箱名称", "状态", "问题说明", "检查时间"})
	for _, v := range reportData.Validations {
		writer.Write([]string{
			v.FridgeID,
			v.FridgeName,
			v.Status,
			v.Issues,
			v.LastChecked.Format(time.RFC3339),
		})
	}
	writer.Write([]string{})

	writer.Write([]string{"=== 调拨留痕详情 ==="})
	if len(reportData.TransferTrails) == 0 {
		writer.Write([]string{"暂无调拨记录"})
	} else {
		writer.Write([]string{"疫苗批号", "调拨次数", "当前所在冰箱", "调拨历史"})
		for _, trail := range reportData.TransferTrails {
			transferHistory := ""
			for i, t := range trail.Transfers {
				fromFridge, _ := repository.GetRefrigeratorByID(t.FromRefrigeratorID)
				toFridge, _ := repository.GetRefrigeratorByID(t.ToRefrigeratorID)
				fromName := t.FromRefrigeratorID
				toName := t.ToRefrigeratorID
				if fromFridge != nil {
					fromName = fromFridge.Name
				}
				if toFridge != nil {
					toName = toFridge.Name
				}
				transferHistory += fmt.Sprintf("[%d] %s->%s(%d剂); ", i+1, fromName, toName, t.DosesCount)
			}
			writer.Write([]string{
				trail.BatchNumber,
				strconv.Itoa(trail.TotalTransfers),
				trail.CurrentFridge,
				transferHistory,
			})
		}
	}
	writer.Write([]string{})

	writer.Write([]string{"=== 废弃记录详情 ==="})
	if len(reportData.DiscardRecords) == 0 {
		writer.Write([]string{"暂无废弃记录"})
	} else {
		writer.Write([]string{"废弃记录ID", "疫苗批号", "废弃剂量", "废弃原因", "废弃时间", "是否已确认"})
		for _, dr := range reportData.DiscardRecords {
			confirmed := "否"
			if dr.Confirmed {
				confirmed = "是"
			}
			writer.Write([]string{
				dr.ID,
				dr.BatchNumber,
				strconv.Itoa(dr.DosesCount),
				dr.Reason,
				dr.DiscardedAt.Format(time.RFC3339),
				confirmed,
			})
		}
	}
	writer.Write([]string{})

	writer.Write([]string{"=== 开瓶超时统计 ==="})
	writer.Write([]string{"超时开瓶总数", strconv.Itoa(reportData.Summary.ExpiredOpenVials)})
	writer.Write([]string{"说明", "开瓶后超过6小时未用完视为超时"})

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
