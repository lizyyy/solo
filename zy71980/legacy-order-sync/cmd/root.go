package cmd

import (
	"fmt"
	"os"

	"legacy-order-sync/db"

	"github.com/spf13/cobra"
)

var dbFile string

var rootCmd = &cobra.Command{
	Use:   "los",
	Short: "旧版订单同步 - Legacy Order Sync CLI",
	Long: `旧版订单同步 (Legacy Order Sync)
Go CLI + SQLite，本地可跑的订单导入、复核、修正、历史和导出工具。
每条记录可追溯来源、当前状态、谁改过、为什么进了待处理。`,
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		db.SetDBPath(dbFile)
	},
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().StringVar(&dbFile, "db", "legacy_order_sync.db", "SQLite 数据库文件路径")
}
