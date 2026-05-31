package main

import (
	"fmt"
	"os"
	"path/filepath"

	"freefall-grading/internal/db"
	"github.com/spf13/cobra"
)

var (
	dbPath   string
	operator string
	database *db.Database
)

var rootCmd = &cobra.Command{
	Use:   "grader",
	Short: "自由落体实验批改系统 - Go CLI + SQLite",
	Long: `自由落体实验批改系统
用于处理传感器日志、自动复核实验数据、批量修正异常记录、追踪操作历史、导出批改表。`,
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		var err error
		database, err = db.NewDB(dbPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "数据库连接失败: %v\n", err)
			os.Exit(1)
		}
	},
	PersistentPostRun: func(cmd *cobra.Command, args []string) {
		if database != nil {
			database.Close()
		}
	},
}

func main() {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = "."
	}
	defaultDB := filepath.Join(homeDir, ".freefall-grading", "data.db")

	rootCmd.PersistentFlags().StringVar(&dbPath, "db", defaultDB, "数据库文件路径")
	rootCmd.PersistentFlags().StringVar(&operator, "by", "assistant", "操作人标识")

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
