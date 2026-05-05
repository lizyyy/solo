package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "go-perf-helper",
	Short: "Go 性能剖析助手",
	Long:  `一个用于分析 Go 程序性能剖析数据的命令行工具，支持 pprof、runtime/trace 和 benchstat 结果的分析与对比。`,
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	cobra.OnInitialize(initConfig)
	rootCmd.CompletionOptions.DisableDefaultCmd = true
}

func initConfig() {
	// 配置初始化
}

func errorf(format string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
}
