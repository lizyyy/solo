package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "mapdebug",
	Short: "Go map 底层行为复盘工具",
	Long: `mapdebug 是一个用于复盘 Go map 底层行为的 CLI 工具。
支持 init/replay/analyze/export 命令，用于排查 map 性能问题和偶发 key 问题。

功能包括：
- 模拟 hmap、bucket、tophash、overflow bucket 结构
- 追踪装载因子、增量扩容、oldbucket 迁移
- 检测删除标记、随机遍历顺序、并发写风险
- SQLite 持久化存储
- 生成 Markdown/JSON 报告`,
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.PersistentFlags().String("db", "mapdebug.db", "SQLite 数据库文件路径")
	rootCmd.PersistentFlags().StringP("workdir", "w", ".", "工作目录")
	rootCmd.PersistentFlags().Int64P("seed", "s", 0, "随机种子 (0 表示使用随机值)")
}

func checkWorkDir(workdir string) error {
	if _, err := os.Stat(workdir); os.IsNotExist(err) {
		return fmt.Errorf("工作目录不存在: %s", workdir)
	}
	return nil
}
