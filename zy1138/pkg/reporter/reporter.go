package reporter

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"

	"queue-analyzer/pkg/models"
)

type Reporter struct {
}

func NewReporter() *Reporter {
	return &Reporter{}
}

func (r *Reporter) ExportAnalysisResult(result *models.AnalysisResult, format, outputPath string) error {
	switch format {
	case "json":
		return r.exportJSON(result, outputPath)
	case "csv":
		return r.exportAnalysisCSV(result, outputPath)
	case "markdown", "md":
		return r.exportAnalysisMarkdown(result, outputPath)
	default:
		return fmt.Errorf("unsupported format: %s", format)
	}
}

func (r *Reporter) ExportSimulationResult(result *models.SimulationResult, format, outputPath string) error {
	switch format {
	case "json":
		return r.exportJSON(result, outputPath)
	case "csv":
		return r.exportSimulationCSV(result, outputPath)
	case "markdown", "md":
		return r.exportSimulationMarkdown(result, outputPath)
	default:
		return fmt.Errorf("unsupported format: %s", format)
	}
}

func (r *Reporter) ExportComparisonResult(result *models.ComparisonResult, format, outputPath string) error {
	switch format {
	case "json":
		return r.exportJSON(result, outputPath)
	case "csv":
		return r.exportComparisonCSV(result, outputPath)
	case "markdown", "md":
		return r.exportComparisonMarkdown(result, outputPath)
	default:
		return fmt.Errorf("unsupported format: %s", format)
	}
}

func (r *Reporter) exportJSON(data interface{}, outputPath string) error {
	var file *os.File
	var err error

	if outputPath == "-" || outputPath == "" {
		file = os.Stdout
	} else {
		file, err = os.Create(outputPath)
		if err != nil {
			return err
		}
		defer file.Close()
	}

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	return encoder.Encode(data)
}

func (r *Reporter) exportAnalysisCSV(result *models.AnalysisResult, outputPath string) error {
	var file *os.File
	var err error

	if outputPath == "-" || outputPath == "" {
		file = os.Stdout
	} else {
		file, err = os.Create(outputPath)
		if err != nil {
			return err
		}
		defer file.Close()
	}

	writer := csv.NewWriter(file)
	defer writer.Flush()

	writer.Write([]string{"Analysis Report", result.Name})
	writer.Write([]string{"Analysis Time", result.AnalysisTime.Format(time.RFC3339)})
	writer.Write([]string{"Time Range", result.TimeRange.Start.Format(time.RFC3339) + " to " + result.TimeRange.End.Format(time.RFC3339)})
	writer.Write([]string{})

	writer.Write([]string{"Summary"})
	writer.Write([]string{"Metric", "Value"})
	writer.Write([]string{"Total Jobs", fmt.Sprintf("%d", result.Summary.TotalJobs)})
	writer.Write([]string{"Total Workers", fmt.Sprintf("%d", result.Summary.TotalWorkers)})
	writer.Write([]string{"Success Rate", fmt.Sprintf("%.2f%%", result.Summary.SuccessRate*100)})
	writer.Write([]string{"Avg Throughput (jobs/sec)", fmt.Sprintf("%.2f", result.Summary.AvgThroughputPerSec)})
	writer.Write([]string{"Max Backlog", fmt.Sprintf("%d", result.Summary.MaxBacklog)})
	writer.Write([]string{"Max Wait Time (ms)", fmt.Sprintf("%d", result.Summary.MaxWaitTimeMs)})
	writer.Write([]string{})

	if result.JobStats != nil {
		writer.Write([]string{"Job Statistics"})
		writer.Write([]string{"Metric", "Value"})
		writer.Write([]string{"Total Jobs", fmt.Sprintf("%d", result.JobStats.TotalJobs)})
		writer.Write([]string{"Avg Execution Time (ms)", fmt.Sprintf("%.0f", result.JobStats.AvgExecutionTimeMs)})
		writer.Write([]string{"P50 Execution Time (ms)", fmt.Sprintf("%.0f", result.JobStats.P50ExecutionTimeMs)})
		writer.Write([]string{"P95 Execution Time (ms)", fmt.Sprintf("%.0f", result.JobStats.P95ExecutionTimeMs)})
		writer.Write([]string{"P99 Execution Time (ms)", fmt.Sprintf("%.0f", result.JobStats.P99ExecutionTimeMs)})
		writer.Write([]string{"Avg Wait Time (ms)", fmt.Sprintf("%.0f", result.JobStats.AvgWaitTimeMs)})
		writer.Write([]string{"P50 Wait Time (ms)", fmt.Sprintf("%.0f", result.JobStats.P50WaitTimeMs)})
		writer.Write([]string{"P95 Wait Time (ms)", fmt.Sprintf("%.0f", result.JobStats.P95WaitTimeMs)})
		writer.Write([]string{"P99 Wait Time (ms)", fmt.Sprintf("%.0f", result.JobStats.P99WaitTimeMs)})
		writer.Write([]string{"Avg Retry Count", fmt.Sprintf("%.1f", result.JobStats.AvgRetryCount)})
		writer.Write([]string{"Max Retry Count", fmt.Sprintf("%d", result.JobStats.MaxRetryCount)})
		writer.Write([]string{"Dead Letter Count", fmt.Sprintf("%d", result.JobStats.DeadLetterCount)})
		writer.Write([]string{"Timeout Count", fmt.Sprintf("%d", result.JobStats.TimeoutCount)})
		writer.Write([]string{})
	}

	if result.BacklogAnalysis != nil {
		writer.Write([]string{"Backlog Analysis"})
		writer.Write([]string{"Metric", "Value"})
		writer.Write([]string{"Peak Backlog", fmt.Sprintf("%d", result.BacklogAnalysis.PeakBacklog)})
		writer.Write([]string{"Peak Time", result.BacklogAnalysis.PeakTime.Format(time.RFC3339)})
		writer.Write([]string{"Avg Backlog", fmt.Sprintf("%.2f", result.BacklogAnalysis.AvgBacklog)})
		writer.Write([]string{"Backlog Growth Rate (per hour)", fmt.Sprintf("%.2f", result.BacklogAnalysis.BacklogGrowthRate)})
		writer.Write([]string{})
	}

	if len(result.Recommendations) > 0 {
		writer.Write([]string{"Recommendations"})
		writer.Write([]string{"ID", "Category", "Priority", "Title", "Suggestion"})
		for _, rec := range result.Recommendations {
			writer.Write([]string{rec.ID, rec.Category, rec.Priority, rec.Title, rec.Suggestion})
		}
	}

	return nil
}

