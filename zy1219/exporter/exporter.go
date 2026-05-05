package exporter

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"gcinsight/models"
)

type Exporter struct {
}

func NewExporter() *Exporter {
	return &Exporter{}
}

func (e *Exporter) ExportMarkdown(result *models.AnalysisResult, filePath string) error {
	content := e.generateMarkdown(result)
	return os.WriteFile(filePath, []byte(content), 0644)
}

func (e *Exporter) ExportJSON(result *models.AnalysisResult, filePath string) error {
	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}
	return os.WriteFile(filePath, data, 0644)
}

func (e *Exporter) ExportComparisonMarkdown(comparison *models.ComparisonResult, filePath string) error {
	content := e.generateComparisonMarkdown(comparison)
	return os.WriteFile(filePath, []byte(content), 0644)
}

func (e *Exporter) ExportComparisonJSON(comparison *models.ComparisonResult, filePath string) error {
	data, err := json.MarshalIndent(comparison, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}
	return os.WriteFile(filePath, data, 0644)
}

func (e *Exporter) generateMarkdown(result *models.AnalysisResult) string {
	var sb string

	sb += "# GC 分析报告\n\n"
	sb += fmt.Sprintf("**分析时间**: %s\n\n", result.CreatedAt.Format(time.RFC3339))
	sb += "---\n\n"

	sb += "## 一、基本指标\n\n"
	sb += "| 指标 | 值 |\n"
	sb += "|------|-----|\n"
	sb += fmt.Sprintf("| GC 总次数 | %d |\n", result.RawMetrics.TotalGCs)
	sb += fmt.Sprintf("| 总暂停时间 | %v |\n", result.RawMetrics.TotalPauseTime)
	sb += fmt.Sprintf("| 平均 GC CPU 占比 | %.2f%% |\n", result.RawMetrics.MeanGCCPUFraction*100)
	sb += fmt.Sprintf("| GOGC | %d |\n", result.RawMetrics.GOGC)
	if result.RawMetrics.GOMEMLIMIT > 0 {
		sb += fmt.Sprintf("| GOMEMLIMIT | %s |\n", formatBytes(result.RawMetrics.GOMEMLIMIT))
	}
	sb += fmt.Sprintf("| 分析时间范围 | %s - %s |\n",
		result.RawMetrics.StartTime.Format(time.RFC3339),
		result.RawMetrics.EndTime.Format(time.RFC3339))
	sb += "\n"

	sb += "## 二、暂停分布\n\n"
	sb += "### 统计摘要\n\n"
	sb += "| 指标 | 值 |\n"
	sb += "|------|-----|\n"
	sb += fmt.Sprintf("| 总暂停次数 | %d |\n", result.PauseDistribution.TotalPauses)
	sb += fmt.Sprintf("| 平均暂停 | %v |\n", result.PauseDistribution.MeanPause)
	sb += fmt.Sprintf("| 中位数暂停 | %v |\n", result.PauseDistribution.MedianPause)
	sb += fmt.Sprintf("| P95 暂停 | %v |\n", result.PauseDistribution.P95Pause)
	sb += fmt.Sprintf("| P99 暂停 | %v |\n", result.PauseDistribution.P99Pause)
	sb += fmt.Sprintf("| 最大暂停 | %v |\n", result.PauseDistribution.MaxPause)
	sb += fmt.Sprintf("| 最小暂停 | %v |\n", result.PauseDistribution.MinPause)
	sb += "\n"

	if len(result.PauseDistribution.STWPauses) > 0 {
		sb += fmt.Sprintf("### STW 暂停 (%d 次)\n\n", len(result.PauseDistribution.STWPauses))
		if len(result.PauseDistribution.STWPauses) > 5 {
			sb += "最长的 5 次 STW 暂停：\n\n"
			sb += "| GC 编号 | 暂停时间 | 阶段 | 时间 |\n"
			sb += "|---------|----------|------|------|\n"
			for i := len(result.PauseDistribution.STWPauses) - 1; i >= 0 && i >= len(result.PauseDistribution.STWPauses)-5; i-- {
				p := result.PauseDistribution.STWPauses[i]
				sb += fmt.Sprintf("| %d | %v | %s | %s |\n",
					p.GCNumber, p.Duration, p.GCPhase, p.Timestamp.Format(time.RFC3339))
			}
		} else {
			sb += "| GC 编号 | 暂停时间 | 阶段 | 时间 |\n"
			sb += "|---------|----------|------|------|\n"
			for _, p := range result.PauseDistribution.STWPauses {
				sb += fmt.Sprintf("| %d | %v | %s | %s |\n",
					p.GCNumber, p.Duration, p.GCPhase, p.Timestamp.Format(time.RFC3339))
			}
		}
		sb += "\n"
	}

	sb += "## 三、堆目标偏差分析\n\n"
	sb += "### 统计摘要\n\n"
	sb += "| 指标 | 值 |\n"
	sb += "|------|-----|\n"
	sb += fmt.Sprintf("| 目标达成数 | %d |\n", result.HeapGoalDeviation.GoalAchieved)
	sb += fmt.Sprintf("| 目标未达成数 | %d |\n", result.HeapGoalDeviation.GoalMissed)
	if result.HeapGoalDeviation.TotalGCs > 0 {
		goalRate := float64(result.HeapGoalDeviation.GoalAchieved) / float64(result.HeapGoalDeviation.TotalGCs) * 100
		sb += fmt.Sprintf("| 目标达成率 | %.1f%% |\n", goalRate)
	}
	sb += fmt.Sprintf("| 平均偏差 | %.2f%% |\n", result.HeapGoalDeviation.MeanDeviation)
	sb += fmt.Sprintf("| 最大偏差 | %.2f%% |\n", result.HeapGoalDeviation.MaxDeviation)
	sb += "\n"

	if len(result.HeapGoalDeviation.GoalDetails) > 0 {
		sb += "### 目标详情（最近 10 次）\n\n"
		sb += "| GC 编号 | 堆目标 | 实际堆使用 | 偏差 | 达成 |\n"
		sb += "|---------|--------|------------|------|------|\n"
		startIdx := 0
		if len(result.HeapGoalDeviation.GoalDetails) > 10 {
			startIdx = len(result.HeapGoalDeviation.GoalDetails) - 10
		}
		for i := startIdx; i < len(result.HeapGoalDeviation.GoalDetails); i++ {
			d := result.HeapGoalDeviation.GoalDetails[i]
			achieved := "❌"
			if d.Achieved {
				achieved = "✅"
			}
			sb += fmt.Sprintf("| %d | %s | %s | %.2f%% | %s |\n",
				d.GCNumber, formatBytes(d.HeapGoal), formatBytes(d.ActualHeap), d.Deviation, achieved)
		}
		sb += "\n"
	}

	sb += "## 四、GC Assist 压力分析\n\n"
	if result.AssistPressure.TotalAssists == 0 {
		sb += "✅ 没有检测到 GC assist 压力。\n\n"
	} else {
		sb += "### 统计摘要\n\n"
		sb += "| 指标 | 值 |\n"
		sb += "|------|-----|\n"
		sb += fmt.Sprintf("| Assist 总次数 | %d |\n", result.AssistPressure.TotalAssists)
		sb += fmt.Sprintf("| 总 Assist 字节 | %s |\n", formatBytes(result.AssistPressure.TotalAssistedBytes))
		sb += fmt.Sprintf("| 平均每次 Assist | %s |\n", formatBytes(result.AssistPressure.MeanAssistBytes))
		sb += fmt.Sprintf("| 最大单次 Assist | %s |\n", formatBytes(result.AssistPressure.MaxAssistBytes))
		sb += "\n"

		if len(result.AssistPressure.HighPressureGCs) > 0 {
			sb += "⚠️ **高压 GC 编号**: "
			for i, gc := range result.AssistPressure.HighPressureGCs {
				if i > 0 {
					sb += ", "
				}
				sb += fmt.Sprintf("#%d", gc)
			}
			sb += "\n\n"
		}
	}

	sb += "## 五、内存峰值分析\n\n"
	sb += "| 指标 | 值 | 时间 |\n"
	sb += "|------|-----|------|\n"
	sb += fmt.Sprintf("| 堆分配峰值 | %s | %s |\n",
		formatBytes(result.MemoryPeaks.PeakHeapAlloc),
		result.MemoryPeaks.PeakTimestamp.Format(time.RFC3339))
	sb += fmt.Sprintf("| 堆使用峰值 | %s | %s |\n",
		formatBytes(result.MemoryPeaks.PeakHeapInUse),
		result.MemoryPeaks.PeakTimestamp.Format(time.RFC3339))
	sb += fmt.Sprintf("| 系统内存峰值 | %s | %s |\n",
		formatBytes(result.MemoryPeaks.PeakHeapSys),
		result.MemoryPeaks.PeakTimestamp.Format(time.RFC3339))
	sb += fmt.Sprintf("| 对象数峰值 | %d | %s |\n",
		result.MemoryPeaks.PeakObjects,
		result.MemoryPeaks.PeakTimestamp.Format(time.RFC3339))
	sb += "\n"

	if len(result.Recommendations) > 0 {
		sb += "## 六、调参建议\n\n"
		for i, rec := range result.Recommendations {
			severityEmoji := "ℹ️"
			if rec.Severity == "High" {
				severityEmoji = "⚠️"
			} else if rec.Severity == "Critical" {
				severityEmoji = "🚨"
			}

			sb += fmt.Sprintf("### %d. %s %s [%s]\n\n", i+1, severityEmoji, rec.Title, rec.Category)
			sb += fmt.Sprintf("**描述**: %s\n\n", rec.Description)
			sb += fmt.Sprintf("**建议**: %s\n\n", rec.Action)
		}
	} else {
		sb += "## 六、调参建议\n\n"
		sb += "✅ 没有发现需要特别关注的问题。\n\n"
	}

	sb += "---\n\n"
	sb += "*此报告由 GCInsight 生成*\n"

	return sb
}

