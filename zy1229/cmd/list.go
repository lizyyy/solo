package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var listCmd = &cobra.Command{
	Use:   "list",
	Short: "列出已保存的分析记录",
	Long:  `列出所有已保存的性能分析记录，显示分析 ID、名称、创建时间等信息。`,
	Run:   runList,
}

func init() {
	rootCmd.AddCommand(listCmd)

	// 定义 list 选项
	listCmd.Flags().IntP("limit", "l", 0, "限制显示的记录数量（0 表示不限制）")
	listCmd.Flags().BoolP("all", "a", false, "显示所有字段")
}

func runList(cmd *cobra.Command, args []string) {
	// TODO: 实现从存储中读取分析记录
	fmt.Println("list 命令待实现")
	fmt.Println("该命令将列出所有已保存的性能分析记录")
}
