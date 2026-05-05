package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"escape-analyzer/internal/storage"
)

var (
	historyLimit  int
	historyDetail bool
)

var historyCmd = &cobra.Command{
	Use:   "history",
	Short: "查看历史分析记录",
	Long: `查看已保存的历史分析记录。

示例：
  escape-analyzer history
  escape-analyzer history --limit 10
  escape-analyzer history --detail <id>`,
	RunE: runHistory,
}

func init() {
	historyCmd.Flags().IntVarP(&historyLimit, "limit", "l", 20, "显示最近的 N 条记录")
	historyCmd.Flags().BoolVarP(&historyDetail, "detail", "d", false, "显示指定记录的详细信息（需提供记录ID）")

	rootCmd.AddCommand(historyCmd)
}

func runHistory(cmd *cobra.Command, args []string) error {
	store, err := storage.NewStore()
	if err != nil {
		return fmt.Errorf("无法初始化存储: %w", err)
	}

	if historyDetail {
		if len(args) == 0 {
			return fmt.Errorf("需要提供记录ID来查看详细信息")
		}
		return showHistoryDetail(store, args[0])
	}

	entries, err := store.List()
	if err != nil {
		return fmt.Errorf("获取历史记录失败: %w", err)
	}

	if len(entries) == 0 {
		fmt.Println("暂无历史分析记录")
		return nil
	}

	if historyLimit > 0 && historyLimit < len(entries) {
		entries = entries[:historyLimit]
	}

	fmt.Println("=")
	fmt.Println("           历史分析记录")
	fmt.Println("=")
	fmt.Println()

	for i, entry := range entries {
		fmt.Printf("[%d] ID: %s\n", i+1, entry.ID)
		fmt.Printf("    时间: %s\n", entry.Timestamp.Format("2006-01-02 15:04:05"))
		if entry.Description != "" {
			fmt.Printf("    描述: %s\n", entry.Description)
		}
		fmt.Printf("    逃逸次数: %d\n", entry.EscapeCount)
		fmt.Println()
	}

	fmt.Printf("共 %d 条记录\n", len(entries))

	return nil
}

func showHistoryDetail(store *storage.Store, id string) error {
	result, err := store.Load(id)
	if err != nil {
		return err
	}

	return outputResult(result, "", "console")
}