func (r *Reporter) exportAnalysisMarkdown(result *models.AnalysisResult, outputPath string) error {
	var file *os.File
	var err error

	if outputPath == "-" || outputPath == "" {
		file = os.Stdout
	} else {
		file, err = os.Create(outputPath)
		if err != nil {
			return err
		}
		defer file.Close()
	}

	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("# 队列分析报告: %s\n\n", result.Name))
	sb.WriteString(fmt.Sprintf("**分析时间**: %s\n\n", result.AnalysisTime.Format(time.RFC3339)))
	sb.WriteString(fmt.Sprintf("**时间范围**: %s 至 %s\n\n", result.TimeRange.Start.Format(time.RFC3339), result.TimeRange.End.Format(time.RFC3339)))

	sb.WriteString("## 概览\n\n")
	sb.WriteString("| 指标 | 数值 |\n")
	sb.WriteString("|------|------|\n")
	sb.WriteString(fmt.Sprintf("| 总任务数 | %d |\n", result.Summary.TotalJobs))
	sb.WriteString(fmt.Sprintf("| Worker 数 | %d |\n", result.Summary.TotalWorkers))
	sb.WriteString(fmt.Sprintf("| 成功率 | %.2f%% |\n", result.Summary.SuccessRate*100))
	sb.WriteString(fmt.Sprintf("| 平均吞吐 (任务/秒) | %.2f |\n", result.Summary.AvgThroughputPerSec))
	sb.WriteString(fmt.Sprintf("| 最大积压 | %d |\n", result.Summary.MaxBacklog))
	sb.WriteString(fmt.Sprintf("| 最大等待时间 (ms) | %d |\n", result.Summary.MaxWaitTimeMs))
	sb.WriteString("\n")

	if result.JobStats != nil {
		sb.WriteString("## 任务统计\n\n")
		sb.WriteString("### 执行时间分布\n\n")
		sb.WriteString("| 分位数 | 执行时间 (ms) | 等待时间 (ms) |\n")
		sb.WriteString("|--------|---------------|---------------|\n")
		sb.WriteString(fmt.Sprintf("| 平均值 | %.0f | %.0f |\n", result.JobStats.AvgExecutionTimeMs, result.JobStats.AvgWaitTimeMs))
		sb.WriteString(fmt.Sprintf("| P50 | %.0f | %.0f |\n", result.JobStats.P50ExecutionTimeMs, result.JobStats.P50WaitTimeMs))
		sb.WriteString(fmt.Sprintf("| P95 | %.0f | %.0f |\n", result.JobStats.P95ExecutionTimeMs, result.JobStats.P95WaitTimeMs))
		sb.WriteString(fmt.Sprintf("| P99 | %.0f | %.0f |\n", result.JobStats.P99ExecutionTimeMs, result.JobStats.P99WaitTimeMs))
		sb.WriteString("\n")

		sb.WriteString("### 其他统计\n\n")
		sb.WriteString("| 指标 | 数值 |\n")
		sb.WriteString("|------|------|\n")
		sb.WriteString(fmt.Sprintf("| 总任务数 | %d |\n", result.JobStats.TotalJobs))
		sb.WriteString(fmt.Sprintf("| 平均重试次数 | %.1f |\n", result.JobStats.AvgRetryCount))
		sb.WriteString(fmt.Sprintf("| 最大重试次数 | %d |\n", result.JobStats.MaxRetryCount))
		sb.WriteString(fmt.Sprintf("| 死信任务数 | %d |\n", result.JobStats.DeadLetterCount))
		sb.WriteString(fmt.Sprintf("| 超时任务数 | %d |\n", result.JobStats.TimeoutCount))
		sb.WriteString("\n")
	}

	if result.BacklogAnalysis != nil {
		sb.WriteString("## 积压分析\n\n")
		sb.WriteString("| 指标 | 数值 |\n")
		sb.WriteString("|------|------|\n")
		sb.WriteString(fmt.Sprintf("| 峰值积压 | %d |\n", result.BacklogAnalysis.PeakBacklog))
		sb.WriteString(fmt.Sprintf("| 峰值时间 | %s |\n", result.BacklogAnalysis.PeakTime.Format(time.RFC3339)))
		sb.WriteString(fmt.Sprintf("| 平均积压 | %.2f |\n", result.BacklogAnalysis.AvgBacklog))
		sb.WriteString(fmt.Sprintf("| 积压增长率 (每小时) | %.2f |\n", result.BacklogAnalysis.BacklogGrowthRate))
		sb.WriteString("\n")
	}

	if result.RetryAnalysis != nil {
		sb.WriteString("## 重试分析\n\n")
		sb.WriteString("| 指标 | 数值 |\n")
		sb.WriteString("|------|------|\n")
		sb.WriteString(fmt.Sprintf("| 总重试事件数 | %d |\n", result.RetryAnalysis.TotalRetryEvents))
		sb.WriteString(fmt.Sprintf("| 最大重试次数 | %d |\n", result.RetryAnalysis.MaxRetryCount))
		sb.WriteString(fmt.Sprintf("| 平均重试次数 | %.1f |\n", result.RetryAnalysis.AvgRetryCount))
		sb.WriteString(fmt.Sprintf("| 重试率 | %.2f%% |\n", result.RetryAnalysis.RetryRate*100))
		sb.WriteString(fmt.Sprintf("| 平均重试间隔 (ms) | %.0f |\n", result.RetryAnalysis.AvgRetryIntervalMs))
		sb.WriteString("\n")

		if len(result.RetryAnalysis.RetryStormIndicators) > 0 {
			sb.WriteString("### ⚠️ 重试风暴检测\n\n")
			for _, storm := range result.RetryAnalysis.RetryStormIndicators {
				sb.WriteString(fmt.Sprintf("**%s 级重试风暴**\n\n", strings.ToUpper(storm.Severity)))
				sb.WriteString(fmt.Sprintf("- 时间范围: %s 至 %s\n", storm.StartTime.Format(time.RFC3339), storm.EndTime.Format(time.RFC3339)))
				sb.WriteString(fmt.Sprintf("- 重试事件数: %d\n", storm.RetryCount))
				sb.WriteString(fmt.Sprintf("- 受影响任务数: %d\n", storm.AffectedJobs))
				sb.WriteString(fmt.Sprintf("- 原因: %s\n\n", storm.Reason))
			}
		}
	}

	if result.PriorityAnalysis != nil {
		sb.WriteString("## 优先级分析\n\n")

		if result.PriorityAnalysis.HasPrioritySystem {
			sb.WriteString("### 优先级分布\n\n")
			if len(result.PriorityAnalysis.PriorityDistribution) > 0 {
				sb.WriteString("| 优先级 | 任务数 | 成功率 | 平均等待时间 (ms) |\n")
				sb.WriteString("|--------|--------|--------|-------------------|\n")

				priorities := make([]int, 0)
				for p := range result.PriorityAnalysis.PriorityDistribution {
					priorities = append(priorities, p)
				}
				sort.Ints(priorities)

				for _, p := range priorities {
					stats := result.PriorityAnalysis.PriorityDistribution[p]
					sb.WriteString(fmt.Sprintf("| %d | %d | %.2f%% | %.0f |\n", p, stats.TotalJobs, stats.SuccessRate*100, stats.AvgWaitTimeMs))
				}
				sb.WriteString("\n")
			}

			if len(result.PriorityAnalysis.PriorityInversionCases) > 0 {
				sb.WriteString("### ⚠️ 优先级反转检测\n\n")
				for _, inv := range result.PriorityAnalysis.PriorityInversionCases {
					sb.WriteString(fmt.Sprintf("**%s 级优先级反转**\n\n", strings.ToUpper(inv.Severity)))
					sb.WriteString(fmt.Sprintf("- 时间: %s\n", inv.Timestamp.Format(time.RFC3339)))
					sb.WriteString(fmt.Sprintf("- 高优先级任务 %s (优先级 %d) 等待 %dms\n", inv.HighPriorityJobID, inv.HighPriority, inv.HighPriorityWaitMs))
					sb.WriteString(fmt.Sprintf("- 期间低优先级任务 %s (优先级 %d) 执行 %dms\n\n", inv.LowPriorityJobID, inv.LowPriority, inv.LowPriorityExecMs))
				}
			}

			if len(result.PriorityAnalysis.StarvationIndicators) > 0 {
				sb.WriteString("### ⚠️ 任务饥饿检测\n\n")
				for _, starv := range result.PriorityAnalysis.StarvationIndicators {
					sb.WriteString(fmt.Sprintf("**优先级 %d 的任务饥饿**\n\n", starv.PriorityLevel))
					sb.WriteString(fmt.Sprintf("- 最大等待时间: %dms\n", starv.WaitTimeMs))
					sb.WriteString(fmt.Sprintf("- 排队任务数: %d\n", starv.QueuedJobsCount))
					sb.WriteString(fmt.Sprintf("- 已处理任务数: %d\n\n", starv.ProcessedJobsCount))
				}
			}
		} else {
			sb.WriteString("未检测到优先级系统配置\n\n")
		}
	}

	if result.DeadLetterAnalysis != nil && result.DeadLetterAnalysis.TotalDeadLetterJobs > 0 {
		sb.WriteString("## 死信分析\n\n")
		sb.WriteString("| 指标 | 数值 |\n")
		sb.WriteString("|------|------|\n")
		sb.WriteString(fmt.Sprintf("| 死信任务数 | %d |\n", result.DeadLetterAnalysis.TotalDeadLetterJobs))
		sb.WriteString(fmt.Sprintf("| 死信率 | %.2f%% |\n", result.DeadLetterAnalysis.DeadLetterRate*100))
		sb.WriteString(fmt.Sprintf("| 平均重试次数 (进入死信前) | %.1f |\n", result.DeadLetterAnalysis.AvgRetryBeforeDLQ))
		sb.WriteString("\n")

		if len(result.DeadLetterAnalysis.ByReason) > 0 {
			sb.WriteString("### 失败原因分布\n\n")
			sb.WriteString("| 原因 | 数量 |\n")
			sb.WriteString("|------|------|\n")
			for reason, count := range result.DeadLetterAnalysis.ByReason {
				sb.WriteString(fmt.Sprintf("| %s | %d |\n", reason, count))
			}
			sb.WriteString("\n")
		}

		if len(result.DeadLetterAnalysis.RecentDeadLetters) > 0 {
			sb.WriteString("### 最近的死信任务\n\n")
			for _, dlq := range result.DeadLetterAnalysis.RecentDeadLetters {
				sb.WriteString(fmt.Sprintf("- **%s** (%s, 优先级 %d)\n", dlq.JobID, dlq.JobType, dlq.Priority))
				sb.WriteString(fmt.Sprintf("  - 失败原因: %s\n", dlq.FailReason))
				sb.WriteString(fmt.Sprintf("  - 重试次数: %d\n", dlq.RetryCount))
				sb.WriteString(fmt.Sprintf("  - 死信时间: %s\n\n", dlq.DeadLetterTime.Format(time.RFC3339)))
			}
		}
	}

	if len(result.Recommendations) > 0 {
		sb.WriteString("## 优化建议\n\n")

		highRecs := make([]models.Recommendation, 0)
		mediumRecs := make([]models.Recommendation, 0)
		lowRecs := make([]models.Recommendation, 0)

		for _, rec := range result.Recommendations {
			switch rec.Priority {
			case "high":
				highRecs = append(highRecs, rec)
			case "medium":
				mediumRecs = append(mediumRecs, rec)
			default:
				lowRecs = append(lowRecs, rec)
			}
		}

		if len(highRecs) > 0 {
			sb.WriteString("### 🔴 高优先级建议\n\n")
			for _, rec := range highRecs {
				sb.WriteString(fmt.Sprintf("#### %s [%s]\n\n", rec.Title, rec.ID))
				sb.WriteString(fmt.Sprintf("**描述**: %s\n\n", rec.Description))
				sb.WriteString(fmt.Sprintf("**根本原因**: %s\n\n", rec.RootCause))
				sb.WriteString(fmt.Sprintf("**建议**: %s\n\n", rec.Suggestion))
				sb.WriteString(fmt.Sprintf("**证据**: %s\n\n", rec.Evidence))
				sb.WriteString(fmt.Sprintf("**影响**: %s\n\n", rec.Impact))
			}
		}

		if len(mediumRecs) > 0 {
			sb.WriteString("### 🟡 中优先级建议\n\n")
			for _, rec := range mediumRecs {
				sb.WriteString(fmt.Sprintf("#### %s [%s]\n\n", rec.Title, rec.ID))
				sb.WriteString(fmt.Sprintf("**描述**: %s\n\n", rec.Description))
				sb.WriteString(fmt.Sprintf("**建议**: %s\n\n", rec.Suggestion))
			}
		}

		if len(lowRecs) > 0 {
			sb.WriteString("### 🟢 低优先级建议\n\n")
			for _, rec := range lowRecs {
				sb.WriteString(fmt.Sprintf("#### %s [%s]\n\n", rec.Title, rec.ID))
				sb.WriteString(fmt.Sprintf("**描述**: %s\n\n", rec.Description))
				sb.WriteString(fmt.Sprintf("**建议**: %s\n\n", rec.Suggestion))
			}
		}
	}

	if len(result.Anomalies) > 0 {
		sb.WriteString("## 异常检测\n\n")
		for _, anom := range result.Anomalies {
			severityEmoji := "🟡"
			if anom.Severity == "high" {
				severityEmoji = "🔴"
			}

			sb.WriteString(fmt.Sprintf("### %s %s [%s]\n\n", severityEmoji, anom.Description, anom.ID))
			sb.WriteString(fmt.Sprintf("**类型**: %s\n\n", anom.Type))
			sb.WriteString(fmt.Sprintf("**时间**: %s\n\n", anom.Timestamp.Format(time.RFC3339)))
			sb.WriteString(fmt.Sprintf("**详情**: %s\n\n", anom.Details))
		}
	}

	_, err = file.WriteString(sb.String())
	return err
}

