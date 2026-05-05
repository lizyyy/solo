package main

import (
	"os"

	"github.com/spf13/cobra"

	"github.com/yourteam/sync-analyzer/cmd/sync-analyzer/commands"
)

var rootCmd = &cobra.Command{
	Use:   "sync-analyzer",
	Short: "A tool for analyzing Go sync package usage patterns",
	Long: `sync-analyzer is a command-line tool that helps teams analyze and review
the usage of Go's sync package primitives including Mutex, RWMutex, WaitGroup,
Once, Cond, and Pool. It can detect common issues such as lock order inversion,
read-write lock starvation, WaitGroup count errors, and more.`,
}

func init() {
	// 注册子命令
	rootCmd.AddCommand(commands.InitCmd())
	rootCmd.AddCommand(commands.AnalyzeCmd())
	rootCmd.AddCommand(commands.CompareCmd())
	rootCmd.AddCommand(commands.ExportCmd())
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}
