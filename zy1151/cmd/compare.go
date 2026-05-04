package cmd

import (
	"fmt"
	"memreplay/internal/analyzer"
	"memreplay/internal/models"
	"memreplay/internal/storage"

	"github.com/spf13/cobra"
)

var compareCmd = &cobra.Command{
	Use:   "compare",
	Short: "对比两个批次的差异",
	Long: `对比两个批次的差异，找出可能导致内存问题的变化。

对比内容包括：
- 内存指标变化 (heap_alloc, heap_objects, RSS)
- GC 行为变化
- Goroutine 数量和状态变化
- 流量指标变化
- 配置项变化
- 分配点变化

示例:
  memreplay compare --base v1.0.0 --target v1.1.0
  memreplay compare --base before-release --target after-release`,
	Run: func(cmd *cobra.Command, args []string) {
		baseName, _ := cmd.Flags().GetString("base")
		targetName, _ := cmd.Flags().GetString("target")

		if baseName == "" || targetName == "" {
			errorExit("必须指定 --base 和 --target 参数", nil)
			return
		}

		baseBatch, err := storage.GetBatchByName(baseName)
		if err != nil {
			errorExit(fmt.Sprintf("找不到基线批次: %s", baseName), err)
			return
		}

		targetBatch, err := storage.GetBatchByName(targetName)
		if err != nil {
			errorExit(fmt.Sprintf("找不到目标批次: %s", targetName), err)
			return
		}

		analyzerConfig := analyzer.AnalysisConfig{}
		a := analyzer.NewAnalyzer(analyzerConfig)

		result, err := a.CompareBatches(baseBatch.ID, targetBatch.ID)
		if err != nil {
			errorExit("对比分析失败", err)
			return
		}

		if err := storage.SaveCompareResult(result); err != nil {
			errorExit("保存对比结果失败", err)
			return
		}

		fmt.Println("=")
		fmt.Println("  批次对比报告")
		fmt.Println("=")
		fmt.Println()
		fmt.Printf("基线批次: %s\n", baseName)
		fmt.Printf("目标批次: %s\n", targetName)
		fmt.Printf("置信度: %.2f%%\n", result.Confidence*100)
		fmt.Println()
		fmt.Println("结论:")
		fmt.Printf("  %s\n", result.Conclusion)
		fmt.Println()

		if len(result.Differences) > 0 {
			fmt.Println("差异分析:")
			fmt.Println()

			highDiffs := []models.Difference{}
			mediumDiffs := []models.Difference{}
			lowDiffs := []models.Difference{}

			for _, diff := range result.Differences {
				switch diff.Importance {
				case "high":
					highDiffs = append(highDiffs, diff)
				case "medium":
					mediumDiffs = append(mediumDiffs, diff)
				default:
					lowDiffs = append(lowDiffs, diff)
				}
			}

			if len(highDiffs) > 0 {
				fmt.Println("  【高重要性】")
				for _, diff := range highDiffs {
					printDifference(diff)
				}
			}

			if len(mediumDiffs) > 0 {
				fmt.Println("  【中等重要性】")
				for _, diff := range mediumDiffs {
					printDifference(diff)
				}
			}

			if len(lowDiffs) > 0 {
				fmt.Println("  【低重要性】")
				for _, diff := range lowDiffs {
					printDifference(diff)
				}
			}
		}

		fmt.Println()
		fmt.Println("下一步:")
		fmt.Printf("  memreplay export --base %s --target %s --format markdown --output ./compare-report.md\n",
			baseName, targetName)
	},
}

func printDifference(diff models.Difference) {
	changeSymbol := ""
	if diff.ChangePct > 0 {
		changeSymbol = "+"
	}

	fmt.Printf("\n    类别: %s\n", diff.Category)
	fmt.Printf("    指标: %s\n", diff.Metric)
	fmt.Printf("    基线值: %s\n", diff.BaseValue)
	fmt.Printf("    目标值: %s\n", diff.TargetValue)
	fmt.Printf("    变化: %s%.2f%%\n", changeSymbol, diff.ChangePct)
	fmt.Printf("    描述: %s\n", diff.Description)
}

func init() {
	rootCmd.AddCommand(compareCmd)

	compareCmd.Flags().StringP("base", "b", "", "基线批次名称 (必填)")
	compareCmd.Flags().StringP("target", "t", "", "目标批次名称 (必填)")

	_ = compareCmd.MarkFlagRequired("base")
	_ = compareCmd.MarkFlagRequired("target")
}
