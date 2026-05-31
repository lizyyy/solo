package cmd

import (
	"fmt"
	"strconv"

	"coastline/db"

	"github.com/spf13/cobra"
)

var showCmd = &cobra.Command{
	Use:   "show <id>",
	Short: "查看单条记录详情",
	Args:  cobra.ExactArgs(1),
	RunE:  runShow,
}

func runShow(cmd *cobra.Command, args []string) error {
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
	fmt.Printf("  来源:       %s\n", r.Source)
	fmt.Printf("  位置:       %s\n", r.Location)
	fmt.Printf("  描述:       %s\n", r.Description)
	fmt.Printf("  状态:       %s\n", r.Status)
	fmt.Printf("  版本:       v%d\n", r.Version)
	fmt.Printf("  操作人:     %s\n", r.Operator)
	fmt.Printf("  照片引用:   %s\n", r.PhotoRef)
	fmt.Printf("  待处理原因: %s\n", r.PendingReason)
	fmt.Printf("  内容哈希:   %s\n", r.ContentHash)
	fmt.Printf("  创建时间:   %s\n", r.CreatedAt.Format("2006-01-02 15:04:05"))
	fmt.Printf("  更新时间:   %s\n", r.UpdatedAt.Format("2006-01-02 15:04:05"))

	alerts, _ := d.GetAlertLogs(r.ID)
	if len(alerts) > 0 {
		fmt.Printf("\n⚠ 补传变更提醒 (%d 条):\n", len(alerts))
		for _, a := range alerts {
			fmt.Printf("  [%s] %s: «%s» → «%s»\n", a.CreatedAt.Format("2006-01-02 15:04"), a.Field, a.OldValue, a.NewValue)
		}
	}

	return nil
}
