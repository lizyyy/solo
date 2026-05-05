package reporter

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"time"

	"go-policy-scanner/pkg/model"
)

type Report struct {
	ScanResult  *model.ScanResult   `json:"scan_result"`
	Violations  []model.Violation   `json:"violations"`
	GeneratedAt time.Time           `json:"generated_at"`
}

func GenerateJSON(result *model.ScanResult, violations []model.Violation) (string, error) {
	report := &Report{
		ScanResult:  result,
		Violations:  violations,
		GeneratedAt: time.Now(),
	}

	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal report: %w", err)
	}

	return string(data), nil
}

func ExportJSON(result *model.ScanResult, violations []model.Violation, outputPath string) error {
	jsonStr, err := GenerateJSON(result, violations)
	if err != nil {
		return err
	}

	return os.WriteFile(outputPath, []byte(jsonStr), 0644)
}

func GenerateMarkdown(result *model.ScanResult, violations []model.Violation) (string, error) {
	var md string

	md += "# Go Policy Scan Report\n\n"
	md += fmt.Sprintf("**生成时间**: %s\n\n", time.Now().Format("2006-01-02 15:04:05"))

	md += "## 扫描概要\n\n"
	md += "| 项目 | 值 |\n"
	md += "|------|-----|\n"
	md += fmt.Sprintf("| 扫描 ID | %d |\n", result.ID)
	md += fmt.Sprintf("| 仓库名称 | %s |\n", result.RepoName)
	md += fmt.Sprintf("| 扫描时间 | %s |\n", result.ScanTime.Format("2006-01-02 15:04:05"))
	md += "| 分支 | " + result.Branch + " |\n"
	md += "| 提交 | " + result.Commit + " |\n\n"

	md += "## 检查结果\n\n"
	md += "| 指标 | 数值 |\n"
	md += "|------|------|\n"
	md += fmt.Sprintf("| 总检查项 | %d |\n", result.Summary.TotalChecks)
	md += fmt.Sprintf("| 通过项 | %d |\n", result.Summary.PassedChecks)
	md += fmt.Sprintf("| 失败项 | %d |\n", result.Summary.FailedChecks)
	md += "\n"

	if len(result.Summary.ViolationsByType) > 0 {
		md += "### 违规类型统计\n\n"
		md += "| 违规类型 | 数量 |\n"
		md += "|----------|------|\n"

		for vType, count := range result.Summary.ViolationsByType {
			md += fmt.Sprintf("| %s | %d |\n", vType, count)
		}
		md += "\n"
	}

	if len(violations) > 0 {
		md += "## 违规详情\n\n"

		sortedViolations := sortViolations(violations)

		for i, v := range sortedViolations {
			severityEmoji := getSeverityEmoji(v.Severity)
			md += fmt.Sprintf("### %d. %s %s\n\n", i+1, severityEmoji, v.Message)
			md += fmt.Sprintf("- **类型**: %s\n", v.Type)
			md += fmt.Sprintf("- **严重程度**: %s\n", v.Severity)
			if v.File != "" {
				md += fmt.Sprintf("- **文件**: %s", v.File)
				if v.Line > 0 {
					md += fmt.Sprintf(":%d", v.Line)
				}
				md += "\n"
			}
			if v.Detail != "" {
				md += fmt.Sprintf("- **详情**: \n```\n%s\n```\n", v.Detail)
			}
			md += "\n"
		}
	} else {
		md += "## 🎉 恭喜\n\n"
		md += "本次扫描未发现任何违规项！\n\n"
	}

	md += "---\n\n"
	md += "*本报告由 go-policy-scanner 自动生成*\n"

	return md, nil
}

func ExportMarkdown(result *model.ScanResult, violations []model.Violation, outputPath string) error {
	mdStr, err := GenerateMarkdown(result, violations)
	if err != nil {
		return err
	}

	return os.WriteFile(outputPath, []byte(mdStr), 0644)
}

func GenerateCompareJSON(result *model.CompareResult) (string, error) {
	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal compare result: %w", err)
	}
	return string(data), nil
}

