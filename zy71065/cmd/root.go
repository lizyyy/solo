package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "proto-enum-lint",
	Short: "Proto 枚举兼容性检查工具",
	Long: `用于检查 proto 文件中枚举的兼容性问题，包括:
- 枚举编号复用
- reserved 声明漏写
- 别名枚举误判
- 与历史快照的破坏性变更对比`,
}

func Execute() error {
	return rootCmd.Execute()
}

func exitWithError(msg string, code int) {
	fmt.Fprintln(os.Stderr, msg)
	os.Exit(code)
}
