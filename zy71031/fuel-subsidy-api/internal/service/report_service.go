package service

import (
	"errors"
	"fmt"
	"fuel-subsidy-api/internal/dao"
	"fuel-subsidy-api/internal/models"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
)

type QueryApplicationParams struct {
	ApplicationYear *int    `json:"application_year"`
	VesselNumber    *string `json:"vessel_number"`
	ApplicantName   *string `json:"applicant_name"`
	Status          *string `json:"status"`
	Page            int     `json:"page"`
	PageSize        int     `json:"page_size"`
}

type QueryResult struct {
	Total int64                       `json:"total"`
	Page  int                         `json:"page"`
	Size  int                         `json:"size"`
	List  []models.SubsidyApplication `json:"list"`
}

type StatisticsResult struct {
	ApplicationYear  int     `json:"application_year"`
	TotalApps        int64   `json:"total_apps"`
	ReceivedApps     int64   `json:"received_apps"`
	VerifiedApps     int64   `json:"verified_apps"`
	ProcessedApps    int64   `json:"processed_apps"`
	ReviewPassedApps int64   `json:"review_passed_apps"`
	ClosedApps       int64   `json:"closed_apps"`
	RejectedApps     int64   `json:"rejected_apps"`
	TotalFuelAmount  float64 `json:"total_fuel_amount"`
	TotalSubsidy     float64 `json:"total_subsidy"`
	TotalVessels     int64   `json:"total_vessels"`
}