func ExportCompareJSON(result *model.CompareResult, outputPath string) error {
	jsonStr, err := GenerateCompareJSON(result)
	if err != nil {
		return err
	}
	return os.WriteFile(outputPath, []byte(jsonStr), 0644)
}

func GenerateCompareMarkdown(result *model.CompareResult) (string, error) {
	var md string

	md += "# 扫描对比报告\n\n"
	md += fmt.Sprintf("**生成时间**: %s\n\n", time.Now().Format("2006-01-02 15:04:05"))

	md += "## 对比概要\n\n"
	md += "| 项目 | 值 |\n"
	md += "|------|-----|\n"
	md += fmt.Sprintf("| 基准扫描 ID | %d |\n", result.BaseScanID)
	md += fmt.Sprintf("| 目标扫描 ID | %d |\n", result.TargetScanID)
	md += "\n"

	md += "## 变化统计\n\n"
	md += "| 指标 | 变化量 |\n"
	md += "|------|--------|\n"

	totalDiffStr := formatDiff(result.SummaryDiff.TotalDiff)
	passedDiffStr := formatDiff(result.SummaryDiff.PassedDiff)
	failedDiffStr := formatDiff(result.SummaryDiff.FailedDiff)

	md += fmt.Sprintf("| 总检查项 | %s |\n", totalDiffStr)
	md += fmt.Sprintf("| 通过项 | %s |\n", passedDiffStr)
	md += fmt.Sprintf("| 失败项 | %s |\n", failedDiffStr)
	md += "\n"

	md += "## 违规变化\n\n"
	md += "| 类型 | 数量 |\n"
	md += "|------|------|\n"
	md += fmt.Sprintf("| 新增违规 | %d |\n", len(result.NewViolations))
	md += fmt.Sprintf("| 已修复违规 | %d |\n", len(result.FixedViolations))
	md += "\n"

	if len(result.NewViolations) > 0 {
		md += "### 🆕 新增违规\n\n"
		for i, v := range result.NewViolations {
			md += fmt.Sprintf("%d. **%s** [%s] - %s\n",
				i+1, v.Severity, v.Type, v.Message)
			if v.File != "" {
				md += fmt.Sprintf("   文件: %s:%d\n", v.File, v.Line)
			}
			md += "\n"
		}
	}

	if len(result.FixedViolations) > 0 {
		md += "### ✅ 已修复违规\n\n"
		for i, v := range result.FixedViolations {
			md += fmt.Sprintf("%d. **%s** [%s] - %s\n",
				i+1, v.Severity, v.Type, v.Message)
			if v.File != "" {
				md += fmt.Sprintf("   文件: %s:%d\n", v.File, v.Line)
			}
			md += "\n"
		}
	}

	md += "---\n\n"
	md += "*本报告由 go-policy-scanner 自动生成*\n"

	return md, nil
}

func ExportCompareMarkdown(result *model.CompareResult, outputPath string) error {
	mdStr, err := GenerateCompareMarkdown(result)
	if err != nil {
		return err
	}
	return os.WriteFile(outputPath, []byte(mdStr), 0644)
}

func sortViolations(violations []model.Violation) []model.Violation {
	severityOrder := map[string]int{
		"critical": 0,
		"high":     1,
		"medium":   2,
		"low":      3,
	}

	sorted := make([]model.Violation, len(violations))
	copy(sorted, violations)

	sort.Slice(sorted, func(i, j int) bool {
		orderI := severityOrder[sorted[i].Severity]
		orderJ := severityOrder[sorted[j].Severity]
		if orderI == orderJ {
			return sorted[i].Type < sorted[j].Type
		}
		return orderI < orderJ
	})

	return sorted
}

func getSeverityEmoji(severity string) string {
	switch severity {
	case "critical":
		return "🔴"
	case "high":
		return "🟠"
	case "medium":
		return "🟡"
	case "low":
		return "🔵"
	default:
		return "⚪"
	}
}

func formatDiff(diff int) string {
	if diff > 0 {
		return fmt.Sprintf("+%d", diff)
	} else if diff < 0 {
		return fmt.Sprintf("%d", diff)
	}
	return "0"
}
