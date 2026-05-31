package cmd

import (
	"fmt"
	"strconv"

	"coastline/db"

	"github.com/spf13/cobra"
)

var historyCmd = &cobra.Command{
	Use:   "history <id>",
	Short: "查看记录完整变更历史",
	Args:  cobra.ExactArgs(1),
	RunE:  runHistory,
}

func runHistory(cmd *cobra.Command, args []string) error {
	id, err := strconv.ParseInt(args[0], 10, 64)
	if err != nil {
		return fmt.Errorf("无效ID: %s", args[0])
	}

	d, err := db.Open(dbPath)
	if err != nil {
		return err
	}
	defer d.Close()

	r, err := d.GetRecord(id)
	if err != nil {
		return fmt.Errorf("记录 #%d 不存在", id)
	}

	fmt.Printf("══ 记录 #%d ══\n", r.ID)
	fmt.Printf("  来源:     %s\n", r.Source)
	fmt.Printf("  位置:     %s\n", r.Location)
	fmt.Printf("  描述:     %s\n", r.Description)
	fmt.Printf("  当前状态: %s\n", r.Status)
	fmt.Printf("  操作人:   %s\n", r.Operator)
	fmt.Printf("  照片引用: %s\n", r.PhotoRef)
	fmt.Printf("  版本:     v%d\n", r.Version)
	fmt.Printf("  创建:     %s\n", r.CreatedAt.Format("2006-01-02 15:04:05"))
	fmt.Printf("  更新:     %s\n", r.UpdatedAt.Format("2006-01-02 15:04:05"))

	if r.PendingReason != "" {
		fmt.Printf("  待处理原因: %s\n", r.PendingReason)
	}

	alerts, _ := d.GetAlertLogs(id)
	if len(alerts) > 0 {
		fmt.Printf("\n⚠ 补传变更提醒 (%d 条):\n", len(alerts))
		for _, a := range alerts {
			fmt.Printf("  [%s] %s: «%s» → «%s»\n", a.CreatedAt.Format("2006-01-02 15:04"), a.Field, a.OldValue, a.NewValue)
			fmt.Printf("         操作人: %s  原因: %s\n", a.Operator, a.Reason)
		}
	}

	logs, err := d.GetChangeLogs(id)
	if err != nil {
		return fmt.Errorf("查询变更记录失败: %w", err)
	}

	if len(logs) == 0 {
		fmt.Println("\n（无变更历史）")
		return nil
	}

	fmt.Printf("\n── 变更历史 (%d 条) ──\n", len(logs))
	for _, cl := range logs {
		alertMark := ""
		if cl.Alert {
			alertMark = " ⚠"
		}
		fmt.Printf("  [%s]%s %s · %s\n", cl.CreatedAt.Format("2006-01-02 15:04"), alertMark, cl.ChangeType, cl.Operator)
		fmt.Printf("    %s: «%s» → «%s»\n", cl.Field, cl.OldValue, cl.NewValue)
		if cl.Reason != "" {
			fmt.Printf("    原因: %s\n", cl.Reason)
		}
	}
	return nil
}
