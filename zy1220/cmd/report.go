package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"escape-analyzer/internal/storage"
)

var (
	reportOutput string
	reportFormat string
)

var reportCmd = &cobra.Command{
	Use:   "report [analysis-id]",
	Short: "生成分析报告",
	Long: `将指定的分析结果导出为 Markdown 或 JSON 报告。

示例：
  escape-analyzer report <analysis-id> -o report.md -f markdown
  escape-analyzer report <analysis-id> -o report.json -f json`,
	Args: cobra.ExactArgs(1),
	RunE: runReport,
}

func init() {
	reportCmd.Flags().StringVarP(&reportOutput, "output", "o", "report.md", "输出文件路径")
	reportCmd.Flags().StringVarP(&reportFormat, "format", "f", "markdown", "输出格式: json, markdown")

	rootCmd.AddCommand(reportCmd)
}

func runReport(cmd *cobra.Command, args []string) error {
	analysisID := args[0]

	store, err := storage.NewStore()
	if err != nil {
		return fmt.Errorf("无法初始化存储: %w", err)
	}

	result, err := store.Load(analysisID)
	if err != nil {
		return err
	}

	return outputResult(result, reportOutput, reportFormat)
}
