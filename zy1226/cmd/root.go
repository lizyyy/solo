package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "context-health",
	Short: "Go Context 调用链体检工具",
	Long: `Context Health 是一个用于检查 Go 程序中 context 调用链健康状况的 CLI 工具。
它可以分析 deadline 继承、取消传播、超时预算分配、WithValue 滥用、
Background/TODO 误用、goroutine 边界资源释放等问题。`,
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.PersistentFlags().StringP("config", "c", "context-plan.yaml", "配置文件路径")
	rootCmd.PersistentFlags().StringP("output", "o", "", "输出目录")
	rootCmd.PersistentFlags().BoolP("verbose", "v", false, "详细输出")
}

func errorExit(msg string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, msg+"\n", args...)
	os.Exit(1)
}
