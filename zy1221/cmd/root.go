package cmd

import (
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "slice-teacher",
	Short: "Go slice 底层数组共享问题教学工具",
	Long: `slice-teacher 是一个帮助团队理解 Go slice 底层数组共享问题的 CLI 工具。
它可以复盘 make、切片表达式、full slice expression、append、copy、
delete/filter、函数传参修改等操作，输出每一步的 len/cap、底层数组编号、
是否发生扩容、哪些切片还互相别名、哪里会因为 reslice 持有大数组。`,
}

func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		os.Exit(1)
	}
}

func init() {
	rootCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
