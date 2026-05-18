package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "sync-failure-replay",
	Short: "同步失败日志批次重放计划 CLI",
	Long:  `生成可重放的同步失败日志批次计划，支持幂等运行、错误分类和详细报告。`,
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
