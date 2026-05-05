package exporter

import (
	"encoding/json"
	"fmt"
	"strings"

	"go-quality-scanner/internal/models"
)

// ExportToJSON 导出为 JSON 格式
func ExportToJSON(record *models.ScanRecord, config *models.ReportConfig) (string, error) {
	// 构建导出数据
	exportData := buildExportData(record, config)
	
	// 序列化为 JSON
	jsonData, err := json.MarshalIndent(exportData, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal JSON: %w", err)
	}
	
	return string(jsonData), nil
}

// ExportToMarkdown 导出为 Markdown 格式
func ExportToMarkdown(record *models.ScanRecord, config *models.ReportConfig) (string, error) {
	var builder strings.Builder
	
	// 标题
	builder.WriteString("# Go 代码质量扫描报告\n\n")
	builder.WriteString(fmt.Sprintf("## 项目信息\n\n"))
	builder.WriteString(fmt.Sprintf("- **项目名称**: %s\n", record.ProjectName))
	builder.WriteString(fmt.Sprintf("- **项目路径**: %s\n", record.ProjectPath))
	builder.WriteString(fmt.Sprintf("- **扫描状态**: %s\n", record.Status))
	builder.WriteString(fmt.Sprintf("- **扫描时间**: %s\n\n", record.CreatedAt.Format("2006-01-02 15:04:05")))
	
	// 摘要
	if config.IncludeSummary && record.ScanResult != nil && record.ScanResult.Summary != nil {
		summary := record.ScanResult.Summary
		builder.WriteString("## 扫描摘要\n\n")
		builder.WriteString(fmt.Sprintf("- **总问题数**: %d\n", summary.TotalIssues))
		builder.WriteString(fmt.Sprintf("- **严重问题**: %d\n", summary.CriticalIssues))
		builder.WriteString(fmt.Sprintf("- **高危问题**: %d\n", summary.HighIssues))
		builder.WriteString(fmt.Sprintf("- **中危问题**: %d\n", summary.MediumIssues))
		builder.WriteString(fmt.Sprintf("- **低危问题**: %d\n", summary.LowIssues))
		builder.WriteString(fmt.Sprintf("- **误报标记**: %d\n", summary.FalsePositives))
		builder.WriteString(fmt.Sprintf("- **已解决**: %d\n\n", summary.ResolvedIssues))
		
		// 质量评分
		totalActive := summary.CriticalIssues + summary.HighIssues + summary.MediumIssues + summary.LowIssues
		score := 100
		if totalActive > 0 {
			score = 100 - (summary.CriticalIssues*10 + summary.HighIssues*5 + summary.MediumIssues*3 + summary.LowIssues*1)
			if score < 0 {
				score = 0
			}
		}
		builder.WriteString(fmt.Sprintf("**质量评分**: %d/100\n\n", score))
	}
	
	// Go.mod 信息
	if config.IncludeDetails && record.ScanResult != nil && record.ScanResult.GoModInfo != nil {
		goMod := record.ScanResult.GoModInfo
		builder.WriteString("## Go.mod 信息\n\n")
		builder.WriteString(fmt.Sprintf("- **模块名**: %s\n", goMod.ModuleName))
		builder.WriteString(fmt.Sprintf("- **Go 版本**: %s\n\n", goMod.GoVersion))
		
		if len(goMod.Dependencies) > 0 {
			builder.WriteString("### 依赖列表\n\n")
			builder.WriteString("| 依赖路径 | 版本 | 间接依赖 |\n")
			builder.WriteString("|---------|------|----------|\n")
			for _, dep := range goMod.Dependencies {
				indirect := "否"
				if dep.Indirect {
					indirect = "是"
				}
				builder.WriteString(fmt.Sprintf("| %s | %s | %s |\n", dep.Path, dep.Version, indirect))
			}
			builder.WriteString("\n")
		}
	}
	
	// 问题详情
	if config.IncludeDetails && record.ScanResult != nil && len(record.ScanResult.Issues) > 0 {
		issues := filterIssues(record.ScanResult.Issues, config)
		
		if len(issues) > 0 {
			builder.WriteString("## 问题详情\n\n")
			
			// 按严重程度分组
			severityGroups := map[string][]*models.Issue{
				"critical": {},
				"high":     {},
				"medium":   {},
				"low":      {},
			}
			
			for _, issue := range issues {
				severityGroups[issue.Severity] = append(severityGroups[issue.Severity], issue)
			}
			
			// 按严重程度输出
			severityOrder := []string{"critical", "high", "medium", "low"}
			severityNames := map[string]string{
				"critical": "严重",
				"high":     "高危",
				"medium":   "中危",
				"low":      "低危",
			}
			
			for _, severity := range severityOrder {
				groupIssues := severityGroups[severity]
				if len(groupIssues) == 0 {
					continue
				}
				
				builder.WriteString(fmt.Sprintf("### %s 问题\n\n", severityNames[severity]))
				
				for i, issue := range groupIssues {
					builder.WriteString(fmt.Sprintf("#### %d. %s\n\n", i+1, issue.RuleType))
					builder.WriteString(fmt.Sprintf("- **文件**: %s\n", issue.File))
					builder.WriteString(fmt.Sprintf("- **行号**: %d\n", issue.Line))
					builder.WriteString(fmt.Sprintf("- **描述**: %s\n", issue.Description))
					builder.WriteString(fmt.Sprintf("- **消息**: %s\n", issue.Message))
					
					if issue.CodeSnippet != "" {
						builder.WriteString("\n**代码片段**:\n\n")
						builder.WriteString("```go\n")
						builder.WriteString(fmt.Sprintf("%s\n", issue.CodeSnippet))
						builder.WriteString("```\n")
					}
					
					if issue.IsFalsePositive {
						builder.WriteString(fmt.Sprintf("\n- **状态**: 已标记为误报\n"))
						builder.WriteString(fmt.Sprintf("- **误报原因**: %s\n", issue.FalsePositiveReason))
					} else if issue.Resolved {
						builder.WriteString(fmt.Sprintf("\n- **状态**: 已解决\n"))
					}
					
					builder.WriteString("\n")
				}
			}
		}
	}
	
	// 页脚
	builder.WriteString("---\n\n")
	builder.WriteString("*此报告由 Go 代码质量扫描器自动生成*\n")
	
	return builder.String(), nil
}