func QueryApplications(params *QueryApplicationParams) (*QueryResult, error) {
	query := dao.DB.Model(&models.SubsidyApplication{})

	if params.ApplicationYear != nil {
		query = query.Where("application_year = ?", *params.ApplicationYear)
	}
	if params.VesselNumber != nil {
		query = query.Where("vessel_number LIKE ?", "%"+*params.VesselNumber+"%")
	}
	if params.ApplicantName != nil {
		query = query.Where("applicant_name LIKE ?", "%"+*params.ApplicantName+"%")
	}
	if params.Status != nil {
		query = query.Where("status = ?", *params.Status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	page := params.Page
	if page < 1 {
		page = 1
	}
	pageSize := params.PageSize
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	var list []models.SubsidyApplication
	if err := query.Order("created_at desc").Offset(offset).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, err
	}

	return &QueryResult{
		Total: total,
		Page:  page,
		Size:  pageSize,
		List:  list,
	}, nil
}

func GetStatistics(year int) (*StatisticsResult, error) {
	var result StatisticsResult
	result.ApplicationYear = year

	query := dao.DB.Model(&models.SubsidyApplication{}).Where("application_year = ?", year)

	var total int64
	query.Count(&total)
	result.TotalApps = total

	query.Where("status = ?", models.StatusReceived).Count(&result.ReceivedApps)
	query.Where("status = ?", models.StatusVerified).Count(&result.VerifiedApps)
	query.Where("status = ?", models.StatusProcessed).Count(&result.ProcessedApps)
	query.Where("status = ?", models.StatusReviewPassed).Count(&result.ReviewPassedApps)
	query.Where("status = ?", models.StatusClosed).Count(&result.ClosedApps)
	query.Where("status = ?", models.StatusRejected).Count(&result.RejectedApps)

	var fuelSum struct {
		TotalFuel float64
		TotalSubs float64
	}
	dao.DB.Model(&models.SubsidyApplication{}).
		Where("application_year = ? AND status IN ?", year, []models.AuditStatus{models.StatusClosed, models.StatusProcessed, models.StatusReviewPassed}).
		Select("COALESCE(SUM(total_fuel_amount), 0) as total_fuel, COALESCE(SUM(subsidy_amount), 0) as total_subs").
		Scan(&fuelSum)
	result.TotalFuelAmount = fuelSum.TotalFuel
	result.TotalSubsidy = fuelSum.TotalSubs

	var vesselCount int64
	dao.DB.Model(&models.SubsidyApplication{}).
		Where("application_year = ?", year).
		Distinct("vessel_number").
		Count(&vesselCount)
	result.TotalVessels = vesselCount

	return &result, nil
}

func ExportExcel(year int, operator string) (string, error) {
	var apps []models.SubsidyApplication
	err := dao.DB.Where("application_year = ?", year).Order("created_at desc").Find(&apps).Error
	if err != nil {
		return "", err
	}

	if len(apps) == 0 {
		return "", errors.New("没有可导出的数据")
	}

	stats, err := GetStatistics(year)
	if err != nil {
		return "", err
	}

	f := excelize.NewFile()

	index1, err := f.NewSheet("补贴申请明细")
	if err != nil {
		return "", err
	}
	f.SetActiveSheet(index1)

	headers1 := []string{"申请编号", "申请年度", "申请人", "身份证号", "渔船船号", "状态", "当前阶段",
		"总油量(升)", "补贴金额(元)", "补贴率", "收件人", "收件时间", "核验人", "核验时间",
		"处理人", "处理时间", "复核人", "复核时间", "结案人", "结案时间"}
	for i, h := range headers1 {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue("补贴申请明细", cell, h)
		f.SetCellStyle("补贴申请明细", cell, cell, getHeaderStyle(f))
	}

	for i, app := range apps {
		row := i + 2
		f.SetCellValue("补贴申请明细", fmt.Sprintf("A%d", row), app.ApplicationNo)
		f.SetCellValue("补贴申请明细", fmt.Sprintf("B%d", row), app.ApplicationYear)
		f.SetCellValue("补贴申请明细", fmt.Sprintf("C%d", row), app.ApplicantName)
		f.SetCellValue("补贴申请明细", fmt.Sprintf("D%d", row), app.ApplicantIDCard)
		f.SetCellValue("补贴申请明细", fmt.Sprintf("E%d", row), app.VesselNumber)
		f.SetCellValue("补贴申请明细", fmt.Sprintf("F%d", row), getStatusText(app.Status))
		f.SetCellValue("补贴申请明细", fmt.Sprintf("G%d", row), getStageText(app.CurrentStage))
		f.SetCellValue("补贴申请明细", fmt.Sprintf("H%d", row), app.TotalFuelAmount)
		f.SetCellValue("补贴申请明细", fmt.Sprintf("I%d", row), app.SubsidyAmount)
		f.SetCellValue("补贴申请明细", fmt.Sprintf("J%d", row), app.SubsidyRate)
		f.SetCellValue("补贴申请明细", fmt.Sprintf("K%d", row), app.ReceivedBy)
		if app.ReceivedAt != nil {
			f.SetCellValue("补贴申请明细", fmt.Sprintf("L%d", row), app.ReceivedAt.Format("2006-01-02 15:04:05"))
		}
		f.SetCellValue("补贴申请明细", fmt.Sprintf("M%d", row), app.VerifiedBy)
		if app.VerifiedAt != nil {
			f.SetCellValue("补贴申请明细", fmt.Sprintf("N%d", row), app.VerifiedAt.Format("2006-01-02 15:04:05"))
		}
		f.SetCellValue("补贴申请明细", fmt.Sprintf("O%d", row), app.ProcessedBy)
		if app.ProcessedAt != nil {
			f.SetCellValue("补贴申请明细", fmt.Sprintf("P%d", row), app.ProcessedAt.Format("2006-01-02 15:04:05"))
		}
		f.SetCellValue("补贴申请明细", fmt.Sprintf("Q%d", row), app.ReviewedBy)
		if app.ReviewedAt != nil {
			f.SetCellValue("补贴申请明细", fmt.Sprintf("R%d", row), app.ReviewedAt.Format("2006-01-02 15:04:05"))
		}
		f.SetCellValue("补贴申请明细", fmt.Sprintf("S%d", row), app.ClosedBy)
		if app.ClosedAt != nil {
			f.SetCellValue("补贴申请明细", fmt.Sprintf("T%d", row), app.ClosedAt.Format("2006-01-02 15:04:05"))
		}
	}

	for i := range headers1 {
		col := fmt.Sprintf("%c", 'A'+i)
		f.SetColWidth("补贴申请明细", col, col, 18)
	}

	_, err = f.NewSheet("统计汇总")
	if err != nil {
		return "", err
	}

	headers2 := []string{"指标", "数值"}
	for i, h := range headers2 {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue("统计汇总", cell, h)
		f.SetCellStyle("统计汇总", cell, cell, getHeaderStyle(f))
	}

	statsData := [][]interface{}{
		{"申请年度", stats.ApplicationYear},
		{"总申请数", stats.TotalApps},
		{"待核验", stats.ReceivedApps},
		{"已核验待处理", stats.VerifiedApps},
		{"已处理待复核", stats.ProcessedApps},
		{"已复核待结案", stats.ReviewPassedApps},
		{"已结案", stats.ClosedApps},
		{"已拒绝", stats.RejectedApps},
		{"涉及渔船数", stats.TotalVessels},
		{"总燃油量(升)", stats.TotalFuelAmount},
		{"总补贴金额(元)", stats.TotalSubsidy},
	}

	for i, row := range statsData {
		f.SetCellValue("统计汇总", fmt.Sprintf("A%d", i+2), row[0])
		f.SetCellValue("统计汇总", fmt.Sprintf("B%d", i+2), row[1])
	}

	f.SetColWidth("统计汇总", "A", "A", 20)
	f.SetColWidth("统计汇总", "B", "B", 20)

	f.DeleteSheet("Sheet1")

	reportDir := "./reports"
	os.MkdirAll(reportDir, 0755)

	reportNo := fmt.Sprintf("RPT%d%06d", year, time.Now().Unix())
	fileName := fmt.Sprintf("燃油补贴报告_%d_%s.xlsx", year, time.Now().Format("20060102150405"))
	filePath := filepath.Join(reportDir, fileName)

	if err := f.SaveAs(filePath); err != nil {
		return "", err
	}

	report := &models.SubsidyReport{
		ReportNo:        reportNo,
		ReportType:      "annual",
		ReportYear:      year,
		TotalVessels:    int(stats.TotalVessels),
		TotalApps:       int(stats.TotalApps),
		ApprovedApps:    int(stats.ClosedApps),
		RejectedApps:    int(stats.RejectedApps),
		TotalFuelAmount: stats.TotalFuelAmount,
		TotalSubsidy:    stats.TotalSubsidy,
		GeneratedBy:     operator,
		GeneratedAt:     time.Now(),
		FilePath:        filePath,
	}

	if err := dao.DB.Create(report).Error; err != nil {
		return "", err
	}

	return filePath, nil
}

func getHeaderStyle(f *excelize.File) int {
	style, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold: true,
		},
		Fill: excelize.Fill{
			Type:    "pattern",
			Color:   []string{"#E0E0E0"},
			Pattern: 1,
		},
		Border: []excelize.Border{
			{Type: "left", Color: "#000000", Style: 1},
			{Type: "top", Color: "#000000", Style: 1},
			{Type: "bottom", Color: "#000000", Style: 1},
			{Type: "right", Color: "#000000", Style: 1},
		},
	})
	return style
}

