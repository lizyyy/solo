package service

import (
	"bytes"
	"fmt"
	"strings"
	"time"

	"device-borrow-system/internal/models"

	"github.com/xuri/excelize/v2"
)

func (s *ExportService) ExportToExcel(report *BorrowReport) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()

	f.SetCellValue("Sheet1", "A1", "设备借用报告")
	f.SetCellValue("Sheet1", "A2", fmt.Sprintf("生成时间: %s", report.GeneratedAt.Format("2006-01-02 15:04:05")))

	if report.StartDate != nil && report.EndDate != nil {
		f.SetCellValue("Sheet1", "A3", fmt.Sprintf("时间范围: %s 至 %s",
			report.StartDate.Format("2006-01-02"),
			report.EndDate.Format("2006-01-02")))
	}

	f.SetCellValue("Sheet1", "A5", "统计信息")
	f.SetCellValue("Sheet1", "A6", "总记录数")
	f.SetCellValue("Sheet1", "B6", report.Statistics.TotalRecords)
	f.SetCellValue("Sheet1", "A7", "借用中")
	f.SetCellValue("Sheet1", "B7", report.Statistics.ByStatus["borrowed"])
	f.SetCellValue("Sheet1", "A8", "已归还")
	f.SetCellValue("Sheet1", "B8", report.Statistics.ByStatus["returned"])
	f.SetCellValue("Sheet1", "A9", "逾期记录")
	f.SetCellValue("Sheet1", "B9", report.Statistics.OverdueCount)

	headers := []string{"设备ID", "借用人ID", "借用用途", "借用时间", "预计归还", "实际归还", "状态", "备注"}
	for i, header := range headers {
		cell := fmt.Sprintf("%c12", 'A'+i)
		f.SetCellValue("Sheet1", cell, header)
	}

	for i, record := range report.Records {
		row := i + 13
		f.SetCellValue("Sheet1", fmt.Sprintf("A%d", row), record.DeviceID.String())
		f.SetCellValue("Sheet1", fmt.Sprintf("B%d", row), record.BorrowerID.String())
		f.SetCellValue("Sheet1", fmt.Sprintf("C%d", row), record.Purpose)
		f.SetCellValue("Sheet1", fmt.Sprintf("D%d", row), record.BorrowDate.Format("2006-01-02 15:04:05"))

		if record.ExpectedReturnDate != nil {
			f.SetCellValue("Sheet1", fmt.Sprintf("E%d", row), record.ExpectedReturnDate.Format("2006-01-02 15:04:05"))
		}

		if record.ActualReturnDate != nil {
			f.SetCellValue("Sheet1", fmt.Sprintf("F%d", row), record.ActualReturnDate.Format("2006-01-02 15:04:05"))
		}

		f.SetCellValue("Sheet1", fmt.Sprintf("G%d", row), statusText(record.Status))
		f.SetCellValue("Sheet1", fmt.Sprintf("H%d", row), record.Notes)
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func (s *ExportService) ExportToMarkdown(report *BorrowReport) (string, error) {
	var sb strings.Builder

	sb.WriteString("# 设备借用报告\n\n")
	sb.WriteString(fmt.Sprintf("**生成时间**: %s\n\n", report.GeneratedAt.Format("2006-01-02 15:04:05")))

	if report.StartDate != nil && report.EndDate != nil {
		sb.WriteString(fmt.Sprintf("**时间范围**: %s 至 %s\n\n",
			report.StartDate.Format("2006-01-02"),
			report.EndDate.Format("2006-01-02")))
	}

	sb.WriteString("## 统计信息\n\n")
	sb.WriteString("| 指标 | 数量 |\n")
	sb.WriteString("|------|------|\n")
	sb.WriteString(fmt.Sprintf("| 总记录数 | %d |\n", report.Statistics.TotalRecords))
	sb.WriteString(fmt.Sprintf("| 借用中 | %d |\n", report.Statistics.ByStatus["borrowed"]))
	sb.WriteString(fmt.Sprintf("| 已归还 | %d |\n", report.Statistics.ByStatus["returned"]))
	sb.WriteString(fmt.Sprintf("| 逾期记录 | %d |\n\n", report.Statistics.OverdueCount))

	sb.WriteString("## 详细记录\n\n")
	sb.WriteString("| 设备ID | 借用人ID | 用途 | 借用时间 | 预计归还 | 实际归还 | 状态 | 备注 |\n")
	sb.WriteString("|--------|----------|------|----------|----------|----------|------|------|\n")

	for _, record := range report.Records {
		expectedReturn := "-"
		if record.ExpectedReturnDate != nil {
			expectedReturn = record.ExpectedReturnDate.Format("2006-01-02 15:04")
		}

		actualReturn := "-"
		if record.ActualReturnDate != nil {
			actualReturn = record.ActualReturnDate.Format("2006-01-02 15:04")
		}

		sb.WriteString(fmt.Sprintf("| %s | %s | %s | %s | %s | %s | %s | %s |\n",
			record.DeviceID.String()[:8],
			record.BorrowerID.String()[:8],
			truncate(record.Purpose, 20),
			record.BorrowDate.Format("2006-01-02 15:04"),
			expectedReturn,
			actualReturn,
			statusText(record.Status),
			truncate(record.Notes, 15),
		))
	}

	return sb.String(), nil
}

func (s *ExportService) ExportToPDF(report *BorrowReport) ([]byte, error) {
	markdown, err := s.ExportToMarkdown(report)
	if err != nil {
		return nil, err
	}

	return s.markdownToPDF(markdown)
}

func (s *ExportService) markdownToPDF(markdown string) ([]byte, error) {
	var buf bytes.Buffer

	buf.WriteString("%PDF-1.4\n")
	buf.WriteString("1 0 obj\n")
	buf.WriteString("<< /Type /Catalog /Pages 2 0 R >>\n")
	buf.WriteString("endobj\n")
	buf.WriteString("2 0 obj\n")
	buf.WriteString("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n")
	buf.WriteString("endobj\n")
	buf.WriteString("3 0 obj\n")
	buf.WriteString("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\n")
	buf.WriteString("endobj\n")

	lines := strings.Split(markdown, "\n")
	var contentLines []string
	y := 750
	for _, line := range lines {
		if y < 50 {
			break
		}
		escaped := strings.ReplaceAll(line, "(", "\\(")
		escaped = strings.ReplaceAll(escaped, ")", "\\)")
		contentLines = append(contentLines, fmt.Sprintf("BT /F1 10 Tf 50 %d Tf 50 %d Td (%s) Tj ET", y, y, escaped))
		y -= 15
	}

	content := strings.Join(contentLines, "\n")
	buf.WriteString(fmt.Sprintf("4 0 obj\n<< /Length %d >>\nstream\n%s\nendstream\nendobj\n", len(content), content))
	buf.WriteString("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n")
	buf.WriteString("endobj\n")
	buf.WriteString("xref\n0 6\n")
	buf.WriteString("0000000000 65535 f \n")
	buf.WriteString("0000000010 00000 n \n")
	buf.WriteString("0000000060 00000 n \n")
	buf.WriteString("0000000115 00000 n \n")
	buf.WriteString("0000000240 00000 n \n")
	buf.WriteString("0000000350 00000 n \n")
	buf.WriteString("trailer\n<< /Size 6 /Root 1 0 R >>\n")
	buf.WriteString("startxref\n")
	buf.WriteString("400\n")
	buf.WriteString("%%EOF")

	return buf.Bytes(), nil
}

func statusText(status string) string {
	switch status {
	case "borrowed":
		return "借用中"
	case "returned":
		return "已归还"
	case "overdue":
		return "已逾期"
	default:
		return status
	}
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}

var _ = time.Now
