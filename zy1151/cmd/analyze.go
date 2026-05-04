package cmd

import (
	"fmt"
	"memreplay/internal/analyzer"
	"memreplay/internal/storage"

	"github.com/spf13/cobra"
)

var analyzeCmd = &cobra.Command{
	Use:   "analyze",
	Short: "分析批次中的内存问题",
	Long: `对指定批次进行综合内存问题分析。

分析内容包括：
- 内存增长趋势 (RSS/Heap/Objects)
- GC 行为分析 (pause time, CPU fraction)
- Goroutine 泄漏检测
- 分配点分析
- 长期存活对象检测
- 缓存风险评估
- 配置风险检查

示例:
  memreplay analyze --batch v1.0.0
  memreplay analyze --batch v1.0.0 --confidence 0.7`,
	Run: func(cmd *cobra.Command, args []string) {
		batchName, _ := cmd.Flags().GetString("batch")
		confidenceThreshold, _ := cmd.Flags().GetFloat64("confidence")

		if batchName == "" {
			errorExit("必须指定 --batch 参数", nil)
			return
		}

		batch, err := storage.GetBatchByName(batchName)
		if err != nil {
			errorExit(fmt.Sprintf("找不到批次: %s", batchName), err)
			return
		}

		analyzerConfig := analyzer.AnalysisConfig{
			ConfidenceThreshold: confidenceThreshold,
		}

		a := analyzer.NewAnalyzer(analyzerConfig)

		result, err := a.AnalyzeBatch(batch.ID)
		if err != nil {
			errorExit("分析失败", err)
			return
		}

		if err := storage.SaveAnalysisResult(result); err != nil {
			errorExit("保存分析结果失败", err)
			return
		}

		fmt.Println("=")
		fmt.Println("  内存问题分析报告")
		fmt.Println("=")
		fmt.Println()
		fmt.Printf("批次: %s\n", batchName)
		fmt.Printf("风险等级: %s\n", formatRiskLevel(result.RiskLevel))
		fmt.Printf("置信度: %.2f%%\n", result.Confidence*100)
		fmt.Println()
		fmt.Println("结论:")
		fmt.Printf("  %s\n", result.Conclusion)
		fmt.Println()

		if len(result.Findings) > 0 {
			fmt.Println("发现的问题:")
			for i, finding := range result.Findings {
				fmt.Printf("\n  %d. [%s] %s (置信度: %.0f%%)\n",
					i+1, formatSeverity(finding.Severity), finding.Title, finding.Confidence*100)
				fmt.Printf("     类别: %s\n", finding.Category)
				fmt.Printf("     来源: %s\n", finding.Source)
				fmt.Printf("     描述: %s\n", finding.Description)
			}
		}

		if len(result.Recommendations) > 0 {
			fmt.Println()
			fmt.Println("建议动作:")
			for i, rec := range result.Recommendations {
				fmt.Printf("\n  %d. [%s] %s\n", i+1, rec.Priority, rec.Action)
				if rec.Details != "" {
					fmt.Printf("     %s\n", rec.Details)
				}
			}
		}

		fmt.Println()
		fmt.Println("下一步:")
		fmt.Printf("  memreplay export --batch %s --format markdown --output ./analysis-report.md\n", batchName)
		fmt.Printf("  memreplay export --batch %s --format json --output ./analysis-report.json\n", batchName)
	},
}

func formatRiskLevel(level string) string {
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

func formatSeverity(severity string) string {
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

func init() {
	rootCmd.AddCommand(analyzeCmd)

	analyzeCmd.Flags().StringP("batch", "b", "", "目标批次名称 (必填)")
	analyzeCmd.Flags().Float64P("confidence", "c", 0.5, "置信度阈值 (0.0-1.0)")

	_ = analyzeCmd.MarkFlagRequired("batch")
}
