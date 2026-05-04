package exporter

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"concurrency-detector/internal/models"
)

type ExportConfig struct {
	Format          string
	IncludeEvidence bool
	IncludeSuggestions bool
}

type ExportResult struct {
	Format string
	Data   []byte
}

type ProjectReport struct {
	Project       *models.Project
	Stats         map[string]interface{}
	AnalysisResults []*models.AnalysisResult
	GeneratedAt   time.Time
}

func ExportJSON(report *ProjectReport) (*ExportResult, error) {
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return nil, err
	}

	return &ExportResult{
		Format: "json",
		Data:   data,
	}, nil
}

func ExportCSV(report *ProjectReport) (*ExportResult, error) {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	headers := []string{
		"Category", "Severity", "Title", "Description",
		"Evidence Count", "Created At",
	}
	_ = writer.Write(headers)

	for _, r := range report.AnalysisResults {
		row := []string{
			string(r.Category),
			string(r.Severity),
			r.Title,
			escapeCSV(r.Description),
			fmt.Sprintf("%d", r.EvidenceCount),
			r.CreatedAt.Format(time.RFC3339),
		}
		_ = writer.Write(row)
	}

	writer.Flush()

	return &ExportResult{
		Format: "csv",
		Data:   buf.Bytes(),
	}, nil
}

func ExportMarkdown(report *ProjectReport) (*ExportResult, error) {
	var builder strings.Builder

	builder.WriteString(fmt.Sprintf("# 并发风险分析报告\n\n"))
	builder.WriteString(fmt.Sprintf("**项目**: %s\n\n", report.Project.Name))
	builder.WriteString(fmt.Sprintf("**生成时间**: %s\n\n", report.GeneratedAt.Format("2006-01-02 15:04:05")))
	builder.WriteString(fmt.Sprintf("**项目ID**: %s\n\n", report.Project.ID))

	builder.WriteString("## 项目统计\n\n")
	builder.WriteString("| 指标 | 值 |\n")
	builder.WriteString("|------|-----|\n")
	for key, value := range report.Stats {
		builder.WriteString(fmt.Sprintf("| %s | %v |\n", formatStatKey(key), value))
	}
	builder.WriteString("\n")

	criticalCount := 0
	highCount := 0
	mediumCount := 0
	lowCount := 0

	for _, r := range report.AnalysisResults {
		switch r.Severity {
		case models.RiskSeverityCritical:
			criticalCount++
		case models.RiskSeverityHigh:
			highCount++
		case models.RiskSeverityMedium:
			mediumCount++
		case models.RiskSeverityLow:
			lowCount++
		}
	}

	builder.WriteString("## 风险概览\n\n")
	builder.WriteString(fmt.Sprintf("- **Critical**: %d 个\n", criticalCount))
	builder.WriteString(fmt.Sprintf("- **High**: %d 个\n", highCount))
	builder.WriteString(fmt.Sprintf("- **Medium**: %d 个\n", mediumCount))
	builder.WriteString(fmt.Sprintf("- **Low**: %d 个\n\n", lowCount))

	if criticalCount > 0 || highCount > 0 {
		builder.WriteString("### ⚠️ 紧急建议\n\n")
		if criticalCount > 0 {
			builder.WriteString(fmt.Sprintf("- 有 **%d 个 Critical 级别** 的问题需要立即修复\n", criticalCount))
		}
		if highCount > 0 {
			builder.WriteString(fmt.Sprintf("- 有 **%d 个 High 级别** 的问题建议本周内修复\n\n", highCount))
		}
	}

	builder.WriteString("## 详细分析结果\n\n")

	for idx, r := range report.AnalysisResults {
		severityEmoji := map[models.RiskSeverity]string{
			models.RiskSeverityCritical: "🔴",
			models.RiskSeverityHigh:     "🟠",
			models.RiskSeverityMedium:   "🟡",
			models.RiskSeverityLow:      "🟢",
		}[r.Severity]

		builder.WriteString(fmt.Sprintf("### %d. %s %s - %s\n\n", idx+1, severityEmoji, r.Title, r.Severity))
		builder.WriteString(fmt.Sprintf("**类别**: `%s`\n\n", r.Category))
		builder.WriteString(fmt.Sprintf("**描述**:\n\n%s\n\n", r.Description))

		if r.EvidenceCount > 0 {
			builder.WriteString("**证据**:\n\n")
			for i, ev := range r.Evidence {
				if i >= 5 {
					builder.WriteString(fmt.Sprintf("  ... 还有 %d 条更多证据\n", len(r.Evidence)-5))
					break
				}
				builder.WriteString(fmt.Sprintf("%d. %s\n", i+1, wrapText(ev, 100)))
			}
			builder.WriteString("\n")
		}

		if len(r.Suggestions) > 0 {
			builder.WriteString("**建议**:\n\n")
			for i, s := range r.Suggestions {
				builder.WriteString(fmt.Sprintf("%d. %s\n", i+1, s))
			}
			builder.WriteString("\n")
		}

		builder.WriteString("---\n\n")
	}

	builder.WriteString("## 风险类别说明\n\n")
	builder.WriteString("| 类别 | 说明 |\n")
	builder.WriteString("|------|------|\n")
	builder.WriteString("| `concurrent_map` | 并发 map 未加锁读写 - Go 运行时会 panic |\n")
	builder.WriteString("| `hot_key_write` | 热点 key 频繁写入 - 导致锁竞争 |\n")
	builder.WriteString("| `coarse_lock` | 锁粒度过粗 - 降低并发性能 |\n")
	builder.WriteString("| `worker_backlog` | Worker 队列积压 - 上游阻塞风险 |\n")
	builder.WriteString("| `goroutine_leak` | Goroutine 泄漏 - 内存持续增长 |\n")
	builder.WriteString("| `context_missing` | Context 未传递 - 无法优雅取消 |\n")
	builder.WriteString("| `channel_blocked` | Channel 阻塞 - 死锁风险 |\n\n")

	builder.WriteString("## 严重级别说明\n\n")
	builder.WriteString("| 级别 | 说明 |\n")
	builder.WriteString("|------|------|\n")
	builder.WriteString("| `critical` | 立即修复 - 会导致 panic 或死锁 |\n")
	builder.WriteString("| `high` | 尽快修复 - 严重影响稳定性或性能 |\n")
	builder.WriteString("| `medium` | 计划修复 - 影响可观测性或潜在风险 |\n")
	builder.WriteString("| `low` | 建议优化 - 最佳实践问题 |\n\n")

	builder.WriteString("---\n\n")
	builder.WriteString(fmt.Sprintf("*报告由 Concurrency Detector 生成于 %s*\n", report.GeneratedAt.Format(time.RFC3339)))

	return &ExportResult{
		Format: "markdown",
		Data:   []byte(builder.String()),
	}, nil
}

