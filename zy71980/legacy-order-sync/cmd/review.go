package cmd

import (
	"database/sql"
	"fmt"
	"os"
	"strconv"

	"legacy-order-sync/db"

	"github.com/spf13/cobra"
)

var reviewList bool
var reviewID int64
var reviewReason string
var reviewOperator string
var reviewAction string

var reviewCmd = &cobra.Command{
	Use:   "review",
	Short: "复核待处理记录",
	Long: `复核待处理记录，为争议记录给出可复核的原因。

使用方式：
  los review --list                   # 列出所有待处理记录
  los review --id 3 --reason "确认幂等键因服务端重置失效，非客户端问题" --operator 张三 --action approve
  los review --id 5 --reason "参数确实被客户端篡改，需修正后迁移" --operator 李四 --action reject`,
	RunE: runReview,
}

func init() {
	rootCmd.AddCommand(reviewCmd)
	reviewCmd.Flags().BoolVarP(&reviewList, "list", "l", false, "列出所有待处理记录")
	reviewCmd.Flags().Int64Var(&reviewID, "id", 0, "要复核的记录 ID")
	reviewCmd.Flags().StringVar(&reviewReason, "reason", "", "复核原因/意见")
	reviewCmd.Flags().StringVar(&reviewOperator, "operator", "", "复核人")
	reviewCmd.Flags().StringVar(&reviewAction, "action", "approve", "复核动作: approve(确认,标记为reviewed) 或 reject(驳回,仍保持pending)")
}

func runReview(cmd *cobra.Command, args []string) error {
	database, err := db.EnsureDB()
	if err != nil {
		return fmt.Errorf("初始化数据库失败: %w", err)
	}
	defer database.Close()

	if reviewList {
		return listPending(database)
	}

	if reviewID == 0 {
		_ = cmd.Help()
		return fmt.Errorf("\n请指定 --id 或 --list")
	}

	return reviewOrder(database)
}

func listPending(database *sql.DB) error {
	orders, err := db.ListOrdersByStatus(database, db.StatusPending, 200)
	if err != nil {
		return fmt.Errorf("查询待处理记录失败: %w", err)
	}

	if len(orders) == 0 {
		fmt.Println("没有待处理记录")
		return nil
	}

	fmt.Printf("待处理记录 (共 %d 条):\n", len(orders))
	fmt.Println("────────────────────────────────────────────────────────────────────────────────────")
	fmt.Printf("%-5s %-16s %-20s %-12s %-10s %s\n", "ID", "订单号", "幂等键", "来源", "参数破坏", "待处理原因")
	fmt.Println("────────────────────────────────────────────────────────────────────────────────────")

	for _, o := range orders {
		paramsCorrupted := "否"
		if o.ClientParamsCorrupted {
			paramsCorrupted = "是"
		}
		idempotencyKey := o.IdempotencyKey
		if idempotencyKey == "" {
			idempotencyKey = "(空)"
		} else if !o.IdempotencyKeyValid {
			idempotencyKey = idempotencyKey + " [失效]"
		}
		orderNo := o.OrderNo
		if len(orderNo) > 16 {
			orderNo = orderNo[:14] + ".."
		}
		reason := o.PendingReason
		if len(reason) > 24 {
			reason = reason[:22] + ".."
		}

		fmt.Printf("%-5d %-16s %-20s %-12s %-10s %s\n", o.ID, orderNo, idempotencyKey, o.Source, paramsCorrupted, reason)
	}
	fmt.Println("────────────────────────────────────────────────────────────────────────────────────")

	counts, _ := db.CountOrdersByStatus(database)
	fmt.Printf("状态统计: ")
	for _, s := range []string{db.StatusImported, db.StatusPending, db.StatusReviewed, db.StatusFixed, db.StatusMigrated, db.StatusSkipped} {
		if c, ok := counts[s]; ok {
			fmt.Printf("%s=%d  ", s, c)
		}
	}
	fmt.Println()
	return nil
}

func reviewOrder(database *sql.DB) error {
	if reviewOperator == "" {
		return fmt.Errorf("必须指定 --operator (复核人)")
	}

	order, err := db.GetOrderByID(database, reviewID)
	if err != nil {
		return fmt.Errorf("查询记录失败: %w", err)
	}
	if order == nil {
		return fmt.Errorf("ID %d 的记录不存在", reviewID)
	}

	if order.Status != db.StatusPending {
		return fmt.Errorf("记录 ID %d 当前状态为 %s，只有 pending 状态才能复核", reviewID, order.Status)
	}

	newStatus := db.StatusReviewed
	if reviewAction == "reject" {
		newStatus = db.StatusPending
		if reviewReason == "" {
			reviewReason = "复核驳回"
		}
	} else {
		if reviewReason == "" {
			return fmt.Errorf("approve 操作必须填写 --reason")
		}
	}

	if err := db.UpdateOrderReview(database, reviewID, newStatus, reviewReason, reviewOperator); err != nil {
		return fmt.Errorf("更新记录失败: %w", err)
	}

	history := &db.OrderHistory{
		OrderID:   reviewID,
		Action:    "review",
		OldStatus: order.Status,
		NewStatus: newStatus,
		Operator:  reviewOperator,
		Reason:    reviewReason,
		Detail:    fmt.Sprintf(`{"action":"%s","pending_reason":"%s"}`, reviewAction, order.PendingReason),
	}
	if err := db.InsertHistory(database, history); err != nil {
		return fmt.Errorf("写入历史失败: %w", err)
	}

	actionLabel := "确认通过"
	if reviewAction == "reject" {
		actionLabel = "驳回"
	}

	fmt.Printf("复核完成: ID=%d, 订单号=%s, 动作=%s, 新状态=%s\n", reviewID, order.OrderNo, actionLabel, newStatus)
	fmt.Printf("  复核人: %s\n", reviewOperator)
	fmt.Printf("  复核原因: %s\n", reviewReason)
	fmt.Printf("  原待处理原因: %s\n", order.PendingReason)
	return nil
}

func parseIntID(s string) (int64, error) {
	return strconv.ParseInt(s, 10, 64)
}

func checkStdin() bool {
	stat, _ := os.Stdin.Stat()
	return (stat.Mode() & os.ModeCharDevice) == 0
}