func getStatusText(status models.AuditStatus) string {
	statusMap := map[models.AuditStatus]string{
		models.StatusReceived:     "已收件",
		models.StatusVerifying:    "核验中",
		models.StatusVerified:     "已核验",
		models.StatusProcessing:   "处理中",
		models.StatusProcessed:    "已处理",
		models.StatusReviewing:    "复核中",
		models.StatusReviewPassed: "已复核",
		models.StatusClosed:       "已结案",
		models.StatusRejected:     "已拒绝",
	}
	if text, ok := statusMap[status]; ok {
		return text
	}
	return string(status)
}

func getStageText(stage string) string {
	stageMap := map[string]string{
		"receive": "收件",
		"verify":  "核验",
		"process": "处理",
		"review":  "复核",
		"close":   "结案",
	}
	if text, ok := stageMap[stage]; ok {
		return text
	}
	return stage
}

func AddFuelReceipt(receipt *models.FuelReceipt) error {
	var existing models.FuelReceipt
	err := dao.DB.Where("receipt_number = ?", receipt.ReceiptNumber).First(&existing).Error
	if err == nil {
		return errors.New("加油票号已存在")
	}
	return dao.DB.Create(receipt).Error
}

func ListFuelReceipts(vesselNumber string, isUsed *bool) ([]models.FuelReceipt, error) {
	var receipts []models.FuelReceipt
	query := dao.DB.Model(&models.FuelReceipt{})
	if vesselNumber != "" {
		query = query.Where("vessel_number = ?", vesselNumber)
	}
	if isUsed != nil {
		query = query.Where("is_used = ?", *isUsed)
	}
	err := query.Order("created_at desc").Find(&receipts).Error
	return receipts, err
}

func GetAuditLogs(appID uuid.UUID) ([]models.AuditLog, error) {
	var logs []models.AuditLog
	err := dao.DB.Where("application_id = ?", appID).Order("created_at asc").Find(&logs).Error
	return logs, err
}
