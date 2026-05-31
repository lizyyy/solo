package cmd

import (
	"coastline/db"

	"github.com/spf13/cobra"
)

var dbPath string

func AddCommands(root *cobra.Command) {
	root.PersistentFlags().StringVarP(&dbPath, "db", "", "coastline.db", "数据库文件路径")

	root.AddCommand(importCmd)
	root.AddCommand(reviewCmd)
	root.AddCommand(fixCmd)
	root.AddCommand(historyCmd)
	root.AddCommand(exportCmd)
	root.AddCommand(listCmd)
	root.AddCommand(showCmd)
	root.AddCommand(alertsCmd)

	_ = db.ValidStatuses
}
