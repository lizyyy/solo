package closer

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"prescription-timeline/database"
	"prescription-timeline/models"
	"prescription-timeline/services/validator"
	"time"
)

type CloserService struct {
	validator *validator.ValidatorService
}

func New(validator *validator.ValidatorService) *CloserService {
	return &CloserService{validator: validator}
}

type ClosePrescriptionRequest struct {
	PrescriptionID  string
	FinalConclusion string
	OperatorID      string
	OperatorName    string
}

func (c *CloserService) ClosePrescription(req *ClosePrescriptionRequest) (*models.PrescriptionReport, error) {
	prescription, err := database.GetPrescriptionByID(req.PrescriptionID)
	if err != nil {
		return nil, err
	}

	report, err := database.GetReportByPrescriptionID(req.PrescriptionID)
	if err != nil {
		return nil, err
	}

	validation, _ := c.validator.ValidatePrescription(req.PrescriptionID)

	report.HasTimeout = !validation.TimeoutCheck.Passed
	report.TimeoutDetails = validation.TimeoutCheck.Message
	report.HasPatientUnconfirmed = !validation.PatientConfirmCheck.Passed
	report.HasDuplicateRisk = !validation.DuplicateCheck.Passed

	if len(validation.Suggestions) > 0 {
		report.ProcessingSuggestion = fmt.Sprintf("处理建议: %v", validation.Suggestions)
	} else {
		report.ProcessingSuggestion = "处方流程正常"
	}

	report.FinalConclusion = req.FinalConclusion
	report.OperatorID = req.OperatorID
	report.OperatorName = req.OperatorName

	totalTime := time.Since(prescription.PrescriptionTime).Minutes()
	report.TotalTimeMinutes = int(totalTime)

	now := time.Now()
	report.ClosedAt = &now
	report.UpdatedAt = now

	if err := database.UpdatePrescriptionReport(report); err != nil {
		return nil, err
	}

	prescription.Status = models.PrescriptionStatusClosed
	prescription.UpdatedAt = now
	if err := database.UpdatePrescription(prescription); err != nil {
		return nil, err
	}

	return report, nil
}

func (c *CloserService) GetReport(prescriptionID string) (*models.PrescriptionReport, error) {
	return database.GetReportByPrescriptionID(prescriptionID)
}

func (c *CloserService) ExportReportJSON(prescriptionID string) (string, error) {
	report, err := database.GetReportByPrescriptionID(prescriptionID)
	if err != nil {
		return "", err
	}

	prescription, err := database.GetPrescriptionByID(prescriptionID)
	if err != nil {
		return "", err
	}

	patient, err := database.GetPatientByID(report.PatientID)
	if err != nil {
		return "", err
	}

	reviews, _ := database.GetReviewsByPrescriptionID(prescriptionID)
	dispensations, _ := database.GetDispensationsByPrescriptionID(prescriptionID)
	supplements, _ := database.GetSupplementsByPrescriptionID(prescriptionID)
	logs, _ := database.GetLogsByPrescriptionID(prescriptionID)

	fullReport := map[string]interface{}{
		"report":         report,
		"prescription":   prescription,
		"patient":        patient,
		"reviews":        reviews,
		"dispensations":  dispensations,
		"supplements":    supplements,
		"processing_logs": logs,
		"export_time":    time.Now(),
	}

	jsonData, err := json.MarshalIndent(fullReport, "", "  ")
	if err != nil {
		return "", err
	}

	return string(jsonData), nil
}

func (c *CloserService) ExportReportCSV(closedOnly bool) ([][]string, error) {
	reports, err := database.ListReports(closedOnly)
	if err != nil {
		return nil, err
	}

	header := []string{
		"报告ID", "处方ID", "问诊ID", "患者ID",
		"总耗时(分钟)", "医生开方时间", "患者确认时间", "审核时间", "发药时间",
		"是否超时", "超时详情", "患者未确认", "重复发药风险",
		"处理建议", "最终结论", "操作人ID", "操作人", "结案时间", "创建时间",
	}

	records := [][]string{header}

	for _, report := range reports {
		row := []string{
			report.ID,
			report.PrescriptionID,
			report.ConsultationID,
			report.PatientID,
			fmt.Sprintf("%d", report.TotalTimeMinutes),
			report.DoctorAdviceTime.Format("2006-01-02 15:04:05"),
			formatTime(report.PatientConfirmTime),
			formatTime(report.ReviewTime),
			formatTime(report.DispensationTime),
			fmt.Sprintf("%t", report.HasTimeout),
			report.TimeoutDetails,
			fmt.Sprintf("%t", report.HasPatientUnconfirmed),
			fmt.Sprintf("%t", report.HasDuplicateRisk),
			report.ProcessingSuggestion,
			report.FinalConclusion,
			report.OperatorID,
			report.OperatorName,
			formatTime(report.ClosedAt),
			report.CreatedAt.Format("2006-01-02 15:04:05"),
		}
		records = append(records, row)
	}

	return records, nil
}

func (c *CloserService) GenerateCSVFile(closedOnly bool, filePath string) error {
	records, err := c.ExportReportCSV(closedOnly)
	if err != nil {
		return err
	}

	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	return writer.WriteAll(records)
}

func (c *CloserService) ListReports(closedOnly bool) ([]models.PrescriptionReport, error) {
	return database.ListReports(closedOnly)
}

func (c *CloserService) GenerateProcessingSuggestion(prescriptionID string) (string, error) {
	validation, err := c.validator.ValidatePrescription(prescriptionID)
	if err != nil {
		return "", err
	}

	if validation.TotalIssues == 0 {
		return "处方状态正常，可以继续发药流程", nil
	}

	suggestion := fmt.Sprintf("发现 %d 个问题:\n", validation.TotalIssues)
	for i, s := range validation.Suggestions {
		suggestion += fmt.Sprintf("%d. %s\n", i+1, s)
	}

	if !validation.TimeoutCheck.Passed {
		suggestion += "\n建议: 优先处理超时问题，可联系患者确认是否仍需用药，或取消处方重新开方。"
	}

	if !validation.PatientConfirmCheck.Passed {
		suggestion += "\n建议: 通过短信/APP推送提醒患者确认处方。"
	}

	if !validation.DuplicateCheck.Passed {
		suggestion += "\n建议: 核查发药记录，确认是否为重复发药，必要时进行人工干预。"
	}

	return suggestion, nil
}

func formatTime(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format("2006-01-02 15:04:05")
}
