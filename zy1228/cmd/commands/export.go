package commands

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"concurrency-inspector/internal/models"
	"concurrency-inspector/internal/storage"

	"github.com/spf13/cobra"
)

func ExportCommand(s *storage.SQLiteStorage) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "export [project-name]",
		Short: "导出分析报告",
		Long: `export 命令用于将分析结果导出为 Markdown 或 JSON 格式的报告。
报告包含拓扑结构、队列分析、背压分析、超时策略、错误处理、
优雅关闭、问题列表和改进建议等所有分析维度。`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			projectName := args[0]
			return runExport(cmd, projectName, s)
		},
	}

	cmd.Flags().StringP("format", "f", "markdown", "输出格式: markdown 或 json")
	cmd.Flags().StringP("output", "o", "", "输出文件路径")
	cmd.Flags().BoolP("stdout", "s", false, "输出到标准输出")

	return cmd
}

func runExport(cmd *cobra.Command, projectName string, s *storage.SQLiteStorage) error {
	format, _ := cmd.Flags().GetString("format")
	outputPath, _ := cmd.Flags().GetString("output")
	stdout, _ := cmd.Flags().GetBool("stdout")

	result, err := loadAnalysisResult(s, projectName)
	if err != nil {
		return fmt.Errorf("failed to load analysis: %w", err)
	}

	var content string
	var ext string

	switch strings.ToLower(format) {
	case "json":
		content, err = exportToJSON(result, projectName)
		ext = "json"
	case "markdown", "md":
		content = exportToMarkdown(result, projectName)
		ext = "md"
	default:
		return fmt.Errorf("unsupported format: %s", format)
	}

	if err != nil {
		return fmt.Errorf("failed to export: %w", err)
	}

	if stdout {
		fmt.Println(content)
		return nil
	}

	if outputPath == "" {
		timestamp := time.Now().Format("20060102-150405")
		outputPath = fmt.Sprintf("%s-analysis-%s.%s", projectName, timestamp, ext)
	}

	absPath, err := filepath.Abs(outputPath)
	if err != nil {
		return fmt.Errorf("failed to get absolute path: %w", err)
	}

	if err := os.WriteFile(absPath, []byte(content), 0644); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	fmt.Printf("✓ 报告已导出到: %s\n", absPath)

	return nil
}

func exportToJSON(result *models.AnalysisResult, projectName string) (string, error) {
	type ExportData struct {
		ProjectName   string                   `json:"project_name"`
		GeneratedAt   time.Time                `json:"generated_at"`
		OverallScore  int                      `json:"overall_score"`
		Topology      *models.TopologyResult   `json:"topology"`
		Queues        *models.QueueAnalysis    `json:"queues"`
		Backpressure  *models.BackpressureAnalysis `json:"backpressure"`
		Priority      *models.PriorityAnalysis `json:"priority"`
		Timeout       *models.TimeoutAnalysis  `json:"timeout"`
		Error         *models.ErrorAnalysis    `json:"error"`
		Shutdown      *models.ShutdownAnalysis `json:"shutdown"`
		Issues        []models.Issue           `json:"issues"`
		Recommendations []models.Recommendation `json:"recommendations"`
	}

	data := ExportData{
		ProjectName:     projectName,
		GeneratedAt:     time.Now(),
		OverallScore:    result.OverallScore,
		Topology:        result.GoroutineTopology,
		Queues:          result.QueueAnalysis,
		Backpressure:    result.BackpressureAnalysis,
		Priority:        result.PriorityAnalysis,
		Timeout:         result.TimeoutAnalysis,
		Error:           result.ErrorAnalysis,
		Shutdown:        result.ShutdownAnalysis,
		Issues:          result.Issues,
		Recommendations: result.Recommendations,
	}

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal JSON: %w", err)
	}

	return string(jsonData), nil
}

