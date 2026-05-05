package main

import (
	"context"
	"fmt"
	"os"

	"concurrency-inspector/cmd/commands"
	"concurrency-inspector/internal/storage"

	"github.com/spf13/cobra"
)

func main() {
	ctx := context.Background()
	if err := run(ctx); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func run(ctx context.Context) error {
	store, err := storage.NewSQLiteStorage("inspector.db")
	if err != nil {
		return fmt.Errorf("failed to initialize storage: %w", err)
	}
	defer store.Close()

	rootCmd := &cobra.Command{
		Use:   "concurrency-inspector",
		Short: "Go 并发模型设计体检 CLI",
		Long: `一个用于分析和评审 Go 并发模型设计的命令行工具。
支持分析 worker pool、fan-in/fan-out、pipeline、限流和取消传播等模式，
检测 goroutine 泄漏、无限堆积、乱序结果和吞吐瓶颈。`,
	}

	rootCmd.AddCommand(commands.InitCommand(store))
	rootCmd.AddCommand(commands.AnalyzeCommand(store))
	rootCmd.AddCommand(commands.CompareCommand(store))
	rootCmd.AddCommand(commands.ExportCommand(store))
	rootCmd.AddCommand(commands.SeedCommand(store))

	return rootCmd.ExecuteContext(ctx)
}