func (e *Exporter) generateComparisonMarkdown(comparison *models.ComparisonResult) string {
	var sb string

	sb += "# GC 分析对比报告\n\n"
	sb += fmt.Sprintf("**对比时间**: %s\n\n", comparison.CreatedAt.Format(time.RFC3339))
	sb += fmt.Sprintf("**会话 A**: ID %d\n", comparison.SessionAID)
	sb += fmt.Sprintf("**会话 B**: ID %d\n\n", comparison.SessionBID)
	sb += "---\n\n"

	sb += "## 一、总体趋势\n\n"
	sb += fmt.Sprintf("**总体趋势**: %s\n\n", comparison.OverallTrend)

	if len(comparison.Differences) > 0 {
		sb += "## 二、关键差异\n\n"
		sb += "| 指标 | 会话 A | 会话 B | 变化 | 显著性 |\n"
		sb += "|------|--------|--------|------|--------|\n"
		for _, diff := range comparison.Differences {
			changeStr := fmt.Sprintf("%.2f%%", diff.ChangePercent)
			if diff.ChangePercent > 0 {
				changeStr = "+" + changeStr
			}
			significance := "普通"
			if diff.Significance == "significant" {
				significance = "显著"
			}
			sb += fmt.Sprintf("| %s | %v | %v | %s | %s |\n",
				diff.Metric, diff.ValueA, diff.ValueB, changeStr, significance)
		}
		sb += "\n"
	}

	if len(comparison.KeyInsights) > 0 {
		sb += "## 三、关键洞察\n\n"
		for i, insight := range comparison.KeyInsights {
			impactEmoji := "ℹ️"
			if insight.Impact == "Positive" {
				impactEmoji = "✅"
			} else if insight.Impact == "Negative" {
				impactEmoji = "⚠️"
			}
			sb += fmt.Sprintf("### %d. %s %s\n\n", i+1, impactEmoji, insight.Title)
			sb += fmt.Sprintf("%s\n\n", insight.Description)
		}
	}

	sb += "---\n\n"
	sb += "*此对比报告由 GCInsight 生成*\n"

	return sb
}

func formatBytes(bytes uint64) string {
	const (
		KB = 1024
		MB = 1024 * KB
		GB = 1024 * MB
		TB = 1024 * GB
	)

	switch {
	case bytes >= TB:
		return fmt.Sprintf("%.2f TB", float64(bytes)/float64(TB))
	case bytes >= GB:
		return fmt.Sprintf("%.2f GB", float64(bytes)/float64(GB))
	case bytes >= MB:
		return fmt.Sprintf("%.2f MB", float64(bytes)/float64(MB))
	case bytes >= KB:
		return fmt.Sprintf("%.2f KB", float64(bytes)/float64(KB))
	default:
		return fmt.Sprintf("%d B", bytes)
	}
}
