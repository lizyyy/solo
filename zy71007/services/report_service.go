package services

import (
"dialysis-recall-api/database"
"dialysis-recall-api/models"
"github.com/xuri/excelize/v2"
)

func GenerateRecallReport(noticeID uint) (*excelize.File, error) {
f := excelize.NewFile()
var notice models.RecallNotice
db := database.GetDB()
if err := db.First(&notice, noticeID).Error; err != nil {
return nil, err
}
return f, nil
}
	}

	traceResults, err := GetTraceResultsByNotice(noticeID, nil)
	if err != nil {
		return nil, err
	}

	f := excelize.NewFile()

	if err := createNoticeSheet(f, notice); err != nil {
		return nil, err
	}

	if err := createTraceResultsSheet(f, traceResults); err != nil {
		return nil, err
	}

	if err := createPatientSummarySheet(f, traceResults); err != nil {
		return nil, err
	}

	if err := createStatisticsSheet(f, notice, traceResults); err != nil {
		return nil, err
	}

	f.SetActiveSheet(0)

	return f, nil
}

func createNoticeSheet(f *excelize.File, notice models.RecallNotice) error {
	sheetName := "召回公告"
	index, err := f.NewSheet(sheetName)
	if err != nil {
		return err
	}
	f.SetActiveSheet(index)
	f.DeleteSheet("Sheet1")

	headers := []string{"字段", "内容"}
	for i, header := range headers {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheetName, cell, header)
	}

	data := [][]interface{}{
		{"公告编号", notice.NoticeNo},
		{"公告标题", notice.Title},
		{"涉事批号", notice.BatchNumber},
		{"召回原因", notice.Reason},
		{"发布人", notice.Publisher},
		{"发布日期", notice.PublishDate.Format("2006-01-02")},
		{"生效日期", notice.EffectiveDate.Format("2006-01-02")},
		{"当前状态", notice.Status},
		{"追溯数量", notice.TracedCount},
		{"确认数量", notice.ConfirmedCount},
	}

	for i, row := range data {
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", i+2), row[0])
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", i+2), row[1])
	}

	style, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#E0E0E0"}, Pattern: 1},
	})
	f.SetRowStyle(sheetName, 1, 1, style)
	f.SetColWidth(sheetName, "A", "A", 15)
	f.SetColWidth(sheetName, "B", "B", 50)

	return nil
}

func createTraceResultsSheet(f *excelize.File, results []models.TraceResult) error {
	sheetName := "追溯明细"
	_, err := f.NewSheet(sheetName)
	if err != nil {
		return err
	}

	headers := []string{"ID", "患者姓名", "患者ID", "性别", "年龄", "联系电话",
		"耗材名称", "批号", "使用数量", "使用日期", "透析班次", "状态", "追溯时间", "审核人", "审核时间", "审核备注"}
	for i, header := range headers {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheetName, cell, header)
	}

	for i, result := range results {
		row := i + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), result.ID)
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), result.Patient.Name)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), result.Patient.PatientID)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), result.Patient.Gender)
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), result.Patient.Age)
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), result.Patient.Phone)
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), result.ConsumptionRecord.Material.MaterialName)
		f.SetCellValue(sheetName, fmt.Sprintf("H%d", row), result.ConsumptionRecord.Material.BatchNumber)
		f.SetCellValue(sheetName, fmt.Sprintf("I%d", row), result.ConsumptionRecord.QuantityUsed)
		f.SetCellValue(sheetName, fmt.Sprintf("J%d", row), result.ConsumptionRecord.UsageTime.Format("2006-01-02 15:04"))
		f.SetCellValue(sheetName, fmt.Sprintf("K%d", row), result.ConsumptionRecord.DialysisShift.ShiftCode)
		f.SetCellValue(sheetName, fmt.Sprintf("L%d", row), result.Status)
		f.SetCellValue(sheetName, fmt.Sprintf("M%d", row), result.TraceTime.Format("2006-01-02 15:04"))
		f.SetCellValue(sheetName, fmt.Sprintf("N%d", row), result.ReviewedBy)
		if result.ReviewedAt != nil {
			f.SetCellValue(sheetName, fmt.Sprintf("O%d", row), result.ReviewedAt.Format("2006-01-02 15:04"))
		}
		f.SetCellValue(sheetName, fmt.Sprintf("P%d", row), result.ReviewRemark)
	}

	style, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#E0E0E0"}, Pattern: 1},
	})
	f.SetRowStyle(sheetName, 1, 1, style)
	for i := range headers {
		f.SetColWidth(sheetName, fmt.Sprintf("%c", 'A'+i), fmt.Sprintf("%c", 'A'+i), 15)
	}

	return nil
}

