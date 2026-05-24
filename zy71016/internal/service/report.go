package service

import (
	"bytes"
	"city-salt-api/internal/database"
	"city-salt-api/internal/models"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"strconv"
	"time"
)

type ReportStats struct {
	TotalBatches      int     `json:"total_batches"`
	CompletedBatches  int     `json:"completed_batches"`
	TotalItems        int     `json:"total_items"`
	CompletedItems    int     `json:"completed_items"`
	AnomalyItems      int     `json:"anomaly_items"`
	TotalSaltUsed     float64 `json:"total_salt_used"`
	ActiveVehicles    int     `json:"active_vehicles"`
	LowStockDepots    int     `json:"low_stock_depots"`
}

type DispatchTrajectory struct {
	DispatchItemID uint                   `json:"dispatch_item_id"`
	BatchNo        string                 `json:"batch_no"`
	VehiclePlate   string                 `json:"vehicle_plate"`
	RoadSection    string                 `json:"road_section"`
	SaltAmount     float64                `json:"salt_amount"`
	Status         string                 `json:"status"`
	Logs           []models.RouteStatusLog `json:"logs"`
}

func GenerateDispatchReport(batchID uint, generatedBy string) (*models.DispatchReport, error) {
	var batch models.DispatchBatch
	if err := database.DB.Preload("WeatherLevel").First(&batch, batchID).Error; err != nil {
		return nil, err
	}

	items, err := database.GetBatchItems(batchID)
	if err != nil {
		return nil, err
	}

	totalItems := len(items)
	completedItems := 0
	anomalyItems := 0
	totalSaltUsed := 0.0

	for _, item := range items {
		if item.Status == "completed" {
			completedItems++
		}
		if item.HasAnomaly {
			anomalyItems++
		}
		if item.Status == "completed" || item.Status == "dispatched" || item.Status == "enroute" {
			totalSaltUsed += item.SaltAmount
		}
	}

	reportContent := generateReportContent(&batch, items)

	reportNo := fmt.Sprintf("RPT-%s-%d", time.Now().Format("20060102"), batchID)

	report := models.DispatchReport{
		ReportNo:        reportNo,
		DispatchBatchID: batchID,
		TotalItems:      totalItems,
		CompletedItems:  completedItems,
		AnomalyItems:    anomalyItems,
		TotalSaltUsed:   totalSaltUsed,
		ReportContent:   reportContent,
		GeneratedBy:     generatedBy,
		CreatedAt:       time.Now(),
	}

	if err := database.DB.Create(&report).Error; err != nil {
		return nil, err
	}

	reportData, _ := json.Marshal(report)
	_ = database.LogOperation(generatedBy, "generate_report", "report", "report", report.ID, "", string(reportData), "")

	return &report, nil
}

func generateReportContent(batch *models.DispatchBatch, items []models.DispatchItem) string {
	var content bytes.Buffer

	content.WriteString(fmt.Sprintf("除雪盐调拨报告\n"))
	content.WriteString(fmt.Sprintf("批次号: %s\n", batch.BatchNo))
	content.WriteString(fmt.Sprintf("天气等级: %s\n", batch.WeatherLevel.Name))
	content.WriteString(fmt.Sprintf("创建时间: %s\n\n", batch.CreatedAt.Format("2006-01-02 15:04:05")))

	content.WriteString(fmt.Sprintf("调拨明细:\n"))
	for i, item := range items {
		content.WriteString(fmt.Sprintf("%d. 路段: %s | 车辆: %s | 盐量: %.2f吨 | 状态: %s",
			i+1, item.RoadSection.Name, item.Vehicle.PlateNumber, item.SaltAmount, item.Status))
		if item.HasAnomaly {
			content.WriteString(fmt.Sprintf(" [异常: %s]", item.AnomalyDesc))
		}
		content.WriteString("\n")
	}

	return content.String()
}

func GetStats() (*ReportStats, error) {
	var stats ReportStats

	var totalBatches int64
	var completedBatches int64
	var totalItems int64
	var completedItems int64
	var anomalyItems int64
	var activeVehicles int64

	database.DB.Model(&models.DispatchBatch{}).Count(&totalBatches)
	database.DB.Model(&models.DispatchBatch{}).Where("status = ?", "completed").Count(&completedBatches)
	database.DB.Model(&models.DispatchItem{}).Count(&totalItems)
	database.DB.Model(&models.DispatchItem{}).Where("status = ?", "completed").Count(&completedItems)
	database.DB.Model(&models.DispatchItem{}).Where("has_anomaly = ? AND status NOT IN ('completed', 'cancelled')", true).Count(&anomalyItems)

	stats.TotalBatches = int(totalBatches)
	stats.CompletedBatches = int(completedBatches)
	stats.TotalItems = int(totalItems)
	stats.CompletedItems = int(completedItems)
	stats.AnomalyItems = int(anomalyItems)

	var result []struct {
		Total float64
	}
	database.DB.Model(&models.DispatchItem{}).Select("COALESCE(SUM(salt_amount), 0) as total").Where("status IN ('dispatched', 'enroute', 'arrived', 'completed')").Scan(&result)
	if len(result) > 0 {
		stats.TotalSaltUsed = result[0].Total
	}

	database.DB.Model(&models.Vehicle{}).Where("status = ?", "busy").Count(&activeVehicles)
	stats.ActiveVehicles = int(activeVehicles)

	lowStockDepots, _ := database.CheckLowStock()
	stats.LowStockDepots = len(lowStockDepots)

	return &stats, nil
}

