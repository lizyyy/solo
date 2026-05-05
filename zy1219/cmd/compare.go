package cmd

import (
	"fmt"
	"path/filepath"

	"gcinsight/analyzer"
	"gcinsight/exporter"
	"gcinsight/models"
	"gcinsight/storage"

	"github.com/spf13/cobra"
)

var (
	sessionAID int64
	sessionBID int64
)

var compareCmd = &cobra.Command{
	Use:   "compare",
	Short: "对比两个分析会话",
	Long:  `对比两个已保存的分析会话，输出差异和趋势。`,
	Run:   runCompare,
}

func init() {
	compareCmd.Flags().Int64VarP(&sessionAID, "session-a", "a", 0, "第一个会话 ID（必填）")
	compareCmd.Flags().Int64VarP(&sessionBID, "session-b", "b", 0, "第二个会话 ID（必填）")
	compareCmd.Flags().StringVarP(&outputFormat, "format", "f", "markdown", "输出格式: markdown 或 json")
	compareCmd.Flags().StringVarP(&outputPath, "output", "o", "", "输出文件路径（可选）")

	rootCmd.AddCommand(compareCmd)
}

func runCompare(cmd *cobra.Command, args []string) {
	if sessionAID == 0 || sessionBID == 0 {
		exitWithError("必须提供两个会话 ID: --session-a 和 --session-b", nil)
	}

	if sessionAID == sessionBID {
		exitWithError("两个会话 ID 不能相同", nil)
	}

	dbPath := filepath.Join(".", "gcinsight.db")
	store, err := storage.NewStorage(dbPath)
	if err != nil {
		exitWithError("无法初始化数据库", err)
	}
	defer store.Close()

	resultA, err := store.GetAnalysisResult(sessionAID)
	if err != nil {
		exitWithError(fmt.Sprintf("获取会话 %d 的分析结果失败", sessionAID), err)
	}

	resultB, err := store.GetAnalysisResult(sessionBID)
	if err != nil {
		exitWithError(fmt.Sprintf("获取会话 %d 的分析结果失败", sessionBID), err)
	}

	fmt.Printf("对比会话: A=%d, B=%d\n", sessionAID, sessionBID)
	fmt.Println("正在执行对比分析...")

	a := analyzer.NewAnalyzer()
	comparison := a.Compare(resultA, resultB)

	printComparisonSummary(comparison)

	if outputPath != "" {
		exp := exporter.NewExporter()
		if outputFormat == "json" {
			if err := exp.ExportComparisonJSON(comparison, outputPath); err != nil {
				exitWithError("导出 JSON 失败", err)
			}
			fmt.Printf("\n对比报告已导出到: %s\n", outputPath)
		} else {
			if err := exp.ExportComparisonMarkdown(comparison, outputPath); err != nil {
				exitWithError("导出 Markdown 失败", err)
			}
			fmt.Printf("\n对比报告已导出到: %s\n", outputPath)
		}
	}

	fmt.Println("\n对比完成！")
}

func printComparisonSummary(comparison *models.ComparisonResult) {
	fmt.Println("\n" + "=" + " 对比摘要 " + "=")
	fmt.Printf("\n【总体趋势】\n")
	fmt.Printf("  %s\n", comparison.OverallTrend)

	if len(comparison.Differences) > 0 {
		fmt.Printf("\n【关键差异】\n")
		for _, diff := range comparison.Differences {
			changeStr := fmt.Sprintf("%.2f%%", diff.ChangePercent)
			if diff.ChangePercent > 0 {
				changeStr = "+" + changeStr
			}
			significance := ""
			if diff.Significance == "significant" {
				significance = " [显著]"
			}
			fmt.Printf("  %s: %v → %v (%s)%s\n",
				diff.Metric, diff.ValueA, diff.ValueB, changeStr, significance)
		}
	}

	if len(comparison.KeyInsights) > 0 {
		fmt.Printf("\n【关键洞察】\n")
		for i, insight := range comparison.KeyInsights {
			impactEmoji := "ℹ️"
			if insight.Impact == "Positive" {
				impactEmoji = "✅"
			} else if insight.Impact == "Negative" {
				impactEmoji = "⚠️"
			}
			fmt.Printf("  %d. %s %s\n", i+1, impactEmoji, insight.Title)
			fmt.Printf("     %s\n", insight.Description)
		}
	}
}