func createPatientSummarySheet(f *excelize.File, results []models.TraceResult) error {
	sheetName := "患者汇总"
	_, err := f.NewSheet(sheetName)
	if err != nil {
		return err
	}

	patientMap := make(map[uint][]models.TraceResult)
	for _, r := range results {
		patientMap[r.PatientID] = append(patientMap[r.PatientID], r)
	}

	headers := []string{"患者ID", "姓名", "性别", "年龄", "联系电话", "涉及次数", "状态"}
	for i, header := range headers {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheetName, cell, header)
	}

	row := 2
	for _, patientResults := range patientMap {
		if len(patientResults) == 0 {
			continue
		}
		patient := patientResults[0].Patient
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), patient.PatientID)
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), patient.Name)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), patient.Gender)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), patient.Age)
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), patient.Phone)
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), len(patientResults))

		status := "待处理"
		hasConfirmed := false
		for _, r := range patientResults {
			if r.Status == models.StatusConfirmed {
				hasConfirmed = true
				break
			}
		}
		if hasConfirmed {
			status = "已确认"
		}
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), status)
		row++
	}

	style, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#E0E0E0"}, Pattern: 1},
	})
	f.SetRowStyle(sheetName, 1, 1, style)
	for i := range headers {
		f.SetColWidth(sheetName, fmt.Sprintf("%c", 'A'+i), fmt.Sprintf("%c", 'A'+i), 15)
	}

	return nil
}

func createStatisticsSheet(f *excelize.File, notice models.RecallNotice, results []models.TraceResult) error {
	sheetName := "统计信息"
	_, err := f.NewSheet(sheetName)
	if err != nil {
		return err
	}

	statusCount := make(map[models.RecallStatus]int)
	for _, r := range results {
		statusCount[r.Status]++
	}

	headers := []string{"统计项", "数值"}
	for i, header := range headers {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheetName, cell, header)
	}

	data := [][]interface{}{
		{"报告生成时间", time.Now().Format("2006-01-02 15:04:05")},
		{"公告编号", notice.NoticeNo},
		{"涉事批号", notice.BatchNumber},
		{"追溯总记录数", len(results)},
		{"待处理数", statusCount[models.StatusPending]},
		{"已确认数", statusCount[models.StatusConfirmed]},
		{"已驳回数", statusCount[models.StatusRejected]},
		{"已解决数", statusCount[models.StatusResolved]},
		{"已撤回数", statusCount[models.StatusWithdrawn]},
		{"涉及患者人数", countUniquePatients(results)},
	}

	for i, row := range data {
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", i+2), row[0])
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", i+2), row[1])
	}

	style, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#E0E0E0"}, Pattern: 1},
	})
	f.SetRowStyle(sheetName, 1, 1, style)
	f.SetColWidth(sheetName, "A", "A", 20)
	f.SetColWidth(sheetName, "B", "B", 30)

	return nil
}

func countUniquePatients(results []models.TraceResult) int {
	patientMap := make(map[uint]bool)
	for _, r := range results {
		patientMap[r.PatientID] = true
	}
	return len(patientMap)
}
func (s *ReportService) GenerateRecallReport(recallID string) (string, error) {
	var notice models.RecallNotice
	if err := database.DB.Where("id = ?", recallID).First(&notice).Error; err != nil {
		return "", err
	}

	var results []models.TraceResult
	if err := database.DB.Where("recall_id = ?", recallID).
		Preload("Patient").
		Preload("Shift").
		Preload("Consumption").
		Find(&results).Error; err != nil {
		return "", err
	}

	f := excelize.NewFile()
	defer f.Close()

	summarySheet := "召回概览"
	f.SetSheetName("Sheet1", summarySheet)
	s.createSummarySheet(f, summarySheet, notice, results)

	detailSheet := "患者明细"
	f.NewSheet(detailSheet)
	s.createDetailSheet(f, detailSheet, results)

	reviewSheet := "复核记录"
	f.NewSheet(reviewSheet)
	s.createReviewSheet(f, reviewSheet, recallID)

	historySheet := "操作历史"
	f.NewSheet(historySheet)
	s.createHistorySheet(f, historySheet, recallID)

	filename := fmt.Sprintf("recall_report_%s_%s.xlsx", notice.NoticeNumber, time.Now().Format("20060102150405"))
	filepath := "./reports/" + filename

	if err := f.SaveAs(filepath); err != nil {
		return "", err
	}

	return filepath, nil
}

