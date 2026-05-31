package cmd

import (
	"fmt"

	"coastline/db"

	"github.com/spf13/cobra"
)

var listCmd = &cobra.Command{
	Use:   "list",
	Short: "列出记录（可按状态筛选）",
	RunE:  runList,
}

var listStatus string

func init() {
	listCmd.Flags().StringVarP(&listStatus, "status", "s", "", "按状态筛选（imported/pending/reviewed/fixed/closed）")
}

func runList(cmd *cobra.Command, args []string) error {
	if listStatus != "" && !db.ValidStatuses[listStatus] {
		return fmt.Errorf("无效状态 %q，可选: imported/pending/reviewed/fixed/closed", listStatus)
	}

	d, err := db.Open(dbPath)
	if err != nil {
		return err
	}
	defer d.Close()

	records, err := d.ListRecords(listStatus)
	if err != nil {
		return fmt.Errorf("查询记录失败: %w", err)
	}
	if len(records) == 0 {
		if listStatus != "" {
			fmt.Printf("状态 %q 下无记录\n", listStatus)
		} else {
			fmt.Println("无记录")
		}
		return nil
	}

	fmt.Printf("%-5s %-12s %-20s %-15s %-10s %-10s %-8s %s\n",
		"ID", "来源", "位置", "状态", "版本", "操作人", "照片", "更新时间")
	fmt.Println("──────────────────────────────────────────────────────────────────────────────────────────")
	for _, r := range records {
		photo := "-"
		if r.PhotoRef != "" {
			photo = "有"
		}
		loc := r.Location
		if len([]rune(loc)) > 18 {
			loc = string([]rune(loc)[:16]) + "…"
		}
		src := r.Source
		if len([]rune(src)) > 10 {
			src = string([]rune(src)[:8]) + "…"
		}
		fmt.Printf("%-5d %-12s %-20s %-15s v%-9d %-10s %-8s %s\n",
			r.ID, src, loc, r.Status, r.Version, r.Operator, photo, r.UpdatedAt.Format("01-02 15:04"))
		if r.PendingReason != "" {
			fmt.Printf("      └─ 待处理: %s\n", r.PendingReason)
		}
	}
	fmt.Printf("\n共 %d 条\n", len(records))
	return nil
}
