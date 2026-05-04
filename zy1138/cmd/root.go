package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "queue-analyzer",
	Short: "队列分析工具 - 分析和模拟 worker queue 系统",
	Long: `队列分析工具用于分析和模拟 worker queue 系统的性能。

功能包括：
- analyze: 分析历史队列数据，找出性能瓶颈
- simulate: 模拟不同配置下的队列行为
- compare: 比较多个模拟方案的性能
- export: 导出分析/模拟报告`,
	Version: "1.0.0",
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