func (r *Reporter) exportSimulationCSV(result *models.SimulationResult, outputPath string) error {
	var file *os.File
	var err error

	if outputPath == "-" || outputPath == "" {
		file = os.Stdout
	} else {
		file, err = os.Create(outputPath)
		if err != nil {
			return err
		}
		defer file.Close()
	}

	writer := csv.NewWriter(file)
	defer writer.Flush()

	writer.Write([]string{"Simulation Report", result.ConfigName})
	writer.Write([]string{"Simulation Time", result.SimulationTime.Format(time.RFC3339)})
	writer.Write([]string{})

	writer.Write([]string{"Summary"})
	writer.Write([]string{"Metric", "Value"})
	writer.Write([]string{"Total Jobs", fmt.Sprintf("%d", result.Summary.TotalJobs)})
	writer.Write([]string{"Processed Jobs", fmt.Sprintf("%d", result.Summary.ProcessedJobs)})
	writer.Write([]string{"Success Rate", fmt.Sprintf("%.2f%%", result.Summary.SuccessRate*100)})
	writer.Write([]string{"Simulation Duration", result.Summary.SimulationDuration.String()})
	writer.Write([]string{"Real Duration (ms)", fmt.Sprintf("%d", result.Summary.RealDurationMs)})
	writer.Write([]string{"Peak Backlog", fmt.Sprintf("%d", result.Summary.PeakBacklog)})
	writer.Write([]string{"Max Wait Time (ms)", fmt.Sprintf("%d", result.Summary.MaxWaitTimeMs)})
	writer.Write([]string{"Throughput (jobs/sec)", fmt.Sprintf("%.2f", result.Summary.ThroughputPerSecond)})
	writer.Write([]string{})

	if result.Config != nil {
		writer.Write([]string{"Configuration"})
		writer.Write([]string{"Parameter", "Value"})
		writer.Write([]string{"Config Name", result.Config.Name})
		writer.Write([]string{"Description", result.Config.Description})
		writer.Write([]string{"Global Concurrency", fmt.Sprintf("%d", result.Config.GlobalConcurrency)})
		writer.Write([]string{"Simulation Duration", result.Config.SimulationDuration.String()})
		writer.Write([]string{})
	}

	if len(result.Issues) > 0 {
		writer.Write([]string{"Issues"})
		writer.Write([]string{"ID", "Type", "Severity", "Description"})
		for _, issue := range result.Issues {
			writer.Write([]string{issue.ID, issue.Type, issue.Severity, issue.Description})
		}
	}

	return nil
}

