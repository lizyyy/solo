package cmd

import (
	"fmt"
	"time"

	"capgate/internal/config"
	"capgate/internal/models"
	"capgate/internal/reporter"

	"github.com/spf13/cobra"
)

var exportCmd = &cobra.Command{
	Use:   "export",
	Short: "导出多种格式的报告",
	Long: `将压测结果或对比结果导出为 Markdown、JSON 或 CSV 格式的报告。`,
	RunE: func(cmd *cobra.Command, args []string) error {
		resultFile, _ := cmd.Flags().GetString("result")
		compareFile, _ := cmd.Flags().GetString("compare")
		format, _ := cmd.Flags().GetString("format")
		outputDir, _ := cmd.Flags().GetString("output")
		exportName, _ := cmd.Flags().GetString("name")

		if outputDir == "" {
			outputDir = "./results"
		}
		if exportName == "" {
			exportName = fmt.Sprintf("report-%s", time.Now().Format("20060102-150405"))
		}

		if format == "" {
			format = "md"
		}

		validFormats := map[string]bool{"md": true, "json": true, "csv": true}
		if !validFormats[format] {
			return fmt.Errorf("不支持的格式: %s，支持的格式: md, json, csv", format)
		}

		fmt.Println("📄 开始导出报告...")
		fmt.Printf("  结果文件: %s\n", resultFile)
		fmt.Printf("  对比文件: %s\n", compareFile)
		fmt.Printf("  格式: %s\n", format)
		fmt.Printf("  输出目录: %s\n\n", outputDir)

		if err := config.EnsureDir(outputDir); err != nil {
			return fmt.Errorf("创建输出目录失败: %w", err)
		}

		var runResult *models.RunResult
		var compareResult *models.ComparisonResult

		if resultFile != "" && config.FileExists(resultFile) {
			fmt.Printf("📥 加载结果文件: %s\n", resultFile)
			var err error
			runResult, err = config.LoadRunResult(resultFile)
			if err != nil {
				return fmt.Errorf("加载结果文件失败: %w", err)
			}
			fmt.Printf("  ✓ 加载成功: %s\n", runResult.PlanName)
		}

		if compareFile != "" && config.FileExists(compareFile) {
			fmt.Printf("📥 加载对比文件: %s\n", compareFile)
			var err error
			compareResult, err = config.LoadComparisonResult(compareFile)
			if err != nil {
				return fmt.Errorf("加载对比文件失败: %w", err)
			}
			fmt.Printf("  ✓ 加载成功\n")
		}

		if runResult == nil && compareResult == nil {
			return fmt.Errorf("没有可导出的数据，请提供 -result 或 -compare 参数")
		}

		generator := reporter.NewGenerator(runResult, compareResult)

		var outputFile string

		switch format {
		case "md":
			outputFile = fmt.Sprintf("%s/%s.md", outputDir, exportName)
			fmt.Printf("\n📝 生成 Markdown 报告...\n")
			content := generator.GenerateMarkdown()
			if err := reporter.SaveMarkdown(content, outputFile); err != nil {
				return fmt.Errorf("保存 Markdown 失败: %w", err)
			}

		case "json":
			outputFile = fmt.Sprintf("%s/%s.json", outputDir, exportName)
			fmt.Printf("\n📝 生成 JSON 报告...\n")
			content, err := generator.GenerateJSON()
			if err != nil {
				return fmt.Errorf("生成 JSON 失败: %w", err)
			}
			if err := reporter.SaveJSON(content, outputFile); err != nil {
				return fmt.Errorf("保存 JSON 失败: %w", err)
			}

		case "csv":
			outputFile = fmt.Sprintf("%s/%s.csv", outputDir, exportName)
			fmt.Printf("\n📝 生成 CSV 报告...\n")
			records := generator.GenerateCSV()
			if err := reporter.SaveCSV(records, outputFile); err != nil {
				return fmt.Errorf("保存 CSV 失败: %w", err)
			}
		}

		fmt.Printf("\n💾 报告已导出到: %s\n", outputFile)

		return nil
	},
}

func init() {
	exportCmd.Flags().StringP("result", "r", "", "运行结果 JSON 文件路径")
	exportCmd.Flags().StringP("compare", "c", "", "对比结果 JSON 文件路径")
	exportCmd.Flags().StringP("format", "f", "md", "导出格式: md (默认), json, csv")
	exportCmd.Flags().StringP("output", "o", "", "输出目录 (默认: ./results)")
	exportCmd.Flags().StringP("name", "n", "", "导出文件名 (默认: report-时间戳)")
}