func exportToMarkdown(result *models.AnalysisResult, projectName string) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("# 并发设计分析报告: %s\n\n", projectName))
	sb.WriteString(fmt.Sprintf("生成时间: %s\n\n", time.Now().Format("2006-01-02 15:04:05")))

	sb.WriteString("## 综合评分\n\n")
	status := "✅ 良好"
	if result.OverallScore < 60 {
		status = "❌ 存在严重问题"
	} else if result.OverallScore < 80 {
		status = "⚠️ 需要改进"
	}
	sb.WriteString(fmt.Sprintf("**评分: %d/100** (%s)\n\n", result.OverallScore, status))

	sb.WriteString("---\n\n")

	sb.WriteString("## 1. 拓扑结构分析\n\n")
	sb.WriteString("### 1.1 节点信息\n\n")
	sb.WriteString("| 名称 | 类型 | Worker数 | 容量 |\n")
	sb.WriteString("|------|------|----------|------|\n")
	for _, node := range result.GoroutineTopology.Nodes {
		sb.WriteString(fmt.Sprintf("| %s | %s | %d | %d |\n", 
			node.Name, node.Type, node.Workers, node.Capacity))
	}
	sb.WriteString("\n")

	if len(result.GoroutineTopology.Patterns) > 0 {
		sb.WriteString("### 1.2 检测到的并发模式\n\n")
		for _, pattern := range result.GoroutineTopology.Patterns {
			sb.WriteString(fmt.Sprintf("- **%s** (置信度: %.1f%%)\n", 
				pattern.Name, pattern.Confidence*100))
			sb.WriteString(fmt.Sprintf("  - %s\n\n", pattern.Description))
		}
	}

	if len(result.GoroutineTopology.Cycles) > 0 {
		sb.WriteString("### 1.3 ⚠️ 循环依赖\n\n")
		for _, cycle := range result.GoroutineTopology.Cycles {
			sb.WriteString(fmt.Sprintf("- %s\n", cycle))
		}
		sb.WriteString("\n")
	}

	if len(result.GoroutineTopology.Orphaned) > 0 {
		sb.WriteString("### 1.4 ⚠️ 孤立的 Goroutine\n\n")
		for _, orphan := range result.GoroutineTopology.Orphaned {
			sb.WriteString(fmt.Sprintf("- %s\n", orphan))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("---\n\n")

	sb.WriteString("## 2. 队列分析\n\n")
	if len(result.QueueAnalysis.Queues) > 0 {
		sb.WriteString("| 名称 | 类型 | 容量 | 状态 |\n")
		sb.WriteString("|------|------|------|------|\n")
		for _, q := range result.QueueAnalysis.Queues {
			status := "✅ 正常"
			if q.Status == "warning" {
				status = "⚠️ 警告"
			} else if q.Status == "critical" {
				status = "❌ 严重"
			}
			sb.WriteString(fmt.Sprintf("| %s | %s | %d | %s |\n",
				q.Name, q.Type, q.Capacity, status))
		}
		sb.WriteString("\n")
	}

	if len(result.QueueAnalysis.Issues) > 0 {
		sb.WriteString("### 2.1 队列问题\n\n")
		for _, issue := range result.QueueAnalysis.Issues {
			severity := "ℹ️"
			if issue.Severity == "critical" {
				severity = "❌"
			} else if issue.Severity == "high" {
				severity = "⚠️"
			}
			sb.WriteString(fmt.Sprintf("%s **[%s]** %s - %s\n\n", 
				severity, issue.Severity, issue.Name, issue.Description))
		}
	}

	sb.WriteString("---\n\n")

	sb.WriteString("## 3. 背压分析\n\n")
	if result.BackpressureAnalysis.HasBackpressure {
		sb.WriteString("**⚠️ 检测到潜在背压问题**\n\n")
		sb.WriteString("### 3.1 瓶颈队列\n\n")
		for _, bottleneck := range result.BackpressureAnalysis.Bottlenecks {
			sb.WriteString(fmt.Sprintf("- %s\n", bottleneck))
		}
		sb.WriteString("\n")
	} else {
		sb.WriteString("✅ 无明显背压问题\n\n")
	}

	if len(result.BackpressureAnalysis.Strategies) > 0 {
		sb.WriteString("### 3.2 现有策略\n\n")
		for _, strategy := range result.BackpressureAnalysis.Strategies {
			sb.WriteString(fmt.Sprintf("- %s\n", strategy))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("---\n\n")

	sb.WriteString("## 4. 优先级分析\n\n")
	if result.PriorityAnalysis.HasPriorityQueues {
		sb.WriteString("### 4.1 优先级队列\n\n")
		for _, q := range result.PriorityAnalysis.PriorityQueues {
			sb.WriteString(fmt.Sprintf("- %s\n", q))
		}
		sb.WriteString("\n")
	} else {
		sb.WriteString("未使用优先级队列\n\n")
	}

	if len(result.PriorityAnalysis.Issues) > 0 {
		sb.WriteString("### 4.2 优先级问题\n\n")
		for _, issue := range result.PriorityAnalysis.Issues {
			sb.WriteString(fmt.Sprintf("- **%s**: %s\n", issue.QueueName, issue.Description))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("---\n\n")

	sb.WriteString("## 5. 超时与取消传播\n\n")
	sb.WriteString("| 项目 | 值 |\n")
	sb.WriteString("|------|----|\n")
	sb.WriteString(fmt.Sprintf("| 默认超时 | %s |\n", result.TimeoutAnalysis.DefaultTimeout))
	sb.WriteString(fmt.Sprintf("| 取消传播 | %v |\n", result.TimeoutAnalysis.HasCancelPropagate))
	sb.WriteString(fmt.Sprintf("| 超时预算 | %s |\n", result.TimeoutAnalysis.TimeoutBudget))
	sb.WriteString("\n")

	if len(result.TimeoutAnalysis.UncoveredOperations) > 0 {
		sb.WriteString("### 5.1 ⚠️ 未覆盖的操作\n\n")
		for _, op := range result.TimeoutAnalysis.UncoveredOperations {
			sb.WriteString(fmt.Sprintf("- %s\n", op))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("---\n\n")

	sb.WriteString("## 6. 错误处理分析\n\n")
	sb.WriteString("| 项目 | 值 |\n")
	sb.WriteString("|------|----|\n")
	sb.WriteString(fmt.Sprintf("| 策略 | %s |\n", result.ErrorAnalysis.Strategy))
	sb.WriteString(fmt.Sprintf("| 错误队列 | %v |\n", result.ErrorAnalysis.HasErrorQueue))
	sb.WriteString(fmt.Sprintf("| Panic Handler | %v |\n", result.ErrorAnalysis.HasPanicHandler))
	sb.WriteString("\n")

	if result.ErrorAnalysis.RetryConfig != nil {
		sb.WriteString("### 6.1 重试配置\n\n")
		sb.WriteString(fmt.Sprintf("- 最大重试次数: %d\n", result.ErrorAnalysis.RetryConfig.MaxRetries))
		sb.WriteString(fmt.Sprintf("- 退避策略: %s\n\n", result.ErrorAnalysis.RetryConfig.Backoff))
	}

	if len(result.ErrorAnalysis.UnhandledPaths) > 0 {
		sb.WriteString("### 6.2 ⚠️ 未处理的路径\n\n")
		for _, path := range result.ErrorAnalysis.UnhandledPaths {
			sb.WriteString(fmt.Sprintf("- %s\n", path))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("---\n\n")

	sb.WriteString("## 7. 优雅关闭分析\n\n")
	sb.WriteString("| 项目 | 值 |\n")
	sb.WriteString("|------|----|\n")
	sb.WriteString(fmt.Sprintf("| 优雅关闭 | %v |\n", result.ShutdownAnalysis.Graceful))
	sb.WriteString(fmt.Sprintf("| 等待超时 | %s |\n", result.ShutdownAnalysis.WaitTimeout))
	sb.WriteString(fmt.Sprintf("| 强制终止 | %v |\n", result.ShutdownAnalysis.HasForceKill))
	sb.WriteString("\n")

	if len(result.ShutdownAnalysis.ShutdownOrder) > 0 {
		sb.WriteString("### 7.1 关闭顺序\n\n")
		for i, name := range result.ShutdownAnalysis.ShutdownOrder {
			sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, name))
		}
		sb.WriteString("\n")
	}

	if len(result.ShutdownAnalysis.Issues) > 0 {
		sb.WriteString("### 7.2 ⚠️ 关闭问题\n\n")
		for _, issue := range result.ShutdownAnalysis.Issues {
			severity := "ℹ️"
			if issue.Severity == "critical" {
				severity = "❌"
			}
			sb.WriteString(fmt.Sprintf("%s **[%s]** %s: %s\n\n", 
				severity, issue.Severity, issue.IssueType, issue.Description))
		}
	}

	sb.WriteString("---\n\n")

	sb.WriteString("## 8. 问题列表\n\n")
	if len(result.Issues) == 0 {
		sb.WriteString("✅ 未发现问题\n\n")
	} else {
		severityGroups := make(map[string][]models.Issue)
		for _, issue := range result.Issues {
			severityGroups[issue.Severity] = append(severityGroups[issue.Severity], issue)
		}

		severityOrder := []string{"critical", "high", "warning", "low"}
		severityNames := map[string]string{
			"critical": "❌ Critical (严重)",
			"high":     "⚠️ High (高)",
			"warning":  "ℹ️ Warning (中)",
			"low":      "💡 Low (低)",
		}

		for _, severity := range severityOrder {
			issues := severityGroups[severity]
			if len(issues) == 0 {
				continue
			}

			sb.WriteString(fmt.Sprintf("### 8.%d %s\n\n", 
				map[string]int{"critical": 1, "high": 2, "warning": 3, "low": 4}[severity],
				severityNames[severity]))

			for i, issue := range issues {
				sb.WriteString(fmt.Sprintf("**%d. [%s] %s**\n\n", 
					i+1, issue.Category, issue.Description))
				if issue.Location != "" {
					sb.WriteString(fmt.Sprintf("- 位置: %s\n", issue.Location))
				}
				if issue.Suggestion != "" {
					sb.WriteString(fmt.Sprintf("- 建议: %s\n", issue.Suggestion))
				}
				sb.WriteString("\n")
			}
		}
	}

	sb.WriteString("---\n\n")

	sb.WriteString("## 9. 改进建议\n\n")
	if len(result.Recommendations) == 0 {
		sb.WriteString("✅ 暂无建议\n\n")
	} else {
		priorityGroups := make(map[string][]models.Recommendation)
		for _, rec := range result.Recommendations {
			priorityGroups[rec.Priority] = append(priorityGroups[rec.Priority], rec)
		}

		priorityOrder := []string{"critical", "high", "medium", "low"}
		priorityNames := map[string]string{
			"critical": "🔴 Critical (紧急)",
			"high":     "🟡 High (高)",
			"medium":   "🟢 Medium (中)",
			"low":      "💡 Low (低)",
		}

		for _, priority := range priorityOrder {
			recs := priorityGroups[priority]
			if len(recs) == 0 {
				continue
			}

			sb.WriteString(fmt.Sprintf("### 9.%d %s\n\n",
				map[string]int{"critical": 1, "high": 2, "medium": 3, "low": 4}[priority],
				priorityNames[priority]))

			for i, rec := range recs {
				sb.WriteString(fmt.Sprintf("**%d. [%s] %s**\n\n", 
					i+1, rec.Category, rec.Description))
				sb.WriteString(fmt.Sprintf("- 影响: %s\n\n", rec.Impact))
			}
		}
	}

	sb.WriteString("---\n\n")
	sb.WriteString("*此报告由 Concurrency Inspector 自动生成*\n")

	return sb.String()
}