func (r *Reporter) exportSimulationMarkdown(result *models.SimulationResult, outputPath string) error {
	var file *os.File
	var err error

	if outputPath == "-" || outputPath == "" {
		file = os.Stdout
	} else {
		file, err = os.Create(outputPath)
		if err != nil {
			return err
		}
		defer file.Close()
	}

	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("# 模拟报告: %s\n\n", result.ConfigName))
	sb.WriteString(fmt.Sprintf("**模拟时间**: %s\n\n", result.SimulationTime.Format(time.RFC3339)))

	sb.WriteString("## 配置信息\n\n")
	if result.Config != nil {
		sb.WriteString(fmt.Sprintf("**名称**: %s\n\n", result.Config.Name))
		if result.Config.Description != "" {
			sb.WriteString(fmt.Sprintf("**描述**: %s\n\n", result.Config.Description))
		}
		if result.Config.GlobalConcurrency > 0 {
			sb.WriteString(fmt.Sprintf("**全局并发数**: %d\n\n", result.Config.GlobalConcurrency))
		}
		sb.WriteString(fmt.Sprintf("**模拟时长**: %s\n\n", result.Config.SimulationDuration))

		if len(result.Config.WorkerPools) > 0 {
			sb.WriteString("### Worker Pool 配置\n\n")
			sb.WriteString("| Pool 名称 | Worker 数 | 每 Worker 并发 | Batch Size | Poll Interval |\n")
			sb.WriteString("|-----------|-----------|----------------|------------|---------------|\n")
			for _, pool := range result.Config.WorkerPools {
				sb.WriteString(fmt.Sprintf("| %s | %d | %d | %d | %s |\n", pool.Name, pool.WorkerCount, pool.ConcurrencyPerWorker, pool.BatchSize, pool.PollInterval))
			}
			sb.WriteString("\n")
		}

		if result.Config.DefaultRetryPolicy != nil {
			sb.WriteString("### 重试策略\n\n")
			sb.WriteString("| 参数 | 值 |\n")
			sb.WriteString("|------|-----|\n")
			sb.WriteString(fmt.Sprintf("| 策略 | %s |\n", result.Config.DefaultRetryPolicy.Strategy))
			sb.WriteString(fmt.Sprintf("| 初始延迟 | %s |\n", result.Config.DefaultRetryPolicy.InitialDelay))
			sb.WriteString(fmt.Sprintf("| 最大延迟 | %s |\n", result.Config.DefaultRetryPolicy.MaxDelay))
			sb.WriteString(fmt.Sprintf("| 乘数 | %.2f |\n", result.Config.DefaultRetryPolicy.Multiplier))
			sb.WriteString(fmt.Sprintf("| 抖动 | %.2f |\n", result.Config.DefaultRetryPolicy.Jitter))
			sb.WriteString("\n")
		}
	}

	sb.WriteString("## 模拟结果\n\n")
	sb.WriteString("| 指标 | 数值 |\n")
	sb.WriteString("|------|------|\n")
	sb.WriteString(fmt.Sprintf("| 总任务数 | %d |\n", result.Summary.TotalJobs))
	sb.WriteString(fmt.Sprintf("| 已处理任务数 | %d |\n", result.Summary.ProcessedJobs))
	sb.WriteString(fmt.Sprintf("| 成功率 | %.2f%% |\n", result.Summary.SuccessRate*100))
	sb.WriteString(fmt.Sprintf("| 模拟时长 | %s |\n", result.Summary.SimulationDuration))
	sb.WriteString(fmt.Sprintf("| 实际执行时间 | %dms |\n", result.Summary.RealDurationMs))
	sb.WriteString(fmt.Sprintf("| 峰值积压 | %d |\n", result.Summary.PeakBacklog))
	sb.WriteString(fmt.Sprintf("| 最大等待时间 | %dms |\n", result.Summary.MaxWaitTimeMs))
	sb.WriteString(fmt.Sprintf("| 吞吐率 | %.2f 任务/秒 |\n", result.Summary.ThroughputPerSecond))
	sb.WriteString("\n")

	if result.JobStats != nil {
		sb.WriteString("## 任务统计\n\n")
		sb.WriteString("| 指标 | 数值 |\n")
		sb.WriteString("|------|------|\n")
		sb.WriteString(fmt.Sprintf("| 总任务数 | %d |\n", result.JobStats.TotalJobs))
		sb.WriteString(fmt.Sprintf("| 平均执行时间 | %.0fms |\n", result.JobStats.AvgExecutionTimeMs))
		sb.WriteString(fmt.Sprintf("| P50 执行时间 | %.0fms |\n", result.JobStats.P50ExecutionTimeMs))
		sb.WriteString(fmt.Sprintf("| P95 执行时间 | %.0fms |\n", result.JobStats.P95ExecutionTimeMs))
		sb.WriteString(fmt.Sprintf("| P99 执行时间 | %.0fms |\n", result.JobStats.P99ExecutionTimeMs))
		sb.WriteString(fmt.Sprintf("| 平均等待时间 | %.0fms |\n", result.JobStats.AvgWaitTimeMs))
		sb.WriteString(fmt.Sprintf("| 平均重试次数 | %.1f |\n", result.JobStats.AvgRetryCount))
		sb.WriteString(fmt.Sprintf("| 死信任务数 | %d |\n", result.JobStats.DeadLetterCount))
		sb.WriteString("\n")
	}

	if result.WorkerStats != nil {
		sb.WriteString("## Worker 统计\n\n")
		sb.WriteString("| 指标 | 数值 |\n")
		sb.WriteString("|------|------|\n")
		sb.WriteString(fmt.Sprintf("| 总 Worker 数 | %d |\n", result.WorkerStats.TotalWorkers))
		sb.WriteString(fmt.Sprintf("| 总并发数 | %d |\n", result.WorkerStats.TotalConcurrency))
		sb.WriteString(fmt.Sprintf("| 平均利用率 | %.2f%% |\n", result.WorkerStats.AvgUtilizationRate*100))
		sb.WriteString("\n")
	}

	if len(result.Issues) > 0 {
		sb.WriteString("## 模拟中检测到的问题\n\n")
		for _, issue := range result.Issues {
			severityEmoji := "🟡"
			if issue.Severity == "high" {
				severityEmoji = "🔴"
			}

			sb.WriteString(fmt.Sprintf("### %s %s [%s]\n\n", severityEmoji, issue.Description, issue.ID))
			sb.WriteString(fmt.Sprintf("**类型**: %s\n\n", issue.Type))
			sb.WriteString(fmt.Sprintf("**时间**: %s\n\n", issue.Timestamp.Format(time.RFC3339)))
			sb.WriteString(fmt.Sprintf("**详情**: %s\n\n", issue.Details))
		}
	}

	_, err = file.WriteString(sb.String())
	return err
}

