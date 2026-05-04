package exporter

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"memreplay/internal/models"
	"os"
	"sort"
	"strings"
	"time"
)

type Exporter struct{}

func NewExporter() *Exporter {
	return &Exporter{}
}

func (e *Exporter) ExportToMarkdown(analysis *models.AnalysisResult, outputPath string) error {
	content := e.generateMarkdownReport(analysis)
	return os.WriteFile(outputPath, []byte(content), 0644)
}

func (e *Exporter) ExportToJSON(analysis *models.AnalysisResult, outputPath string) error {
	data, err := json.MarshalIndent(analysis, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化 JSON 失败: %w", err)
	}
	return os.WriteFile(outputPath, data, 0644)
}

func (e *Exporter) ExportToCSV(analysis *models.AnalysisResult, outputPath string) error {
	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("创建文件失败: %w", err)
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	if err := writer.Write([]string{"类别", "标题", "描述", "置信度", "严重程度", "来源"}); err != nil {
		return fmt.Errorf("写入 CSV 表头失败: %w", err)
	}

	for _, finding := range analysis.Findings {
		if err := writer.Write([]string{
			finding.Category,
			finding.Title,
			finding.Description,
			fmt.Sprintf("%.2f", finding.Confidence),
			finding.Severity,
			finding.Source,
		}); err != nil {
			return fmt.Errorf("写入 CSV 行失败: %w", err)
		}
	}

	return nil
}

func (e *Exporter) ExportCompareToMarkdown(compare *models.CompareResult, outputPath string) error {
	content := e.generateCompareMarkdownReport(compare)
	return os.WriteFile(outputPath, []byte(content), 0644)
}

func (e *Exporter) ExportSimulationToMarkdown(params *models.SimulationParams, result *models.SimulationResult, outputPath string) error {
	content := e.generateSimulationMarkdownReport(params, result)
	return os.WriteFile(outputPath, []byte(content), 0644)
}

func (e *Exporter) generateMarkdownReport(analysis *models.AnalysisResult) string {
	var sb strings.Builder

	sb.WriteString("# 内存问题分析报告\n\n")
	sb.WriteString(fmt.Sprintf("生成时间: %s\n\n", time.Now().Format("2006-01-02 15:04:05")))

	sb.WriteString("## 结论\n\n")
	sb.WriteString(fmt.Sprintf("**风险等级**: %s\n\n", e.formatRiskLevel(analysis.RiskLevel)))
	sb.WriteString(fmt.Sprintf("**置信度**: %.2f%%\n\n", analysis.Confidence*100))
	sb.WriteString(fmt.Sprintf("%s\n\n", analysis.Conclusion))

	if len(analysis.Findings) > 0 {
		sb.WriteString("## 发现的问题\n\n")

		sort.Slice(analysis.Findings, func(i, j int) bool {
			severityOrder := map[string]int{"critical": 0, "high": 1, "medium": 2, "low": 3}
			return severityOrder[analysis.Findings[i].Severity] < severityOrder[analysis.Findings[j].Severity]
		})

		for i, finding := range analysis.Findings {
			sb.WriteString(fmt.Sprintf("### %d. %s\n\n", i+1, finding.Title))
			sb.WriteString(fmt.Sprintf("- **类别**: %s\n", finding.Category))
			sb.WriteString(fmt.Sprintf("- **严重程度**: %s\n", e.formatSeverity(finding.Severity)))
			sb.WriteString(fmt.Sprintf("- **置信度**: %.2f%%\n", finding.Confidence*100))
			sb.WriteString(fmt.Sprintf("- **来源**: %s\n\n", finding.Source))
			sb.WriteString(fmt.Sprintf("**描述**: %s\n\n", finding.Description))
		}
	}

	if len(analysis.Evidence) > 0 {
		sb.WriteString("## 证据表\n\n")
		sb.WriteString("| 类型 | 值 | 详情 | 来源 |\n")
		sb.WriteString("|------|-----|------|------|\n")

		for _, evidence := range analysis.Evidence {
			sb.WriteString(fmt.Sprintf("| %s | %s | %s | %s |\n",
				evidence.Type, evidence.Value, evidence.Details, evidence.Source))
		}
		sb.WriteString("\n")
	}

	if len(analysis.Recommendations) > 0 {
		sb.WriteString("## 建议动作\n\n")

		for i, rec := range analysis.Recommendations {
			sb.WriteString(fmt.Sprintf("### %d. [%s] %s\n\n", i+1, rec.Priority, rec.Action))
			if rec.Details != "" {
				sb.WriteString(fmt.Sprintf("%s\n\n", rec.Details))
			}
		}
	}

	sb.WriteString("## 复测命令\n\n")
	sb.WriteString("```bash\n")
	sb.WriteString(fmt.Sprintf("# 重新分析该批次\n"))
	sb.WriteString(fmt.Sprintf("memreplay analyze --batch %s\n", analysis.BatchID))
	sb.WriteString(fmt.Sprintf("\n# 导出新的报告\n"))
	sb.WriteString(fmt.Sprintf("memreplay export --batch %s --format markdown --output ./new-report.md\n", analysis.BatchID))
	sb.WriteString("```\n\n")

	return sb.String()
}