func GetItemTrajectory(dispatchItemID uint) (*DispatchTrajectory, error) {
	var item models.DispatchItem
	if err := database.DB.Preload("Vehicle").Preload("RoadSection").Preload("SaltDepot").
		First(&item, dispatchItemID).Error; err != nil {
		return nil, err
	}

	var batch models.DispatchBatch
	if err := database.DB.First(&batch, item.DispatchBatchID).Error; err != nil {
		return nil, err
	}

	logs, err := database.GetDispatchItemTrajectory(dispatchItemID)
	if err != nil {
		return nil, err
	}

	return &DispatchTrajectory{
		DispatchItemID: item.ID,
		BatchNo:        batch.BatchNo,
		VehiclePlate:   item.Vehicle.PlateNumber,
		RoadSection:    item.RoadSection.Name,
		SaltAmount:     item.SaltAmount,
		Status:         item.Status,
		Logs:           logs,
	}, nil
}

func GetBatchTrajectory(batchID uint) ([]DispatchTrajectory, error) {
	items, err := database.GetBatchItems(batchID)
	if err != nil {
		return nil, err
	}

	var trajectories []DispatchTrajectory
	for _, item := range items {
		logs, _ := database.GetDispatchItemTrajectory(item.ID)
		trajectories = append(trajectories, DispatchTrajectory{
			DispatchItemID: item.ID,
			VehiclePlate:   item.Vehicle.PlateNumber,
			RoadSection:    item.RoadSection.Name,
			SaltAmount:     item.SaltAmount,
			Status:         item.Status,
			Logs:           logs,
		})
	}

	return trajectories, nil
}

func ExportToCSV(batchID uint) ([]byte, error) {
	var batch models.DispatchBatch
	if err := database.DB.First(&batch, batchID).Error; err != nil {
		return nil, err
	}

	items, err := database.GetBatchItems(batchID)
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)
	writer.Write([]string{"批次号", batch.BatchNo})
	writer.Write([]string{"创建时间", batch.CreatedAt.Format("2006-01-02 15:04:05")})
	writer.Write([]string{})
	writer.Write([]string{"任务ID", "路段", "盐库", "车辆", "司机", "盐量(吨)", "状态", "是否异常", "异常描述", "创建时间", "完成时间"})

	for _, item := range items {
		completedAt := ""
		if item.ReceiptTime != nil {
			completedAt = item.ReceiptTime.Format("2006-01-02 15:04:05")
		}
		writer.Write([]string{
			strconv.Itoa(int(item.ID)),
			item.RoadSection.Name,
			item.SaltDepot.Name,
			item.Vehicle.PlateNumber,
			item.Vehicle.DriverName,
			fmt.Sprintf("%.2f", item.SaltAmount),
			item.Status,
			strconv.FormatBool(item.HasAnomaly),
			item.AnomalyDesc,
			item.CreatedAt.Format("2006-01-02 15:04:05"),
			completedAt,
		})
	}

	writer.Flush()
	return buf.Bytes(), nil
}

func ExportStatsCSV() ([]byte, error) {
	stats, err := GetStats()
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	writer.Write([]string{"统计项", "数值"})
	writer.Write([]string{"总批次", strconv.Itoa(stats.TotalBatches)})
	writer.Write([]string{"已完成批次", strconv.Itoa(stats.CompletedBatches)})
	writer.Write([]string{"总任务数", strconv.Itoa(stats.TotalItems)})
	writer.Write([]string{"已完成任务", strconv.Itoa(stats.CompletedItems)})
	writer.Write([]string{"异常任务数", strconv.Itoa(stats.AnomalyItems)})
	writer.Write([]string{"总用盐量(吨)", fmt.Sprintf("%.2f", stats.TotalSaltUsed)})
	writer.Write([]string{"作业中车辆", strconv.Itoa(stats.ActiveVehicles)})
	writer.Write([]string{"低库存盐库", strconv.Itoa(stats.LowStockDepots)})

	var depots []models.SaltDepot
	database.DB.Find(&depots)
	writer.Write([]string{})
	writer.Write([]string{"盐库明细"})
	writer.Write([]string{"盐库名称", "容量", "当前库存", "警戒线", "状态"})
	for _, depot := range depots {
		status := "正常"
		if depot.CurrentStock <= depot.LowThreshold {
			status = "低库存"
		}
		writer.Write([]string{
			depot.Name,
			fmt.Sprintf("%.2f", depot.Capacity),
			fmt.Sprintf("%.2f", depot.CurrentStock),
			fmt.Sprintf("%.2f", depot.LowThreshold),
			status,
		})
	}

	writer.Flush()
	return buf.Bytes(), nil
}