func (r *Reporter) exportComparisonCSV(result *models.ComparisonResult, outputPath string) error {
	var file *os.File
	var err error

	if outputPath == "-" || outputPath == "" {
		file = os.Stdout
	} else {
		file, err = os.Create(outputPath)
		if err != nil {
			return err
		}
		defer file.Close()
	}

	writer := csv.NewWriter(file)
	defer writer.Flush()

	writer.Write([]string{"Comparison Report", result.Name})
	writer.Write([]string{"Comparison Time", result.ComparisonTime.Format(time.RFC3339)})
	writer.Write([]string{"Base Config", result.BaseConfigName})
	writer.Write([]string{"Compared Configs", strings.Join(result.ComparedConfigNames, ", ")})
	writer.Write([]string{})

	writer.Write([]string{"Summary"})
	writer.Write([]string{"Metric", "Value"})
	writer.Write([]string{"Total Simulations", fmt.Sprintf("%d", result.Summary.TotalSimulations)})
	writer.Write([]string{"Best Config", result.Summary.BestConfigName})
	writer.Write([]string{"Worst Config", result.Summary.WorstConfigName})
	writer.Write([]string{"Best Success Rate", fmt.Sprintf("%.2f%%", result.Summary.BestSuccessRate*100)})
	writer.Write([]string{"Best Throughput", fmt.Sprintf("%.2f jobs/sec", result.Summary.BestThroughput)})
	writer.Write([]string{"Best Max Wait Time", fmt.Sprintf("%d ms", result.Summary.BestMaxWaitTime)})
	writer.Write([]string{"Best Peak Backlog", fmt.Sprintf("%d", result.Summary.BestPeakBacklog)})
	writer.Write([]string{"Best Utilization", fmt.Sprintf("%.2f%%", result.Summary.BestUtilization*100)})
	writer.Write([]string{})

	if len(result.DetailedComparison.ByConfig) > 0 {
		writer.Write([]string{"Config Comparison"})
		writer.Write([]string{"Config", "Rank", "Score", "Success Rate", "Throughput", "Avg Wait Time", "Peak Backlog", "Utilization"})

		configs := make([]models.ConfigComparison, 0)
		for _, c := range result.DetailedComparison.ByConfig {
			configs = append(configs, c)
		}
		sort.Slice(configs, func(i, j int) bool {
			return configs[i].Rank < configs[j].Rank
		})

		for _, c := range configs {
			writer.Write([]string{
				c.ConfigName,
				fmt.Sprintf("%d", c.Rank),
				fmt.Sprintf("%.1f", c.Score),
				fmt.Sprintf("%.2f%%", c.SuccessRate*100),
				fmt.Sprintf("%.2f", c.Throughput),
				fmt.Sprintf("%.0fms", c.AvgWaitTimeMs),
				fmt.Sprintf("%d", c.PeakBacklog),
				fmt.Sprintf("%.2f%%", c.UtilizationRate*100),
			})
		}
	}

	return nil
}

