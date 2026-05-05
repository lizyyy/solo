package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var compareCmd = &cobra.Command{
	Use:   "compare [old-analysis-id] [new-analysis-id]",
	Short: "对比两次分析结果",
	Long:  `对比两个不同版本的性能分析结果，显示改进项、回归项和总体差异。`,
	Args:  cobra.ExactArgs(2),
	Run:   runCompare,
}

func init() {
	rootCmd.AddCommand(compareCmd)

	// 定义 compare 选项
	compareCmd.Flags().StringP("old-file", "o", "", "旧分析结果文件路径")
	compareCmd.Flags().StringP("new-file", "n", "", "新分析结果文件路径")
	compareCmd.Flags().StringP("output", "O", "", "输出文件路径（支持 .json 和 .md）")
	compareCmd.Flags().BoolP("details", "d", false, "显示详细的对比信息")
}

func runCompare(cmd *cobra.Command, args []string) {
	// TODO: 实现对比功能
	fmt.Println("compare 命令待实现")
	fmt.Println("该命令将对比两次分析结果，显示改进项、回归项和总体差异")
	
	// 检查参数
	if len(args) != 2 {
		errorf("错误：需要提供两个分析 ID")
		errorf("使用方法：go-perf-helper compare <old-id> <new-id>")
		os.Exit(1)
	}
	
	oldID := args[0]
	newID := args[1]
	
	fmt.Printf("将对比分析 %s 和 %s\n", oldID, newID)
}
