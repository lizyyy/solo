package main

import (
	"log"
	"os"

	"msctl/internal/commands"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "msctl",
	Short: "微服务治理命令行工具",
	Long: `msctl 是一个用于微服务治理的命令行工具，支持：
- 初始化 workspace
- 导入服务元数据、OpenAPI 文档、调用关系、发布计划等
- 校验输入 schema 的正确性
- 分析服务契约、调用关系、依赖环、Owner 等
- 验证发布计划的可行性
- 导出分析报告`,
	SilenceUsage:  true,
	SilenceErrors: true,
}

func init() {
	rootCmd.AddCommand(commands.NewInitCmd())
	rootCmd.AddCommand(commands.NewImportCmd())
	rootCmd.AddCommand(commands.NewValidateCmd())
	rootCmd.AddCommand(commands.NewAnalyzeCmd())
	rootCmd.AddCommand(commands.NewPlanCmd())
	rootCmd.AddCommand(commands.NewExportCmd())
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		log.Fatalf("错误: %v", err)
		os.Exit(1)
	}
}
