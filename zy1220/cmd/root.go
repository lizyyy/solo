package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "escape-analyzer",
	Short: "Go 内存逃逸分析工具",
	Long: `Go 内存逃逸体检 CLI，用于分析 Go 程序的内存逃逸情况。
支持解析 go build -gcflags=-m 的逃逸日志，识别逃逸原因，
对比优化前后的变化，生成详细的分析报告。`,
	Run: func(cmd *cobra.Command, args []string) {
		if len(args) == 0 {
			cmd.Help()
			os.Exit(0)
		}
	},
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
