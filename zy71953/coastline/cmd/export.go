package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"coastline/db"

	"github.com/spf13/cobra"
)

var exportCmd = &cobra.Command{
	Use:   "export",
	Short: "导出飞行复盘（下一班可直接接手查询）",
	RunE:  runExport,
}

var exportOutput string
var exportFormat string
var exportStatus string

func init() {
	exportCmd.Flags().StringVarP(&exportOutput, "output", "o", "", "输出文件路径（默认输出到终端）")
	exportCmd.Flags().StringVarP(&exportFormat, "format", "f", "text", "导出格式：text / json")
	exportCmd.Flags().StringVarP(&exportStatus, "status", "s", "", "只导出指定状态的记录")
}

func runExport(cmd *cobra.Command, args []string) error {
	d, err := db.Open(dbPath)
	if err != nil {
		return err
	}
	defer d.Close()

	records, err := d.ListRecords(exportStatus)
	if err != nil {
		return fmt.Errorf("查询记录失败: %w", err)
	}
	if len(records) == 0 {
		fmt.Println("无记录可导出")
		return nil
	}

	if exportFormat == "json" {
		return exportJSON(records, d)
	}

	return exportText(records, d)
}

func exportText(records []db.Record, d *db.DB) error {
	var b strings.Builder
	now := time.Now().Format("2006-01-02 15:04:05")
	b.WriteString(fmt.Sprintf("═══════════════════════════════════════════════\n"))
	b.WriteString(fmt.Sprintf("  海岸线测绘 · 飞行复盘  导出时间: %s\n", now))
	b.WriteString(fmt.Sprintf("  记录总数: %d\n", len(records)))
	b.WriteString(fmt.Sprintf("═══════════════════════════════════════════════\n\n"))

	statusCounts := make(map[string]int)
	for _, r := range records {
		statusCounts[r.Status]++
	}
	b.WriteString("状态汇总:\n")
	for _, s := range []string{"imported", "pending", "reviewed", "fixed", "closed"} {
		if c, ok := statusCounts[s]; ok {
			b.WriteString(fmt.Sprintf("  %-10s %d\n", s, c))
		}
	}
	b.WriteString("\n")

	for _, r := range records {
		b.WriteString(fmt.Sprintf("── #%d ────────────────────────\n", r.ID))
		b.WriteString(fmt.Sprintf("  来源:   %s\n", r.Source))
		b.WriteString(fmt.Sprintf("  位置:   %s\n", r.Location))
		b.WriteString(fmt.Sprintf("  描述:   %s\n", r.Description))
		b.WriteString(fmt.Sprintf("  状态:   %s (v%d)\n", r.Status, r.Version))
		b.WriteString(fmt.Sprintf("  操作人: %s\n", r.Operator))
		if r.PhotoRef != "" {
			b.WriteString(fmt.Sprintf("  照片:   %s\n", r.PhotoRef))
		}
		if r.PendingReason != "" {
			b.WriteString(fmt.Sprintf("  待处理原因: %s\n", r.PendingReason))
		}
		b.WriteString(fmt.Sprintf("  创建: %s  更新: %s\n",
			r.CreatedAt.Format("2006-01-02 15:04"), r.UpdatedAt.Format("2006-01-02 15:04")))

		alerts, _ := d.GetAlertLogs(r.ID)
		if len(alerts) > 0 {
			b.WriteString("  ⚠ 补传提醒:\n")
			for _, a := range alerts {
				b.WriteString(fmt.Sprintf("    %s: «%s» → «%s» (%s)\n", a.Field, a.OldValue, a.NewValue, a.CreatedAt.Format("01-02 15:04")))
			}
		}

		b.WriteString("\n")
	}

	if exportOutput != "" {
		return os.WriteFile(exportOutput, []byte(b.String()), 0644)
	}
	fmt.Print(b.String())
	return nil
}

func exportJSON(records []db.Record, d *db.DB) error {
	type exportChange struct {
		Time     string `json:"time"`
		Type     string `json:"type"`
		Field    string `json:"field"`
		OldValue string `json:"old_value"`
		NewValue string `json:"new_value"`
		Operator string `json:"operator"`
		Reason   string `json:"reason"`
		Alert    bool   `json:"alert"`
	}
	type exportRecord struct {
		ID            int64          `json:"id"`
		Source        string         `json:"source"`
		Location      string         `json:"location"`
		Description   string         `json:"description"`
		Status        string         `json:"status"`
		PendingReason string         `json:"pending_reason,omitempty"`
		Operator      string         `json:"operator"`
		PhotoRef      string         `json:"photo_ref,omitempty"`
		Version       int            `json:"version"`
		CreatedAt     string         `json:"created_at"`
		UpdatedAt     string         `json:"updated_at"`
		Alerts        []exportChange `json:"alerts,omitempty"`
		Changes       []exportChange `json:"changes"`
	}

	var out []exportRecord
	for _, r := range records {
		logs, _ := d.GetChangeLogs(r.ID)
		alerts, _ := d.GetAlertLogs(r.ID)

		er := exportRecord{
			ID:            r.ID,
			Source:        r.Source,
			Location:      r.Location,
			Description:   r.Description,
			Status:        r.Status,
			PendingReason: r.PendingReason,
			Operator:      r.Operator,
			PhotoRef:      r.PhotoRef,
			Version:       r.Version,
			CreatedAt:     r.CreatedAt.Format(time.RFC3339),
			UpdatedAt:     r.UpdatedAt.Format(time.RFC3339),
		}
		for _, a := range alerts {
			er.Alerts = append(er.Alerts, exportChange{
				Time: a.CreatedAt.Format(time.RFC3339), Type: a.ChangeType,
				Field: a.Field, OldValue: a.OldValue, NewValue: a.NewValue,
				Operator: a.Operator, Reason: a.Reason, Alert: a.Alert,
			})
		}
		for _, c := range logs {
			er.Changes = append(er.Changes, exportChange{
				Time: c.CreatedAt.Format(time.RFC3339), Type: c.ChangeType,
				Field: c.Field, OldValue: c.OldValue, NewValue: c.NewValue,
				Operator: c.Operator, Reason: c.Reason, Alert: c.Alert,
			})
		}
		out = append(out, er)
	}

	data, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		return err
	}
	if exportOutput != "" {
		return os.WriteFile(exportOutput, data, 0644)
	}
	fmt.Println(string(data))
	return nil
}
