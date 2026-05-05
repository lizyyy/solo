package exporter

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"go-iface-analyzer/internal/models"
)

func createTestReport() *Report {
	return &Report{
		Session: &models.AnalysisSession{
			ID:          1,
			StartTime:   time.Date(2024, 1, 15, 10, 30, 0, 0, time.UTC),
			EndTime:     time.Date(2024, 1, 15, 10, 30, 5, 0, time.UTC),
			Status:      "completed",
			TotalCases:  2,
			IssuesFound: 3,
		},
		Cases: []*models.InterfaceCase{
			{
				ID:          1,
				CaseName:    "test_case_1",
				Category:    "eface_iface",
				Description: "测试案例1",
				SourceFile:  "test.go",
				LineNumber:  10,
			},
			{
				ID:          2,
				CaseName:    "test_case_2",
				Category:    "typed_nil",
				Description: "测试案例2",
				SourceFile:  "nil.go",
				LineNumber:  20,
			},
		},
		Issues: []*models.AnalysisIssue{
			{
				ID:          1,
				IssueType:   "typed_nil_bug",
				Severity:    "critical",
				Description: "发现 typed nil 风险",
				Location:    "nil.go:15",
				Suggestion:  "使用 reflect 检查值是否为 nil",
			},
			{
				ID:          2,
				IssueType:   "unsafe_type_assertion",
				Severity:    "high",
				Description: "发现不安全的类型断言",
				Location:    "assert.go:25",
				Suggestion:  "使用 comma-ok 模式",
			},
			{
				ID:          3,
				IssueType:   "boxing_allocation",
				Severity:    "medium",
				Description: "发现接口装箱分配",
				Location:    "alloc.go:10",
				Suggestion:  "考虑使用类型参数",
			},
		},
		Generated: time.Date(2024, 1, 15, 10, 30, 5, 0, time.UTC),
	}
}

func TestExportToMarkdown(t *testing.T) {
	tempDir := t.TempDir()
	outputPath := filepath.Join(tempDir, "report.md")

	report := createTestReport()

	if err := ExportToMarkdown(report, outputPath); err != nil {
		t.Fatalf("ExportToMarkdown 失败: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Markdown 文件应该已创建")
	}

	content, err := os.ReadFile(outputPath)
	if err != nil {
		t.Fatalf("读取输出文件失败: %v", err)
	}

	expectedContent := []string{
		"# Go Interface 底层原理分析报告",
		"会话 ID",
		"test_case_1",
		"test_case_2",
		"typed nil",
		"不安全的类型断言",
		"接口装箱分配",
		"【严重】",
		"【高】",
		"【中】",
	}

	for _, expected := range expectedContent {
		if !strings.Contains(string(content), expected) {
			t.Errorf("Markdown 内容应该包含 '%s'", expected)
		}
	}
}

func TestExportToJSON(t *testing.T) {
	tempDir := t.TempDir()
	outputPath := filepath.Join(tempDir, "report.json")

	report := createTestReport()

	if err := ExportToJSON(report, outputPath); err != nil {
		t.Fatalf("ExportToJSON 失败: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("JSON 文件应该已创建")
	}

	content, err := os.ReadFile(outputPath)
	if err != nil {
		t.Fatalf("读取输出文件失败: %v", err)
	}

	expectedContent := []string{
		"session",
		"cases",
		"issues",
		"test_case_1",
		"test_case_2",
		"typed_nil_bug",
		"unsafe_type_assertion",
		"boxing_allocation",
	}

	for _, expected := range expectedContent {
		if !strings.Contains(string(content), expected) {
			t.Errorf("JSON 内容应该包含 '%s'", expected)
		}
	}
}

func TestExportToMarkdown_CreateDirectory(t *testing.T) {
	tempDir := t.TempDir()
	subDir := filepath.Join(tempDir, "reports", "latest")
	outputPath := filepath.Join(subDir, "report.md")

	report := createTestReport()

	if err := ExportToMarkdown(report, outputPath); err != nil {
		t.Fatalf("ExportToMarkdown 失败: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Markdown 文件应该已创建在子目录中")
	}
}

func TestExportToJSON_CreateDirectory(t *testing.T) {
	tempDir := t.TempDir()
	subDir := filepath.Join(tempDir, "reports", "latest")
	outputPath := filepath.Join(subDir, "report.json")

	report := createTestReport()

	if err := ExportToJSON(report, outputPath); err != nil {
		t.Fatalf("ExportToJSON 失败: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("JSON 文件应该已创建在子目录中")
	}
}

func TestExportToMarkdown_EmptyReport(t *testing.T) {
	tempDir := t.TempDir()
	outputPath := filepath.Join(tempDir, "empty_report.md")

	report := &Report{
		Session: &models.AnalysisSession{
			ID:          1,
			StartTime:   time.Now(),
			Status:      "completed",
			TotalCases:  0,
			IssuesFound: 0,
		},
		Cases:     []*models.InterfaceCase{},
		Issues:    []*models.AnalysisIssue{},
		Generated: time.Now(),
	}

	if err := ExportToMarkdown(report, outputPath); err != nil {
		t.Fatalf("ExportToMarkdown 失败: %v", err)
	}

	content, err := os.ReadFile(outputPath)
	if err != nil {
		t.Fatalf("读取输出文件失败: %v", err)
	}

	if !strings.Contains(string(content), "未发现问题") {
		t.Error("空报告应该显示 '未发现问题'")
	}
}
