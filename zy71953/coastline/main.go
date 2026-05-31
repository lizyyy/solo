package main

import (
	"fmt"
	"os"

	"coastline/cmd"

	"github.com/spf13/cobra"
)

func main() {
	root := &cobra.Command{
		Use:   "coastline",
		Short: "海岸线测绘 — 测绘记录管理与飞行复盘工具",
		Long: `海岸线测绘 — 本地测绘记录管理 CLI

导入、复核、修正测绘记录，完整追踪变更历史，
导出飞行复盘供下一班接手，补传旧版自动提醒变更。

状态流转: imported → reviewed → fixed → closed
         └→ pending (待处理，需填原因)`,
	}

	cmd.AddCommands(root)

	if err := root.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
