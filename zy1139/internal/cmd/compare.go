package cmd

import (
	"fmt"
	"time"

	"capgate/internal/config"
	"capgate/internal/engine"
	"capgate/internal/models"

	"github.com/spf13/cobra"
)

var compareCmd = &cobra.Command{
	Use:   "compare",
	Short: "对比 baseline 和本次压测结果",
	Long: `将当前压测结果与基线数据对比，识别退化的接口、容量瓶颈，并给出降级策略建议。`,
	RunE: func(cmd *cobra.Command, args []string) error {
		baselineFile, _ := cmd.Flags().GetString("baseline")
		resultFile, _ := cmd.Flags().GetString("result")
		outputDir, _ := cmd.Flags().GetString("output")
		compareName, _ := cmd.Flags().GetString("name")

		if baselineFile == "" {
			baselineFile = "baseline.csv"
		}
		if resultFile == "" {
			resultFile = "./results/latest-result.json"
		}
		if outputDir == "" {
			outputDir = "./results"
		}
		if compareName == "" {
			compareName = fmt.Sprintf("compare-%s", time.Now().Format("20060102-150405"))
		}

		fmt.Println("📊 开始对比分析...")
		fmt.Printf("  基线数据: %s\n", baselineFile)
		fmt.Printf("  结果文件: %s\n", resultFile)
		fmt.Printf("  输出目录: %s\n\n", outputDir)

		if err := config.EnsureDir(outputDir); err != nil {
			return fmt.Errorf("创建输出目录失败: %w", err)
		}

		fmt.Println("📥 加载数据...")

		baseline, err := config.LoadBaseline(baselineFile)
		if err != nil {
			return fmt.Errorf("加载基线数据失败: %w", err)
		}
		fmt.Printf("  ✓ 加载 %d 条基线记录\n", len(baseline))

		currentResult, err := config.LoadRunResult(resultFile)
		if err != nil {
			return fmt.Errorf("加载结果文件失败: %w", err)
		}
		fmt.Printf("  ✓ 加载运行结果: %s (时间: %s)\n",
			currentResult.PlanName,
			time.Unix(currentResult.Timestamp, 0).Format("2006-01-02 15:04:05"))

		fmt.Println("\n🔍 执行对比分析...")

		comparator := engine.NewComparator(baseline, currentResult)
		compareResult := comparator.Compare()

		fmt.Println("\n📈 对比结果汇总:")
		fmt.Printf("  总体状态: ")
		switch compareResult.OverallStatus {
		case models.ComparisonPass:
			fmt.Println("✅ PASS - 无明显退化")
		case models.ComparisonWarning:
			fmt.Println("⚠️  WARNING - 轻微退化")
		case models.ComparisonDegraded:
			fmt.Println("❌ DEGRADED - 检测到性能退化")
		}

		if len(compareResult.DegradedRoutes) > 0 {
			fmt.Printf("\n  ❌ 退化接口 (%d 个):\n", len(compareResult.DegradedRoutes))
			for _, r := range compareResult.DegradedRoutes {
				fmt.Printf("    - %s\n", r)
			}
		}

		if len(compareResult.ImprovedRoutes) > 0 {
			fmt.Printf("\n  ✅ 改进接口 (%d 个):\n", len(compareResult.ImprovedRoutes))
			for _, r := range compareResult.ImprovedRoutes {
				fmt.Printf("    - %s\n", r)
			}
		}

		if len(compareResult.Bottlenecks) > 0 {
			fmt.Printf("\n  ⚠️  容量瓶颈 (%d 个):\n", len(compareResult.Bottlenecks))
			for _, b := range compareResult.Bottlenecks {
				severityIcon := "🟢"
				switch b.Severity {
				case models.SeverityCritical:
					severityIcon = "🔴"
				case models.SeverityMajor:
					severityIcon = "🟠"
				case models.SeverityModerate:
					severityIcon = "🟡"
				}
				fmt.Printf("    %s [%s] %s\n", severityIcon, b.Type, b.Description)
			}
		}

		if len(compareResult.Recommendations) > 0 {
			fmt.Printf("\n  💡 建议动作:\n")
			for i, rec := range compareResult.Recommendations {
				riskIcon := "🟢"
				switch rec.RiskLevel {
				case models.RiskCritical:
					riskIcon = "🔴"
				case models.RiskHigh:
					riskIcon = "🟠"
				case models.RiskMedium:
					riskIcon = "🟡"
				}
				fmt.Printf("    %d. %s [%s] %s\n", i+1, riskIcon, rec.Action, rec.Description)
				if rec.Justification != "" {
					fmt.Printf("       理由: %s\n", rec.Justification)
				}
			}
		}

		compareResult.BaselineSource = baselineFile
		compareResult.CurrentSource = resultFile

		outputFile := fmt.Sprintf("%s/%s-comparison.json", outputDir, compareName)
		if err := config.SaveComparisonResult(compareResult, outputFile); err != nil {
			return fmt.Errorf("保存对比结果失败: %w", err)
		}
		fmt.Printf("\n💾 对比结果已保存到: %s\n", outputFile)

		if compareResult.OverallStatus == models.ComparisonDegraded {
			fmt.Println("\n⚠️  检测到性能退化！建议谨慎上线或回滚。")
		} else if compareResult.OverallStatus == models.ComparisonWarning {
			fmt.Println("\n⚠️  部分指标有退化迹象，建议进一步检查。")
		} else {
			fmt.Println("\n✅ 对比分析完成，无明显退化。")
		}

		return nil
	},
}

func init() {
	compareCmd.Flags().StringP("baseline", "b", "", "基线数据文件路径 (默认: baseline.csv)")
	compareCmd.Flags().StringP("result", "r", "", "当前结果文件路径 (默认: ./results/latest-result.json)")
	compareCmd.Flags().StringP("output", "o", "", "输出目录 (默认: ./results)")
	compareCmd.Flags().StringP("name", "n", "", "对比名称 (默认: compare-时间戳)")
}
