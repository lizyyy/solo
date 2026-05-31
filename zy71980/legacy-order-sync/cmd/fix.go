package cmd

import (
	"fmt"

	"legacy-order-sync/db"

	"github.com/spf13/cobra"
)

var fixID int64
var fixOperator string
var fixReason string
var fixClientParams string
var fixClientParamsCorrupted bool
var fixClientParamsUncorrupt bool
var fixIdempotencyKey string
var fixIdempotencyKeyRestore bool
var fixStatus string

var fixCmd = &cobra.Command{
	Use:   "fix",
	Short: "修正记录",
	Long: `修正已复核或待处理的订单记录，所有修正都会记录操作历史。

使用方式：
  los fix --id 3 --operator 张三 --reason "恢复被破坏的客户端参数" --client-params '{"k":"v"}' --uncorrupt-params
  los fix --id 5 --operator 李四 --reason "重新生成幂等键" --idempotency-key "new-ik-xxx" --restore-idempotency
  los fix --id 7 --operator 王五 --reason "确认可跳过" --status skipped`,
	RunE: runFix,
}

func init() {
	rootCmd.AddCommand(fixCmd)
	fixCmd.Flags().Int64Var(&fixID, "id", 0, "要修正的记录 ID (必填)")
	fixCmd.Flags().StringVar(&fixOperator, "operator", "", "修正人 (必填)")
	fixCmd.Flags().StringVar(&fixReason, "reason", "", "修正原因 (必填)")
	fixCmd.Flags().StringVar(&fixClientParams, "client-params", "", "新的客户端参数 (JSON)")
	fixCmd.Flags().BoolVar(&fixClientParamsCorrupted, "corrupt-params", false, "标记客户端参数为已破坏")
	fixCmd.Flags().BoolVar(&fixClientParamsUncorrupt, "uncorrupt-params", false, "标记客户端参数为已恢复")
	fixCmd.Flags().StringVar(&fixIdempotencyKey, "idempotency-key", "", "新的幂等键")
	fixCmd.Flags().BoolVar(&fixIdempotencyKeyRestore, "restore-idempotency", false, "恢复幂等键为有效")
	fixCmd.Flags().StringVar(&fixStatus, "status", "", "直接设置状态 (imported/pending/reviewed/fixed/migrated/skipped)")
}

func runFix(cmd *cobra.Command, args []string) error {
	if fixID == 0 {
		return fmt.Errorf("必须指定 --id")
	}
	if fixOperator == "" {
		return fmt.Errorf("必须指定 --operator")
	}
	if fixReason == "" {
		return fmt.Errorf("必须指定 --reason")
	}

	database, err := db.EnsureDB()
	if err != nil {
		return fmt.Errorf("初始化数据库失败: %w", err)
	}
	defer database.Close()

	order, err := db.GetOrderByID(database, fixID)
	if err != nil {
		return fmt.Errorf("查询记录失败: %w", err)
	}
	if order == nil {
		return fmt.Errorf("ID %d 的记录不存在", fixID)
	}

	if order.Status == db.StatusMigrated {
		return fmt.Errorf("记录 ID %d 已迁移，不可修正", fixID)
	}

	newClientParams := order.ClientParams
	if fixClientParams != "" {
		newClientParams = fixClientParams
	}

	newClientParamsCorrupted := order.ClientParamsCorrupted
	if fixClientParamsCorrupted {
		newClientParamsCorrupted = true
	}
	if fixClientParamsUncorrupt {
		newClientParamsCorrupted = false
	}

	newIdempotencyKey := order.IdempotencyKey
	if fixIdempotencyKey != "" {
		newIdempotencyKey = fixIdempotencyKey
	}

	newIdempotencyKeyValid := order.IdempotencyKeyValid
	if fixIdempotencyKeyRestore {
		newIdempotencyKeyValid = true
	}

	newStatus := db.StatusFixed
	if fixStatus != "" {
		if !db.IsValidStatus(fixStatus) {
			return fmt.Errorf("无效状态 %q，可选: imported/pending/reviewed/fixed/migrated/skipped", fixStatus)
		}
		newStatus = fixStatus
	}

	if err := db.UpdateOrderFix(database, fixID, newStatus, newClientParams, newClientParamsCorrupted, newIdempotencyKey, newIdempotencyKeyValid); err != nil {
		return fmt.Errorf("修正记录失败: %w", err)
	}

	detail := fmt.Sprintf(
		`{"client_params_changed":%v,"params_corrupted":%v,"idempotency_key_changed":%v,"idempotency_key_valid":%v}`,
		fixClientParams != "", newClientParamsCorrupted, fixIdempotencyKey != "", newIdempotencyKeyValid,
	)

	history := &db.OrderHistory{
		OrderID:   fixID,
		Action:    "fix",
		OldStatus: order.Status,
		NewStatus: newStatus,
		Operator:  fixOperator,
		Reason:    fixReason,
		Detail:    detail,
	}
	if err := db.InsertHistory(database, history); err != nil {
		return fmt.Errorf("写入历史失败: %w", err)
	}

	fmt.Printf("修正完成: ID=%d, 订单号=%s\n", fixID, order.OrderNo)
	fmt.Printf("  修正人: %s\n", fixOperator)
	fmt.Printf("  修正原因: %s\n", fixReason)
	fmt.Printf("  状态变更: %s → %s\n", order.Status, newStatus)
	if fixClientParams != "" {
		fmt.Printf("  客户端参数: 已更新\n")
	}
	if fixClientParamsUncorrupt {
		fmt.Printf("  参数破坏标记: 已恢复\n")
	}
	if fixClientParamsCorrupted {
		fmt.Printf("  参数破坏标记: 已标记为破坏\n")
	}
	if fixIdempotencyKey != "" {
		fmt.Printf("  幂等键: 已更新为 %s\n", newIdempotencyKey)
	}
	if fixIdempotencyKeyRestore {
		fmt.Printf("  幂等键有效性: 已恢复\n")
	}
	return nil
}
