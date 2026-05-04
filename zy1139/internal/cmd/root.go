package cmd

import (
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "capgate",
	Short: "容量闸门工具 - 上线前接口压测容量评估",
	Long: `capgate 是一个本地 Go 工具，用于上线前接口压测的"容量闸门"和降级预演。

支持的核心命令：
  init      - 初始化项目，生成样例配置文件
  validate  - 验证配置文件格式和内容
  run       - 执行压测计划并生成预算闸门结论
  compare   - 对比 baseline 和本次压测结果
  export    - 导出多种格式的报告
  serve     - 启动轻量本地 API 服务

使用示例：
  # 初始化项目
  capgate init

  # 验证配置
  capgate validate

  # 执行压测
  capgate run

  # 对比基线
  capgate compare -r ./results/run-20240101-120000-result.json

  # 导出报告
  capgate export -r ./results/run-20240101-120000-result.json -f md`,
	Version: "1.0.0",
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	rootCmd.AddCommand(initCmd)
	rootCmd.AddCommand(validateCmd)
	rootCmd.AddCommand(runCmd)
	rootCmd.AddCommand(compareCmd)
	rootCmd.AddCommand(exportCmd)
	rootCmd.AddCommand(serveCmd)
}
