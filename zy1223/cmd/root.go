package cmd

import (
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "go-iface-analyzer",
	Short: "Go interface 底层原理复盘 CLI 工具",
	Long: `一个用于分析 Go 语言 interface 底层原理的命令行工具。
支持分析 eface/iface、itab、动态类型和值、值/指针接收者方法集、
类型断言、type switch、typed nil 和接口装箱带来的分配风险。`,
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.CompletionOptions.DisableDefaultCmd = true
}