// buildExportData 构建导出数据
func buildExportData(record *models.ScanRecord, config *models.ReportConfig) map[string]interface{} {
	result := map[string]interface{}{
		"project_name": record.ProjectName,
		"project_path": record.ProjectPath,
		"status":       record.Status,
		"scan_time":    record.CreatedAt,
	}
	
	if record.ScanResult != nil {
		// 摘要
		if config.IncludeSummary && record.ScanResult.Summary != nil {
			result["summary"] = record.ScanResult.Summary
		}
		
		// Go.mod 信息
		if config.IncludeDetails && record.ScanResult.GoModInfo != nil {
			result["go_mod"] = map[string]interface{}{
				"module_name":  record.ScanResult.GoModInfo.ModuleName,
				"go_version":   record.ScanResult.GoModInfo.GoVersion,
				"dependencies": record.ScanResult.GoModInfo.Dependencies,
			}
		}
		
		// 问题
		if config.IncludeDetails && len(record.ScanResult.Issues) > 0 {
			issues := filterIssues(record.ScanResult.Issues, config)
			result["issues"] = issues
		}
	}
	
	return result
}

// filterIssues 过滤问题
func filterIssues(issues []*models.Issue, config *models.ReportConfig) []*models.Issue {
	var filtered []*models.Issue
	
	for _, issue := range issues {
		// 排除误报
		if config.ExcludeFalsePositive && issue.IsFalsePositive {
			continue
		}
		
		// 按严重程度过滤
		if len(config.FilterSeverity) > 0 {
			matched := false
			for _, severity := range config.FilterSeverity {
				if issue.Severity == severity {
					matched = true
					break
				}
			}
			if !matched {
				continue
			}
		}
		
		filtered = append(filtered, issue)
	}
	
	return filtered
}