func (s *ReportService) createSummarySheet(f *excelize.File, sheetName string, notice models.RecallNotice, results []models.TraceResult) {
	headers := []string{"项目", "内容"}
	for i, h := range headers {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheetName, cell, h)
		f.SetCellStyle(sheetName, cell, cell, s.getHeaderStyle(f))
	}

	data := [][]interface{}{
		{"召回公告编号", notice.NoticeNumber},
		{"召回标题", notice.Title},
		{"发布机构", notice.Issuer},
		{"发布日期", notice.IssueDate.Format("2006-01-02")},
		{"截止日期", notice.Deadline.Format("2006-01-02")},
		{"当前状态", s.getStatusText(notice.Status)},
		{"涉及批号", notice.AffectedBatchs},
		{"追溯患者总数", len(results)},
		{"待确认", countByStatus(results, models.RecallStatusPending)},
		{"已确认", countByStatus(results, models.RecallStatusConfirmed)},
		{"已驳回", countByStatus(results, models.RecallStatusRejected)},
		{"已解决", countByStatus(results, models.RecallStatusResolved)},
		{"已撤回", countByStatus(results, models.RecallStatusWithdrawn)},
		{"存在冲突", countConflicts(results)},
		{"人工改判", countManualOverrides(results)},
	}

	for i, row := range data {
		for j, val := range row {
			cell := fmt.Sprintf("%c%d", 'A'+j, i+2)
			f.SetCellValue(sheetName, cell, val)
		}
	}

	f.SetColWidth(sheetName, "A", "A", 20)
	f.SetColWidth(sheetName, "B", "B", 60)
}

func (s *ReportService) createDetailSheet(f *excelize.File, sheetName string, results []models.TraceResult) {
	headers := []string{
		"序号", "患者ID", "患者姓名", "性别", "年龄",
		"涉及批号", "使用日期", "班次", "透析床号",
		"追溯状态", "是否冲突", "冲突原因",
		"人工改判", "改判人", "改判时间", "改判原因",
	}

	for i, h := range headers {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheetName, cell, h)
		f.SetCellStyle(sheetName, cell, cell, s.getHeaderStyle(f))
	}

	for idx, r := range results {
		row := idx + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), idx+1)
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), r.Patient.PatientID)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), r.Patient.Name)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), r.Patient.Gender)
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), r.Patient.Age)
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), r.BatchNumber)
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), r.Shift.ShiftDate.Format("2006-01-02"))
		f.SetCellValue(sheetName, fmt.Sprintf("H%d", row), r.Shift.ShiftName)
		f.SetCellValue(sheetName, fmt.Sprintf("I%d", row), r.Patient.BedNumber)
		f.SetCellValue(sheetName, fmt.Sprintf("J%d", row), s.getStatusText(r.Status))
		f.SetCellValue(sheetName, fmt.Sprintf("K%d", row), s.getYesNo(r.IsConflict))
		f.SetCellValue(sheetName, fmt.Sprintf("L%d", row), r.ConflictReason)
		f.SetCellValue(sheetName, fmt.Sprintf("M%d", row), s.getYesNo(r.ManualOverride))
		f.SetCellValue(sheetName, fmt.Sprintf("N%d", row), r.OverrideBy)
		if !r.OverrideAt.IsZero() {
			f.SetCellValue(sheetName, fmt.Sprintf("O%d", row), r.OverrideAt.Format("2006-01-02 15:04:05"))
		}
		f.SetCellValue(sheetName, fmt.Sprintf("P%d", row), r.OverrideReason)

		statusStyle := s.getStatusStyle(f, r.Status)
		f.SetCellStyle(sheetName, fmt.Sprintf("J%d", row), fmt.Sprintf("J%d", row), statusStyle)
	}

	for i := range headers {
		col := fmt.Sprintf("%c", 'A'+i)
		f.SetColWidth(sheetName, col, col, 15)
	}
}