func (e *Exporter) generateCompareMarkdownReport(compare *models.CompareResult) string {
	var sb strings.Builder

	sb.WriteString("# 批次对比报告\n\n")
	sb.WriteString(fmt.Sprintf("生成时间: %s\n\n", time.Now().Format("2006-01-02 15:04:05")))

	sb.WriteString("## 基本信息\n\n")
	sb.WriteString(fmt.Sprintf("- **基线批次**: %s\n", compare.BaseBatchID))
	sb.WriteString(fmt.Sprintf("- **目标批次**: %s\n\n", compare.TargetBatchID))

	sb.WriteString("## 结论\n\n")
	sb.WriteString(fmt.Sprintf("**置信度**: %.2f%%\n\n", compare.Confidence*100))
	sb.WriteString(fmt.Sprintf("%s\n\n", compare.Conclusion))

	if len(compare.Differences) > 0 {
		sb.WriteString("## 差异分析\n\n")

		sort.Slice(compare.Differences, func(i, j int) bool {
			importanceOrder := map[string]int{"high": 0, "medium": 1, "low": 2}
			return importanceOrder[compare.Differences[i].Importance] < importanceOrder[compare.Differences[j].Importance]
		})

		sb.WriteString("| 类别 | 指标 | 基线值 | 目标值 | 变化(%) | 重要性 | 描述 |\n")
		sb.WriteString("|------|------|--------|--------|---------|--------|------|\n")

		for _, diff := range compare.Differences {
			changeSymbol := ""
			if diff.ChangePct > 0 {
				changeSymbol = "+"
			}
			sb.WriteString(fmt.Sprintf("| %s | %s | %s | %s | %s%.2f%% | %s | %s |\n",
				diff.Category, diff.Metric, diff.BaseValue, diff.TargetValue,
				changeSymbol, diff.ChangePct, e.formatImportance(diff.Importance), diff.Description))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("## 复测命令\n\n")
	sb.WriteString("```bash\n")
	sb.WriteString(fmt.Sprintf("# 重新对比两个批次\n"))
	sb.WriteString(fmt.Sprintf("memreplay compare --base %s --target %s\n", compare.BaseBatchID, compare.TargetBatchID))
	sb.WriteString(fmt.Sprintf("\n# 导出对比报告\n"))
	sb.WriteString(fmt.Sprintf("memreplay export --base %s --target %s --format markdown --output ./compare-report.md\n",
		compare.BaseBatchID, compare.TargetBatchID))
	sb.WriteString("```\n\n")

	return sb.String()
}

func (e *Exporter) generateSimulationMarkdownReport(params *models.SimulationParams, result *models.SimulationResult) string {
	var sb strings.Builder

	sb.WriteString("# 模拟分析报告\n\n")
	sb.WriteString(fmt.Sprintf("生成时间: %s\n\n", time.Now().Format("2006-01-02 15:04:05")))

	sb.WriteString("## 结论\n\n")
	sb.WriteString(fmt.Sprintf("**风险等级**: %s\n\n", e.formatRiskLevel(result.RiskLevel)))
	sb.WriteString(fmt.Sprintf("%s\n\n", result.Conclusion))

	if len(result.Warnings) > 0 {
		sb.WriteString("## 警告\n\n")
		for i, warning := range result.Warnings {
			sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, warning))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("## 模拟参数\n\n")
	sb.WriteString("| 参数 | 值 |\n")
	sb.WriteString("|------|-----|\n")

	for key, value := range params.Params {
		sb.WriteString(fmt.Sprintf("| %s | %v |\n", key, value))
	}
	sb.WriteString("\n")

	sb.WriteString("## 预测指标\n\n")
	sb.WriteString("| 指标 | 值 |\n")
	sb.WriteString("|------|-----|\n")

	for key, value := range result.Metrics {
		switch v := value.(type) {
		case float64:
			sb.WriteString(fmt.Sprintf("| %s | %.4f |\n", key, v))
		case int:
			sb.WriteString(fmt.Sprintf("| %s | %d |\n", key, v))
		default:
			sb.WriteString(fmt.Sprintf("| %s | %v |\n", key, v))
		}
	}
	sb.WriteString("\n")

	sb.WriteString("## 复测命令\n\n")
	sb.WriteString("```bash\n")
	sb.WriteString("# 使用相同参数重新模拟\n")
	sb.WriteString(fmt.Sprintf("memreplay simulate "))

	if params.Params["cache_ttl_seconds"] != nil {
		sb.WriteString(fmt.Sprintf("--cache-ttl %.0f ", params.Params["cache_ttl_seconds"].(float64)))
	}
	if params.Params["max_cache_size"] != nil {
		sb.WriteString(fmt.Sprintf("--max-cache-size %.0f ", params.Params["max_cache_size"].(float64)))
	}
	if params.Params["worker_count"] != nil {
		sb.WriteString(fmt.Sprintf("--worker-count %.0f ", params.Params["worker_count"].(float64)))
	}
	if params.Params["gc_percent"] != nil {
		sb.WriteString(fmt.Sprintf("--gc-percent %.0f ", params.Params["gc_percent"].(float64)))
	}
	if params.Params["request_rate"] != nil {
		sb.WriteString(fmt.Sprintf("--request-rate %.0f ", params.Params["request_rate"].(float64)))
	}
	sb.WriteString("\n```\n\n")

	return sb.String()
}

func (e *Exporter) formatRiskLevel(level string) string {
	switch level {
	case "critical":
		return "🔴 严重"
	case "high":
		return "🟠 高"
	case "medium":
		return "🟡 中"
	case "low":
		return "🟢 低"
	case "none":
		return "✅ 无"
	default:
		return level
	}
}

func (e *Exporter) formatSeverity(severity string) string {
	switch severity {
	case "critical":
		return "严重"
	case "high":
		return "高"
	case "medium":
		return "中"
	case "low":
		return "低"
	default:
		return severity
	}
}

func (e *Exporter) formatImportance(importance string) string {
	switch importance {
	case "high":
		return "高"
	case "medium":
		return "中"
	case "low":
		return "低"
	default:
		return importance
	}
}
