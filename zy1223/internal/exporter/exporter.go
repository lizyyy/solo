package exporter

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"go-iface-analyzer/internal/models"
)

type ExportFormat string

const (
	FormatMarkdown ExportFormat = "markdown"
	FormatJSON     ExportFormat = "json"
)

type Report struct {
	Session   *models.AnalysisSession `json:"session"`
	Cases     []*models.InterfaceCase `json:"cases"`
	Issues    []*models.AnalysisIssue `json:"issues"`
	Generated time.Time                `json:"generated"`
}

func ExportToMarkdown(report *Report, outputPath string) error {
	var content string

	content += "# Go Interface 底层原理分析报告\n\n"
	content += fmt.Sprintf("**生成时间**: %s\n\n", report.Generated.Format("2006-01-02 15:04:05"))
	content += "---\n\n"

	content += "## 会话概览\n\n"
	content += "| 项目 | 值 |\n"
	content += "|------|----|\n"
	content += fmt.Sprintf("| 会话 ID | %d |\n", report.Session.ID)
	content += fmt.Sprintf("| 开始时间 | %s |\n", report.Session.StartTime.Format("2006-01-02 15:04:05"))
	if !report.Session.EndTime.IsZero() {
		content += fmt.Sprintf("| 结束时间 | %s |\n", report.Session.EndTime.Format("2006-01-02 15:04:05"))
		content += fmt.Sprintf("| 耗时 | %s |\n", report.Session.EndTime.Sub(report.Session.StartTime).Round(time.Millisecond).String())
	}
	content += fmt.Sprintf("| 状态 | %s |\n", report.Session.Status)
	content += fmt.Sprintf("| 总案例数 | %d |\n", report.Session.TotalCases)
	content += fmt.Sprintf("| 发现问题数 | %d |\n", report.Session.IssuesFound)
	content += "\n"

	if len(report.Cases) > 0 {
		content += "## 分析案例\n\n"
		for i, c := range report.Cases {
			content += fmt.Sprintf("### 案例 %d: %s\n\n", i+1, c.CaseName)
			content += fmt.Sprintf("- **分类**: %s\n", c.Category)
			if c.Description != "" {
				content += fmt.Sprintf("- **描述**: %s\n", c.Description)
			}
			if c.SourceFile != "" {
				content += fmt.Sprintf("- **源文件**: %s:%d\n", c.SourceFile, c.LineNumber)
			}
			content += "\n"
		}
	}

	if len(report.Issues) > 0 {
		content += "## 发现的问题\n\n"

		severityStats := make(map[string]int)
		for _, issue := range report.Issues {
			severityStats[issue.Severity]++
		}

		content += "### 按严重程度统计\n\n"
		content += "| 严重程度 | 数量 |\n"
		content += "|----------|------|\n"
		for _, sev := range []string{"critical", "high", "medium", "low", "info"} {
			if count, ok := severityStats[sev]; ok {
				sevName := map[string]string{
					"critical": "严重",
					"high":     "高",
					"medium":   "中",
					"low":      "低",
					"info":     "信息",
				}
				content += fmt.Sprintf("| %s | %d |\n", sevName[sev], count)
			}
		}
		content += "\n"

		content += "### 问题详情\n\n"

		severityOrder := []string{"critical", "high", "medium", "low", "info"}
		for _, sev := range severityOrder {
			sevIssues := filterIssuesBySeverity(report.Issues, sev)
			if len(sevIssues) == 0 {
				continue
			}

			sevName := map[string]string{
				"critical": "严重",
				"high":     "高",
				"medium":   "中",
				"low":      "低",
				"info":     "信息",
			}

			content += fmt.Sprintf("#### [%s] 问题\n\n", sevName[sev])

			for j, issue := range sevIssues {
				content += fmt.Sprintf("##### %d. %s\n\n", j+1, issue.Description)
				content += fmt.Sprintf("- **类型**: %s\n", issue.IssueType)
				if issue.Location != "" {
					content += fmt.Sprintf("- **位置**: %s\n", issue.Location)
				}
				if issue.Suggestion != "" {
					content += fmt.Sprintf("- **建议**: %s\n", issue.Suggestion)
				}
				content += "\n"
			}
		}
	} else {
		content += "## 问题统计\n\n"
		content += "本次分析未发现问题。\n\n"
	}

	content += "---\n\n"
	content += "*此报告由 go-iface-analyzer 生成*\n"

	dir := filepath.Dir(outputPath)
	if dir != "." && dir != "" {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("创建输出目录失败: %w", err)
		}
	}

	return os.WriteFile(outputPath, []byte(content), 0644)
}

func ExportToJSON(report *Report, outputPath string) error {
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化 JSON 失败: %w", err)
	}

	dir := filepath.Dir(outputPath)
	if dir != "." && dir != "" {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("创建输出目录失败: %w", err)
		}
	}

	return os.WriteFile(outputPath, data, 0644)
}

func filterIssuesBySeverity(issues []*models.AnalysisIssue, severity string) []*models.AnalysisIssue {
	var filtered []*models.AnalysisIssue
	for _, issue := range issues {
		if issue.Severity == severity {
			filtered = append(filtered, issue)
		}
	}
	return filtered
}
