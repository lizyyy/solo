package cmd

import (
	"fmt"
	"strconv"

	"coastline/db"

	"github.com/spf13/cobra"
)

var alertsCmd = &cobra.Command{
	Use:   "alerts",
	Short: "查看所有补传变更提醒",
	RunE:  runAlerts,
}

func runAlerts(cmd *cobra.Command, args []string) error {
	d, err := db.Open(dbPath)
	if err != nil {
		return err
	}
	defer d.Close()

	records, err := d.GetAllRecords()
	if err != nil {
		return fmt.Errorf("查询记录失败: %w", err)
	}

	found := 0
	for _, r := range records {
		alerts, _ := d.GetAlertLogs(r.ID)
		if len(alerts) == 0 {
			continue
		}
		found++
		fmt.Printf("── #%d [%s/%s] v%d ──\n", r.ID, r.Source, r.Location, r.Version)
		for _, a := range alerts {
			fmt.Printf("  [%s] %s: «%s» → «%s»\n", a.CreatedAt.Format("2006-01-02 15:04"), a.Field, a.OldValue, a.NewValue)
			fmt.Printf("  操作人: %s  原因: %s\n", a.Operator, a.Reason)
		}
		fmt.Println()
	}

	if found == 0 {
		fmt.Println("无补传变更提醒")
	} else {
		fmt.Printf("共 %d 条记录有补传提醒\n", found)
	}

	_ = strconv.Itoa(found)
	return nil
}
