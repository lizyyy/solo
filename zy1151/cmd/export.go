package cmd

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"memreplay/internal/analyzer"
	"memreplay/internal/exporter"
	"memreplay/internal/models"
	"memreplay/internal/storage"
	"os"
	"sort"
	"strings"

	"github.com/spf13/cobra"
)

var exportCmd = &cobra.Command{
	Use:   "export",
	Short: "导出分析报告",
	Long: `导出分析报告为 Markdown、JSON 或 CSV 格式。

支持的报告类型：
1. 单批次分析报告 (--batch)
2. 批次对比报告 (--base + --target)

导出格式：
- markdown: 完整的人类可读报告
- json: 结构化数据
- csv: 问题列表表格

示例:
  memreplay export --batch v1.0.0 --format markdown --output ./analysis.md
  memreplay export --base v1.0.0 --target v1.1.0 --format json --output ./compare.json
  memreplay export --batch v1.0.0 --format csv --output ./findings.csv`,
	Run: func(cmd *cobra.Command, args []string) {
		batchName, _ := cmd.Flags().GetString("batch")
		baseName, _ := cmd.Flags().GetString("base")
		targetName, _ := cmd.Flags().GetString("target")
		format, _ := cmd.Flags().GetString("format")
		outputPath, _ := cmd.Flags().GetString("output")

		format = strings.ToLower(format)
		if format != "markdown" && format != "json" && format != "csv" {
			errorExit("格式参数无效，支持的格式: markdown, json, csv", nil)
			return
		}

		if outputPath == "" {
			errorExit("必须指定 --output 参数", nil)
			return
		}

		hasBatch := batchName != ""
		hasCompare := baseName != "" && targetName != ""

		if !hasBatch && !hasCompare {
			errorExit("必须指定 --batch 或同时指定 --base 和 --target", nil)
			return
		}

		exp := exporter.NewExporter()

		if hasCompare {
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

			compareResult, err := a.CompareBatches(baseBatch.ID, targetBatch.ID)
			if err != nil {
				errorExit("对比分析失败", err)
				return
			}

			switch format {
			case "markdown":
				if err := exp.ExportCompareToMarkdown(compareResult, outputPath); err != nil {
					errorExit("导出 Markdown 失败", err)
					return
				}
			case "json":
				data, err := exporterToJSON(compareResult)
				if err != nil {
					errorExit("序列化 JSON 失败", err)
					return
				}
				if err := writeFile(outputPath, data); err != nil {
					errorExit("写入文件失败", err)
					return
				}
			case "csv":
				if err := exportCompareToCSV(compareResult, outputPath); err != nil {
					errorExit("导出 CSV 失败", err)
					return
				}
			}

			fmt.Printf("✓ 对比报告已导出到: %s\n", outputPath)
			fmt.Println()
			fmt.Println("报告内容:")
			fmt.Printf("  基线批次: %s\n", baseName)
			fmt.Printf("  目标批次: %s\n", targetName)
			fmt.Printf("  置信度: %.2f%%\n", compareResult.Confidence*100)
			fmt.Printf("  差异项数: %d\n", len(compareResult.Differences))

		} else {
			batch, err := storage.GetBatchByName(batchName)
			if err != nil {
				errorExit(fmt.Sprintf("找不到批次: %s", batchName), err)
				return
			}

			analyzerConfig := analyzer.AnalysisConfig{}
			a := analyzer.NewAnalyzer(analyzerConfig)

			analysisResult, err := a.AnalyzeBatch(batch.ID)
			if err != nil {
				errorExit("分析失败", err)
				return
			}

			switch format {
			case "markdown":
				if err := exp.ExportToMarkdown(analysisResult, outputPath); err != nil {
					errorExit("导出 Markdown 失败", err)
					return
				}
			case "json":
				if err := exp.ExportToJSON(analysisResult, outputPath); err != nil {
					errorExit("导出 JSON 失败", err)
					return
				}
			case "csv":
				if err := exp.ExportToCSV(analysisResult, outputPath); err != nil {
					errorExit("导出 CSV 失败", err)
					return
				}
			}

			fmt.Printf("✓ 分析报告已导出到: %s\n", outputPath)
			fmt.Println()
			fmt.Println("报告内容:")
			fmt.Printf("  批次: %s\n", batchName)
			fmt.Printf("  风险等级: %s\n", formatRiskLevel(analysisResult.RiskLevel))
			fmt.Printf("  置信度: %.2f%%\n", analysisResult.Confidence*100)
			fmt.Printf("  发现问题: %d 个\n", len(analysisResult.Findings))
			fmt.Printf("  建议动作: %d 条\n", len(analysisResult.Recommendations))
		}
	},
}

func init() {
	rootCmd.AddCommand(exportCmd)

	exportCmd.Flags().StringP("batch", "b", "", "目标批次名称")
	exportCmd.Flags().String("base", "", "基线批次名称 (用于对比)")
	exportCmd.Flags().String("target", "", "目标批次名称 (用于对比)")
	exportCmd.Flags().StringP("format", "f", "markdown", "导出格式: markdown, json, csv")
	exportCmd.Flags().StringP("output", "o", "", "输出文件路径 (必填)")

	_ = exportCmd.MarkFlagRequired("output")
}

func exporterToJSON(compare *models.CompareResult) ([]byte, error) {
	return json.MarshalIndent(compare, "", "  ")
}

func writeFile(path string, data []byte) error {
	return os.WriteFile(path, data, 0644)
}

func exportCompareToCSV(compare *models.CompareResult, outputPath string) error {
	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("创建文件失败: %w", err)
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	if err := writer.Write([]string{"类别", "指标", "基线值", "目标值", "变化(%)", "重要性", "描述"}); err != nil {
		return fmt.Errorf("写入 CSV 表头失败: %w", err)
	}

	sort.Slice(compare.Differences, func(i, j int) bool {
		importanceOrder := map[string]int{"high": 0, "medium": 1, "low": 2}
		return importanceOrder[compare.Differences[i].Importance] < importanceOrder[compare.Differences[j].Importance]
	})

	for _, diff := range compare.Differences {
		changeSymbol := ""
		if diff.ChangePct > 0 {
			changeSymbol = "+"
		}
		if err := writer.Write([]string{
			diff.Category,
			diff.Metric,
			diff.BaseValue,
			diff.TargetValue,
			fmt.Sprintf("%s%.2f%%", changeSymbol, diff.ChangePct),
			diff.Importance,
			diff.Description,
		}); err != nil {
			return fmt.Errorf("写入 CSV 行失败: %w", err)
		}
	}

	return nil
}
