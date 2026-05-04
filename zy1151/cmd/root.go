package cmd

import (
	"fmt"
	"memreplay/internal/storage"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "memreplay",
	Short: "内存问题复盘工具 - 帮助分析Go服务内存增长问题",
	Long: `memreplay 是一个专门用于分析Go服务内存增长问题的命令行工具。
它可以导入 pprof、runtime.MemStats、goroutine 堆栈等多种数据源，
进行综合分析，帮助定位 goroutine 泄漏、缓存未淘汰、定时器未释放等内存问题。

使用示例：
  memreplay init --name my-service-debug
  memreplay ingest --batch v1.0.0 --profile heap.pprof --memstats memstats.csv
  memreplay analyze --batch v1.0.0
  memreplay compare --base v1.0.0 --target v1.1.0
  memreplay simulate --cache-ttl 3600 --max-cache-size 10000
  memreplay export --batch v1.0.0 --format markdown`,
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		dbPath, _ := cmd.Flags().GetString("db")
		if err := storage.InitDB(storage.DBConfig{DBPath: dbPath}); err != nil {
			errorExit("初始化数据库失败", err)
		}
	},
	Run: func(cmd *cobra.Command, args []string) {
		_ = cmd.Help()
	},
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.CompletionOptions.DisableDefaultCmd = true
	rootCmd.SilenceUsage = true
	rootCmd.SilenceErrors = false
	rootCmd.PersistentFlags().StringP("db", "", "", "数据库路径 (默认: ~/.memreplay/memreplay.db)")
}

func errorExit(msg string, err error) {
	if err != nil {
		fmt.Fprintf(os.Stderr, "错误: %s: %v\n", msg, err)
	} else {
		fmt.Fprintf(os.Stderr, "错误: %s\n", msg)
	}
	os.Exit(1)
}
