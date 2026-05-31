package cmd

import (
	"fmt"

	"legacy-order-sync/db"

	"github.com/spf13/cobra"
)

var historyID int64
var historyOrderNo string

var historyCmd = &cobra.Command{
	Use:   "history",
	Short: "查看记录变更历史",
	Long: `查看订单记录的完整变更历史，包括谁改过、改了什么、为什么改。

使用方式：
  los history --id 3
  los history --order-no ORD-20240101-001`,
	RunE: runHistory,
}

func init() {
	rootCmd.AddCommand(historyCmd)
	historyCmd.Flags().Int64Var(&historyID, "id", 0, "按 ID 查询")
	historyCmd.Flags().StringVar(&historyOrderNo, "order-no", "", "按订单号查询")
}

func runHistory(cmd *cobra.Command, args []string) error {
	database, err := db.EnsureDB()
	if err != nil {
		return fmt.Errorf("初始化数据库失败: %w", err)
	}
	defer database.Close()

	if historyID == 0 && historyOrderNo == "" {
		return fmt.Errorf("请指定 --id 或 --order-no")
	}

	var order *db.Order
	if historyID != 0 {
		order, err = db.GetOrderByID(database, historyID)
	} else {
		order, err = db.GetOrderByOrderNo(database, historyOrderNo)
	}
	if err != nil {
		return fmt.Errorf("查询记录失败: %w", err)
	}
	if order == nil {
		return fmt.Errorf("记录不存在")
	}

	fmt.Println("══════════════════════════════════════════════════════════════")
	fmt.Printf("订单号: %s  (ID: %d)\n", order.OrderNo, order.ID)
	fmt.Printf("来源: %s\n", order.Source)
	fmt.Printf("当前状态: %s\n", order.Status)
	fmt.Printf("幂等键: %s", order.IdempotencyKey)
	if !order.IdempotencyKeyValid {
		fmt.Print(" [失效]")
	}
	fmt.Println()
	fmt.Printf("客户端参数破坏: %v\n", order.ClientParamsCorrupted)
	if order.PendingReason != "" {
		fmt.Printf("待处理原因: %s\n", order.PendingReason)
	}
	if order.ReviewReason != "" {
		fmt.Printf("复核原因: %s\n", order.ReviewReason)
	}
	if order.ReviewedBy != "" {
		fmt.Printf("复核人: %s\n", order.ReviewedBy)
	}
	if order.ReviewedAt != nil {
		fmt.Printf("复核时间: %s\n", order.ReviewedAt.Format("2006-01-02 15:04:05"))
	}
	fmt.Printf("创建时间: %s\n", order.CreatedAt.Format("2006-01-02 15:04:05"))
	fmt.Printf("更新时间: %s\n", order.UpdatedAt.Format("2006-01-02 15:04:05"))
	fmt.Println("══════════════════════════════════════════════════════════════")

	histories, err := db.GetHistoriesByOrderID(database, order.ID)
	if err != nil {
		return fmt.Errorf("查询历史失败: %w", err)
	}

	if len(histories) == 0 {
		fmt.Println("(无变更历史)")
		return nil
	}

	fmt.Println("变更历史:")
	fmt.Println("────────────────────────────────────────────────────────────────")
	for i, h := range histories {
		fmt.Printf("  #%d [%s] %s\n", i+1, h.CreatedAt.Format("2006-01-02 15:04:05"), actionLabel(h.Action))
		if h.OldStatus != "" || h.NewStatus != "" {
			fmt.Printf("       状态: %s → %s\n", h.OldStatus, h.NewStatus)
		}
		fmt.Printf("       操作人: %s\n", h.Operator)
		if h.Reason != "" {
			fmt.Printf("       原因: %s\n", h.Reason)
		}
		if h.Detail != "{}" && h.Detail != "" {
			fmt.Printf("       详情: %s\n", h.Detail)
		}
		if i < len(histories)-1 {
			fmt.Println("       ────")
		}
	}
	fmt.Println("────────────────────────────────────────────────────────────────")
	return nil
}

func actionLabel(action string) string {
	labels := map[string]string{
		"import":        "导入",
		"review":        "复核",
		"fix":           "修正",
		"status_change": "状态变更",
		"export":        "导出",
	}
	if label, ok := labels[action]; ok {
		return label
	}
	return action
}