func escapeCSV(s string) string {
	if strings.ContainsAny(s, ",\n\"") {
		return fmt.Sprintf("\"%s\"", strings.ReplaceAll(s, "\"", "\"\""))
	}
	return s
}

func formatStatKey(key string) string {
	replacements := map[string]string{
		"map_events_count":      "Map 事件数量",
		"unique_goroutines":     "唯一 Goroutine 数量",
		"analysis_results_count": "分析结果数量",
		"critical_count":        "Critical 级别问题",
		"high_count":            "High 级别问题",
	}

	if v, ok := replacements[key]; ok {
		return v
	}
	return key
}

func wrapText(text string, width int) string {
	if len(text) <= width {
		return text
	}

	var result strings.Builder
	lines := strings.Split(text, "\n")

	for _, line := range lines {
		if len(line) <= width {
			result.WriteString(line)
			result.WriteString("\n")
			continue
		}

		for len(line) > width {
			spaceIdx := strings.LastIndex(line[:width], " ")
			if spaceIdx == -1 {
				spaceIdx = width - 1
			}
			result.WriteString(line[:spaceIdx+1])
			result.WriteString("\n  ")
			line = line[spaceIdx+1:]
		}
		result.WriteString(line)
		result.WriteString("\n")
	}

	return strings.TrimSuffix(result.String(), "\n")
}

func Export(report *ProjectReport, format string) (*ExportResult, error) {
	switch format {
	case "json":
		return ExportJSON(report)
	case "csv":
		return ExportCSV(report)
	case "md", "markdown":
		return ExportMarkdown(report)
	default:
		return nil, fmt.Errorf("unsupported export format: %s", format)
	}
}
