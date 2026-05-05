package commands

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "go-policy-scanner",
	Short: "Go 工程化巡检工具",
	Long: `go-policy-scanner 是一个用于多服务 Go 仓库的工程化巡检 CLI 工具。

它可以检查:
- 循环依赖
- 跨层乱引用
- 接口变更未同步
- 迁移文件漏回滚
- 错误码不统一
- 日志字段不规范`,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		return nil
	},
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.PersistentFlags().StringP("db", "d", "./policy_scanner.db", "SQLite 数据库文件路径")
	rootCmd.PersistentFlags().StringP("policy", "p", "", "service-policy.yaml 文件路径")
	rootCmd.PersistentFlags().BoolP("verbose", "v", false, "显示详细输出")
}

func errorAndExit(msg string) {
	fmt.Fprintln(os.Stderr, msg)
	os.Exit(1)
}
