package service

import (
	"compliance-exemption-api/internal/model"
	"compliance-exemption-api/internal/repository"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/xuri/excelize/v2"
)

type ReportService interface {
	ExportExcel() (string, error)
	GenerateStatisticsReport() (*model.StatisticsSummary, []model.Exemption, error)
}

type reportService struct {
	exemptionRepo repository.ExemptionRepository
	reportPath    string
}

func NewReportService(exemptionRepo repository.ExemptionRepository, reportPath string) ReportService {
	return &reportService{
		exemptionRepo: exemptionRepo,
		reportPath:    reportPath,
	}
}

func (s *reportService) ExportExcel() (string, error) {
	if err := os.MkdirAll(s.reportPath, 0755); err != nil {
		return "", err
	}

	exemptions, err := s.exemptionRepo.GetAllForExport()
	if err != nil {
		return "", err
	}

	f := excelize.NewFile()
	sheetName := "豁免记录"
	f.SetSheetName("Sheet1", sheetName)

	headers := []string{
		"ID", "话术版本", "通话ID", "坐席ID", "豁免原因",
		"状态", "主管ID", "主管姓名", "审批意见", "到期时间",
		"创建人", "创建时间", "更新时间", "样本数量", "审批历史",
	}

	style, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#E0E0E0"}, Pattern: 1},
	})

	for col, header := range headers {
		cell := fmt.Sprintf("%c1", 'A'+col)
		f.SetCellValue(sheetName, cell, header)
		f.SetCellStyle(sheetName, cell, cell, style)
	}

	for i, ex := range exemptions {
		row := i + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), ex.ID)
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), ex.ScriptVersion)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), ex.CallID)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), ex.AgentID)
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), ex.ExemptionReason)
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), ex.Status)
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), ex.SupervisorID)
		f.SetCellValue(sheetName, fmt.Sprintf("H%d", row), ex.SupervisorName)
		f.SetCellValue(sheetName, fmt.Sprintf("I%d", row), ex.ApprovalComment)
		if ex.ExpireAt != nil {
			f.SetCellValue(sheetName, fmt.Sprintf("J%d", row), ex.ExpireAt.Format("2006-01-02 15:04:05"))
		}
		f.SetCellValue(sheetName, fmt.Sprintf("K%d", row), ex.CreatedBy)
		f.SetCellValue(sheetName, fmt.Sprintf("L%d", row), ex.CreatedAt.Format("2006-01-02 15:04:05"))
		f.SetCellValue(sheetName, fmt.Sprintf("M%d", row), ex.UpdatedAt.Format("2006-01-02 15:04:05"))
		f.SetCellValue(sheetName, fmt.Sprintf("N%d", row), len(ex.Samples))
		
		history := ""
		for _, log := range ex.ApprovalHistory {
			history += fmt.Sprintf("%s(%s):%s, ", log.SupervisorName, log.Action, log.Comment)
		}
		f.SetCellValue(sheetName, fmt.Sprintf("O%d", row), history)
	}

	for col := range headers {
		colName := fmt.Sprintf("%c", 'A'+col)
		f.SetColWidth(sheetName, colName, colName, 18)
	}

	statsSheet := "统计概览"
	f.NewSheet(statsSheet)
	stats, err := s.exemptionRepo.GetStatistics()
	if err == nil {
		statsHeaders := []string{"统计项", "数量"}
		for col, header := range statsHeaders {
			cell := fmt.Sprintf("%c1", 'A'+col)
			f.SetCellValue(statsSheet, cell, header)
			f.SetCellStyle(statsSheet, cell, cell, style)
		}

		statsData := []struct {
			name  string
			value int64
		}{
			{"总记录数", stats.TotalCount},
			{"待审批", stats.PendingCount},
			{"已通过", stats.ApprovedCount},
			{"已拒绝", stats.RejectedCount},
			{"已过期", stats.ExpiredCount},
			{"主管冲突数", stats.ConflictCount},
			{"无样本数", stats.NoSampleCount},
		}

		for i, data := range statsData {
			row := i + 2
			f.SetCellValue(statsSheet, fmt.Sprintf("A%d", row), data.name)
			f.SetCellValue(statsSheet, fmt.Sprintf("B%d", row), data.value)
		}

		f.SetColWidth(statsSheet, "A", "A", 15)
		f.SetColWidth(statsSheet, "B", "B", 10)
	}

	fileName := fmt.Sprintf("豁免报告_%s.xlsx", time.Now().Format("20060102_150405"))
	filePath := filepath.Join(s.reportPath, fileName)

	if err := f.SaveAs(filePath); err != nil {
		return "", err
	}

	return filePath, nil
}

func (s *reportService) GenerateStatisticsReport() (*model.StatisticsSummary, []model.Exemption, error) {
	stats, err := s.exemptionRepo.GetStatistics()
	if err != nil {
		return nil, nil, err
	}

	exemptions, err := s.exemptionRepo.GetAllForExport()
	if err != nil {
		return nil, nil, err
	}

	return stats, exemptions, nil
}
