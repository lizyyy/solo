package services

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"customs-reconciliation/internal/models"
	"customs-reconciliation/internal/repository"
)

type ReportService struct {
	batchRepo       *repository.ReconciliationBatchRepository
	itemRepo        *repository.ReconciliationItemRepository
	discrepancyRepo *repository.DiscrepancyRepository
	reportRepo      *repository.ReportRepository
}

func NewReportService() *ReportService {
	return &ReportService{
		batchRepo:       repository.NewReconciliationBatchRepository(),
		itemRepo:        repository.NewReconciliationItemRepository(),
		discrepancyRepo: repository.NewDiscrepancyRepository(),
		reportRepo:      repository.NewReportRepository(),
	}
}

type ReportGenerationRequest struct {
	BatchID    string `json:"batch_id"`
	ReportType string `json:"report_type"`
	Format     string `json:"format"`
	GeneratedBy string `json:"generated_by"`
}

func (s *ReportService) GenerateReport(req *ReportGenerationRequest) (*models.Report, error) {
	if err := os.MkdirAll("reports", 0755); err != nil {
		return nil, err
	}

	items, err := s.itemRepo.GetByBatchID(req.BatchID)
	if err != nil {
		return nil, err
	}

	batch, err := s.batchRepo.GetByID(req.BatchID)
	if err != nil {
		return nil, err
	}

	discrepancies, err := s.discrepancyRepo.GetByBatchID(req.BatchID)
	if err != nil {
		return nil, err
	}

	timestamp := time.Now().Format("20060102_150405")
	reportName := fmt.Sprintf("%s_%s_%s", batch.Name, req.ReportType, timestamp)
	
	var filePath string
	var fileSize int64

	switch req.Format {
	case "csv":
		filePath, fileSize, err = s.generateCSVReport(items, discrepancies, reportName)
	case "json":
		filePath, fileSize, err = s.generateJSONReport(items, discrepancies, reportName, batch)
	default:
		return nil, fmt.Errorf("unsupported format: %s", req.Format)
	}

	if err != nil {
		return nil, err
	}

	report := &models.Report{
		BatchID:     req.BatchID,
		ReportType:  req.ReportType,
		ReportName:  reportName,
		GeneratedBy: req.GeneratedBy,
		GeneratedAt: time.Now(),
		FileFormat:  req.Format,
		FileSize:    fileSize,
		FilePath:    filePath,
	}

	if err := s.reportRepo.Create(report); err != nil {
		return nil, err
	}

	return report, nil
}

func (s *ReportService) generateCSVReport(items []*models.ReconciliationItem, discrepancies []*models.Discrepancy, reportName string) (string, int64, error) {
	filePath := filepath.Join("reports", reportName+".csv")
	file, err := os.Create(filePath)
	if err != nil {
		return "", 0, err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	headers := []string{
		"订单号", "物流单号", "HS编码", "商品名称", "品类",
		"数量", "申报金额", "币种", "人民币金额", "汇率",
		"适用税率", "预期税款", "申报税款", "税款差异",
		"有退单", "退单调整税款", "需补税款", "最终税款",
		"状态", "是否复核", "复核人", "复核时间", "复核备注",
	}
	if err := writer.Write(headers); err != nil {
		return "", 0, err
	}

	for _, item := range items {
		row := []string{
			item.OrderNo,
			item.TrackingNo,
			item.HSCode,
			item.ProductName,
			item.Category,
			strconv.Itoa(item.Quantity),
			item.DeclaredAmount.String(),
			item.DeclaredCurrency,
			item.DeclaredAmountCNY.String(),
			item.ExchangeRate.String(),
			item.ApplicableTaxRate.String(),
			item.ExpectedTaxAmount.String(),
			item.DeclaredTaxAmount.String(),
			item.TaxDifference.String(),
			strconv.FormatBool(item.HasReturnReceipt),
			item.ReturnAdjustedTax.String(),
			item.SupplementTaxNeeded.String(),
			item.FinalTaxAmount.String(),
			item.Status,
			strconv.FormatBool(item.IsReviewed),
			item.ReviewedBy,
			formatTime(item.ReviewedAt),
			item.ReviewNotes,
		}
		if err := writer.Write(row); err != nil {
			return "", 0, err
		}
	}

	if err := writer.Write([]string{}); err != nil {
		return "", 0, err
	}

	if err := writer.Write([]string{"=== 差异明细 ==="}); err != nil {
		return "", 0, err
	}

	discrepancyHeaders := []string{
		"订单号", "差异类型", "字段名", "预期值", "实际值", "差异",
		"说明", "来源", "是否已解决",
	}
	if err := writer.Write(discrepancyHeaders); err != nil {
		return "", 0, err
	}

	for _, d := range discrepancies {
		row := []string{
			d.OrderNo,
			d.DiscrepancyType,
			d.FieldName,
			d.ExpectedValue.String(),
			d.ActualValue.String(),
			d.Difference.String(),
			d.Explanation,
			d.Source,
			strconv.FormatBool(d.IsResolved),
		}
		if err := writer.Write(row); err != nil {
			return "", 0, err
		}
	}

	stat, err := file.Stat()
	if err != nil {
		return "", 0, err
	}

	return filePath, stat.Size(), nil
}

func (s *ReportService) generateJSONReport(items []*models.ReconciliationItem, discrepancies []*models.Discrepancy, reportName string, batch *models.ReconciliationBatch) (string, int64, error) {
	filePath := filepath.Join("reports", reportName+".json")
	
	reportData := map[string]interface{}{
		"batch_info": map[string]interface{}{
			"id":                  batch.ID,
			"name":                batch.Name,
			"status":              batch.Status,
			"total_items":         batch.DeclarationCount,
			"matched_count":       batch.MatchedCount,
			"discrepancy_count":   batch.DiscrepancyCount,
			"reviewed_count":      batch.ReviewedCount,
			"total_tax_expected":  batch.TotalTaxExpected,
			"total_tax_declared":  batch.TotalTaxDeclared,
			"total_tax_difference": batch.TotalTaxDifference,
			"processed_at":        batch.ProcessedAt,
			"completed_at":        batch.CompletedAt,
			"generated_at":        time.Now(),
		},
		"items":         items,
		"discrepancies": discrepancies,
	}

	data, err := json.MarshalIndent(reportData, "", "  ")
	if err != nil {
		return "", 0, err
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return "", 0, err
	}

	stat, err := os.Stat(filePath)
	if err != nil {
		return "", 0, err
	}

	return filePath, stat.Size(), nil
}

func (s *ReportService) GetBatchReports(batchID string) ([]*models.Report, error) {
	return s.reportRepo.GetByBatchID(batchID)
}

func (s *ReportService) GetReportFilePath(reportID string) (string, error) {
	reports, err := s.reportRepo.GetByBatchID("")
	if err != nil {
		return "", err
	}
	for _, r := range reports {
		if r.ID == reportID {
			return r.FilePath, nil
		}
	}
	return "", fmt.Errorf("report not found")
}

func formatTime(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format("2006-01-02 15:04:05")
}
