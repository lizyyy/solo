package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"go-runtime-analyzer/analyzer"
	"go-runtime-analyzer/storage"
)

var exportCmd = &cobra.Command{
	Use:   "export",
	Short: "导出分析报告",
	Long: `export 命令将分析结果导出为 Markdown 或 JSON 格式的报告。

支持的格式：
  - markdown (默认): 人类可读的格式化报告
  - json: 机器可读的结构化数据

使用示例：
  gra export -o report.md
  gra export -o report.json -f json
  gra export -d mydata.db -o analysis.md`,
	Run: func(cmd *cobra.Command, args []string) {
		runExport()
	},
}

var (
	exportDBPath string
	exportOutput string
	exportFormat string
)

func init() {
	rootCmd.AddCommand(exportCmd)

	exportCmd.Flags().StringVarP(&exportDBPath, "db", "d", "gra.db", "数据库文件路径")
	exportCmd.Flags().StringVarP(&exportOutput, "output", "o", "", "输出文件路径 (必填)")
	exportCmd.Flags().StringVarP(&exportFormat, "format", "f", "markdown", "输出格式: markdown 或 json")
	exportCmd.MarkFlagRequired("output")
}

func runExport() {
	// 验证格式
	if exportFormat != "markdown" && exportFormat != "json" && exportFormat != "md" {
		fmt.Printf("错误: 无效的格式 '%s'。支持的格式: markdown, json\n", exportFormat)
		os.Exit(1)
	}

	// 打开数据库
	db, err := storage.InitDB(exportDBPath)
	if err != nil {
		fmt.Printf("错误: 打开数据库失败: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	// 执行分析
	config := analyzer.DefaultAnalysisConfig()
	an := analyzer.NewAnalyzer(db, config)

	fmt.Println("正在生成报告...")
	result, err := an.Analyze()
	if err != nil {
		fmt.Printf("错误: 分析失败: %v\n", err)
		os.Exit(1)
	}

	// 生成输出内容
	var content string
	switch exportFormat {
	case "json":
		jsonData, err := json.MarshalIndent(result, "", "  ")
		if err != nil {
			fmt.Printf("错误: 序列化 JSON 失败: %v\n", err)
			os.Exit(1)
		}
		content = string(jsonData)

	case "markdown", "md":
		content = result.ToMarkdown()
	}

	// 写入文件
	if err := os.WriteFile(exportOutput, []byte(content), 0644); err != nil {
		fmt.Printf("错误: 写入文件失败: %v\n", err)
		os.Exit(1)
	}

	// 获取文件大小
	info, err := os.Stat(exportOutput)
	if err != nil {
		fmt.Printf("✓ 报告已导出到: %s\n", exportOutput)
	} else {
		fmt.Printf("✓ 报告已导出到: %s (%.2f KB)\n", exportOutput, float64(info.Size())/1024)
	}

	fmt.Printf("  格式: %s\n", exportFormat)
}
