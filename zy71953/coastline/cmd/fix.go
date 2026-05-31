package cmd

import (
	"fmt"
	"strconv"

	"coastline/db"

	"github.com/spf13/cobra"
)

var fixCmd = &cobra.Command{
	Use:   "fix <id>",
	Short: "修正记录（必须填写变更原因）",
	Args:  cobra.ExactArgs(1),
	RunE:  runFix,
}

var fixDescription string
var fixLocation string
var fixPhotoRef string
var fixStatus string
var fixPendingReason string
var fixReason string
var fixOperator string

func init() {
	fixCmd.Flags().StringVarP(&fixDescription, "description", "d", "", "修正描述")
	fixCmd.Flags().StringVarP(&fixLocation, "location", "l", "", "修正位置")
	fixCmd.Flags().StringVarP(&fixPhotoRef, "photo-ref", "p", "", "修正巡检照片引用")
	fixCmd.Flags().StringVarP(&fixStatus, "status", "s", "", "修正状态（imported/pending/reviewed/fixed/closed）")
	fixCmd.Flags().StringVarP(&fixPendingReason, "pending-reason", "", "", "修正待处理原因")
	fixCmd.Flags().StringVarP(&fixReason, "reason", "r", "", "变更原因（必填）")
	fixCmd.Flags().StringVarP(&fixOperator, "operator", "o", "", "操作人（必填）")
	fixCmd.MarkFlagRequired("reason")
	fixCmd.MarkFlagRequired("operator")
}

func runFix(cmd *cobra.Command, args []string) error {
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

	changed := false

	if fixDescription != "" && fixDescription != r.Description {
		d.InsertChangeLog(&db.ChangeLog{
			RecordID: id, ChangeType: "fix", Field: "description",
			OldValue: r.Description, NewValue: fixDescription,
			Operator: fixOperator, Reason: fixReason,
		})
		r.Description = fixDescription
		changed = true
	}

	if fixLocation != "" && fixLocation != r.Location {
		d.InsertChangeLog(&db.ChangeLog{
			RecordID: id, ChangeType: "fix", Field: "location",
			OldValue: r.Location, NewValue: fixLocation,
			Operator: fixOperator, Reason: fixReason,
		})
		r.Location = fixLocation
		changed = true
	}

	if fixPhotoRef != "" && fixPhotoRef != r.PhotoRef {
		d.InsertChangeLog(&db.ChangeLog{
			RecordID: id, ChangeType: "fix", Field: "photo_ref",
			OldValue: r.PhotoRef, NewValue: fixPhotoRef,
			Operator: fixOperator, Reason: fixReason,
		})
		r.PhotoRef = fixPhotoRef
		changed = true
	}

	if fixPendingReason != "" && fixPendingReason != r.PendingReason {
		d.InsertChangeLog(&db.ChangeLog{
			RecordID: id, ChangeType: "fix", Field: "pending_reason",
			OldValue: r.PendingReason, NewValue: fixPendingReason,
			Operator: fixOperator, Reason: fixReason,
		})
		r.PendingReason = fixPendingReason
		changed = true
	}

	if fixStatus != "" && fixStatus != r.Status {
		if !db.ValidStatuses[fixStatus] {
			return fmt.Errorf("无效状态 %q，可选: imported/pending/reviewed/fixed/closed", fixStatus)
		}
		d.InsertChangeLog(&db.ChangeLog{
			RecordID: id, ChangeType: "fix", Field: "status",
			OldValue: r.Status, NewValue: fixStatus,
			Operator: fixOperator, Reason: fixReason,
		})
		r.Status = fixStatus
		changed = true
	}

	if !changed {
		fmt.Println("无变更（提供的值与现有记录相同）")
		return nil
	}

	r.ContentHash = hashRecord(r)
	if err := d.UpdateRecord(r); err != nil {
		return fmt.Errorf("更新记录失败: %w", err)
	}

	fmt.Printf("✓ #%d [%s/%s] 已修正\n", id, r.Source, r.Location)
	return nil
}