func (r *Reporter) exportComparisonMarkdown(result *models.ComparisonResult, outputPath string) error {
	var file *os.File
	var err error

	if outputPath == "-" || outputPath == "" {
		file = os.Stdout
	} else {
		file, err = os.Create(outputPath)
		if err != nil {
			return err
		}
		defer file.Close()
	}

	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("# 配置对比报告: %s\n\n", result.Name))
	sb.WriteString(fmt.Sprintf("**对比时间**: %s\n\n", result.ComparisonTime.Format(time.RFC3339)))
	sb.WriteString(fmt.Sprintf("**基准配置**: %s\n\n", result.BaseConfigName))
	sb.WriteString(fmt.Sprintf("**对比配置**: %s\n\n", strings.Join(result.ComparedConfigNames, ", ")))

	sb.WriteString("## 概览\n\n")
	sb.WriteString("| 指标 | 数值 |\n")
	sb.WriteString("|------|------|\n")
	sb.WriteString(fmt.Sprintf("| 总模拟数 | %d |\n", result.Summary.TotalSimulations))
	sb.WriteString(fmt.Sprintf("| **最佳配置** | %s |\n", result.Summary.BestConfigName))
	sb.WriteString(fmt.Sprintf("| 最差配置 | %s |\n", result.Summary.WorstConfigName))
	sb.WriteString(fmt.Sprintf("| 最佳成功率 | %.2f%% |\n", result.Summary.BestSuccessRate*100))
	sb.WriteString(fmt.Sprintf("| 最佳吞吐率 | %.2f 任务/秒 |\n", result.Summary.BestThroughput))
	sb.WriteString(fmt.Sprintf("| 最佳最大等待时间 | %dms |\n", result.Summary.BestMaxWaitTime))
	sb.WriteString(fmt.Sprintf("| 最佳峰值积压 | %d |\n", result.Summary.BestPeakBacklog))
	sb.WriteString(fmt.Sprintf("| 最佳利用率 | %.2f%% |\n", result.Summary.BestUtilization*100))
	sb.WriteString("\n")

	if len(result.DetailedComparison.ByConfig) > 0 {
		sb.WriteString("## 配置详细对比\n\n")

		configs := make([]models.ConfigComparison, 0)
		for _, c := range result.DetailedComparison.ByConfig {
			configs = append(configs, c)
		}
		sort.Slice(configs, func(i, j int) bool {
			return configs[i].Rank < configs[j].Rank
		})

		sb.WriteString("| 排名 | 配置 | 综合评分 | 成功率 | 吞吐率 | 平均等待时间 | 峰值积压 | 利用率 |\n")
		sb.WriteString("|------|------|----------|--------|--------|--------------|----------|--------|\n")
		for _, c := range configs {
			rankMark := ""
			if c.Rank == 1 {
				rankMark = "🥇"
			} else if c.Rank == 2 {
				rankMark = "🥈"
			} else if c.Rank == 3 {
				rankMark = "🥉"
			}

			baseMark := ""
			if c.IsBase {
				baseMark = " (基准)"
			}

			sb.WriteString(fmt.Sprintf("| %d %s | %s%s | %.1f | %.2f%% (%.1f%%) | %.2f (%.2f) | %.0fms (%.0fms) | %d (%+d) | %.2f%% (%.1f%%) |\n",
				c.Rank, rankMark, c.ConfigName, baseMark,
				c.Score,
				c.SuccessRate*100, c.SuccessRateDiff*100,
				c.Throughput, c.ThroughputDiff,
				c.AvgWaitTimeMs, c.WaitTimeDiff,
				c.PeakBacklog, c.BacklogDiff,
				c.UtilizationRate*100, c.UtilizationDiff*100,
			))
		}
		sb.WriteString("\n")
		sb.WriteString("*注: 括号内为与基准配置的差值*\n\n")
	}

	if len(result.DetailedComparison.ByMetric) > 0 {
		sb.WriteString("## 各指标对比\n\n")

		metricNames := []string{"success_rate", "throughput", "avg_wait_time", "max_wait_time", "peak_backlog", "utilization", "retry_rate", "dlq_rate"}
		metricLabels := map[string]string{
			"success_rate":  "成功率",
			"throughput":    "吞吐率",
			"avg_wait_time": "平均等待时间",
			"max_wait_time": "最大等待时间",
			"peak_backlog":  "峰值积压",
			"utilization":   "利用率",
			"retry_rate":    "重试率",
			"dlq_rate":      "死信率",
		}

		for _, metricName := range metricNames {
			if metric, ok := result.DetailedComparison.ByMetric[metricName]; ok {
				sb.WriteString(fmt.Sprintf("### %s\n\n", metricLabels[metricName]))
				sb.WriteString("| 配置 | 数值 |\n")
				sb.WriteString("|------|------|\n")

				configs := make([]string, 0)
				for c := range metric.ByConfig {
					configs = append(configs, c)
				}
				sort.Strings(configs)

				for _, c := range configs {
					value := metric.ByConfig[c]
					mark := ""
					if (metric.HigherIsBetter && value == metric.BestValue) || (!metric.HigherIsBetter && value == metric.WorstValue) {
						mark = " ✅"
					} else if (metric.HigherIsBetter && value == metric.WorstValue) || (!metric.HigherIsBetter && value == metric.BestValue) {
						mark = " ❌"
					}

					formatValue := ""
					switch metricName {
					case "success_rate", "utilization", "retry_rate", "dlq_rate":
						formatValue = fmt.Sprintf("%.2f%%", value*100)
					case "avg_wait_time", "max_wait_time":
						formatValue = fmt.Sprintf("%.0fms", value)
					default:
						formatValue = fmt.Sprintf("%.2f", value)
					}

					sb.WriteString(fmt.Sprintf("| %s | %s%s |\n", c, formatValue, mark))
				}
				sb.WriteString("\n")
			}
		}
	}

	if len(result.DetailedComparison.Tradeoffs) > 0 {
		sb.WriteString("## 配置权衡分析\n\n")
		for _, tradeoff := range result.DetailedComparison.Tradeoffs {
			sb.WriteString(fmt.Sprintf("### %s\n\n", tradeoff.Description))
			sb.WriteString("| 维度 | 对比 |\n")
			sb.WriteString("|------|------|\n")
			for key, value := range tradeoff.TradeoffPoints {
				sb.WriteString(fmt.Sprintf("| %s | %s |\n", key, value))
			}
			sb.WriteString("\n")
			sb.WriteString(fmt.Sprintf("**建议**: %s\n\n", tradeoff.Recommendation))
		}
	}

	if len(result.Recommendations) > 0 {
		sb.WriteString("## 对比建议\n\n")
		for _, rec := range result.Recommendations {
			sb.WriteString(fmt.Sprintf("### %s [%s]\n\n", rec.Title, rec.ID))
			sb.WriteString(fmt.Sprintf("**描述**: %s\n\n", rec.Description))
			sb.WriteString(fmt.Sprintf("**根本原因**: %s\n\n", rec.RootCause))
			sb.WriteString(fmt.Sprintf("**建议**: %s\n\n", rec.Suggestion))
			sb.WriteString(fmt.Sprintf("**证据**: %s\n\n", rec.Evidence))
			sb.WriteString(fmt.Sprintf("**影响**: %s\n\n", rec.Impact))
		}
	}

	_, err = file.WriteString(sb.String())
	return err
}
