package cmd

import (
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "gra",
	Short: "Go Runtime Analyzer - 栈增长和抢占复盘工具",
	Long: `Go Runtime Analyzer (gra) 是一个用于分析 Go 运行时栈增长和抢占行为的 CLI 工具。
它可以帮助你诊断延迟尖刺的根本原因，包括栈扩容、nosplit 调用、长循环缺少抢占点、
syscall/cgo 调度阻塞等问题。`,
	Run: func(cmd *cobra.Command, args []string) {
		if len(args) == 0 {
			cmd.Help()
		}
	},
}

// Execute 执行根命令
func Execute() error {
	return rootCmd.Execute()
}