func (s *ReportService) createReviewSheet(f *excelize.File, sheetName string, recallID string) {
	var reviews []models.ReviewRecord
	database.DB.Joins("JOIN trace_results ON trace_results.id = review_records.trace_result_id").
		Where("trace_results.recall_id = ?", recallID).
		Preload("TraceResult.Patient").
		Order("review_time DESC").
		Find(&reviews)

	headers := []string{"序号", "患者姓名", "复核人", "复核动作", "原状态", "新状态", "复核时间", "备注"}
	for i, h := range headers {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheetName, cell, h)
		f.SetCellStyle(sheetName, cell, cell, s.getHeaderStyle(f))
	}

	for idx, r := range reviews {
		row := idx + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), idx+1)
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), r.TraceResult.Patient.Name)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), r.Reviewer)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), r.ReviewAction)
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), s.getStatusText(models.RecallStatus(r.OldStatus)))
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), s.getStatusText(models.RecallStatus(r.NewStatus)))
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), r.ReviewTime.Format("2006-01-02 15:04:05"))
		f.SetCellValue(sheetName, fmt.Sprintf("H%d", row), r.Comments)
	}

	for i := range headers {
		col := fmt.Sprintf("%c", 'A'+i)
		f.SetColWidth(sheetName, col, col, 18)
	}
}

func (s *ReportService) createHistorySheet(f *excelize.File, sheetName string, recallID string) {
	var history []models.TraceHistory
	database.DB.Where("recall_id = ?", recallID).
		Order("action_time DESC").
		Find(&history)

	headers := []string{"序号", "操作类型", "操作人", "操作时间", "描述", "影响数量"}
	for i, h := range headers {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheetName, cell, h)
		f.SetCellStyle(sheetName, cell, cell, s.getHeaderStyle(f))
	}

	for idx, h := range history {
		row := idx + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), idx+1)
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), h.ActionType)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), h.Operator)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), h.ActionTime.Format("2006-01-02 15:04:05"))
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), h.Description)
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), h.AffectedCount)
	}

	for i := range headers {
		col := fmt.Sprintf("%c", 'A'+i)
		f.SetColWidth(sheetName, col, col, 20)
	}
}

func (s *ReportService) getHeaderStyle(f *excelize.File) int {
	style, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"4472C4"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center"},
	})
	return style
}

func (s *ReportService) getStatusStyle(f *excelize.File, status models.RecallStatus) int {
	colorMap := map[models.RecallStatus]string{
		models.RecallStatusPending:   "FFD666",
		models.RecallStatusConfirmed: "70AD47",
		models.RecallStatusRejected:  "FF0000",
		models.RecallStatusResolved:  "2E75B6",
		models.RecallStatusWithdrawn: "808080",
	}
	color := colorMap[status]
	if color == "" {
		color = "FFFFFF"
	}
	style, _ := f.NewStyle(&excelize.Style{
		Fill:      excelize.Fill{Type: "pattern", Color: []string{color}, Pattern: 1},
		Font:      &excelize.Font{Color: "000000"},
		Alignment: &excelize.Alignment{Horizontal: "center"},
	})
	return style
}

func (s *ReportService) getStatusText(status models.RecallStatus) string {
	textMap := map[models.RecallStatus]string{
		models.RecallStatusPending:   "待确认",
		models.RecallStatusConfirmed: "已确认",
		models.RecallStatusRejected:  "已驳回",
		models.RecallStatusResolved:  "已解决",
		models.RecallStatusWithdrawn: "已撤回",
	}
	if text, ok := textMap[status]; ok {
		return text
	}
	return string(status)
}

func (s *ReportService) getYesNo(val bool) string {
	if val {
		return "是"
	}
	return "否"
}

func countByStatus(results []models.TraceResult, status models.RecallStatus) int {
	count := 0
	for _, r := range results {
		if r.Status == status {
			count++
		}
	}
	return count
}

func countConflicts(results []models.TraceResult) int {
	count := 0
	for _, r := range results {
		if r.IsConflict {
			count++
		}
	}
	return count
}

func countManualOverrides(results []models.TraceResult) int {
	count := 0
	for _, r := range results {
		if r.ManualOverride {
			count++
		}
	}
	return count
}
