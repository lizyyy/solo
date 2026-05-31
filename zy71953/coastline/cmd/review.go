package cmd

import (
	"fmt"
	"strconv"

	"coastline/db"

	"github.com/spf13/cobra"
)

var reviewCmd = &cobra.Command{
	Use:   "review <id>",
	Short: "复核记录：标记为已复核或退回待处理",
	Args:  cobra.ExactArgs(1),
	RunE:  runReview,
}

var reviewAction string
var reviewReason string
var reviewOperator string

func init() {
	reviewCmd.Flags().StringVarP(&reviewAction, "action", "a", "approve", "操作：approve（通过）或 reject（退回待处理）")
	reviewCmd.Flags().StringVarP(&reviewReason, "reason", "r", "", "原因（退回时必填）")
	reviewCmd.Flags().StringVarP(&reviewOperator, "operator", "o", "", "操作人（必填）")
	reviewCmd.MarkFlagRequired("operator")
}

func runReview(cmd *cobra.Command, args []string) error {
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

	if r.Status != "imported" && r.Status != "pending" {
		return fmt.Errorf("记录 #%d 当前状态为 %q，只有 imported/pending 状态可复核", id, r.Status)
	}

	oldStatus := r.Status
	switch reviewAction {
	case "approve":
		r.Status = "reviewed"
	case "reject":
		if reviewReason == "" {
			return fmt.Errorf("退回待处理时必须填写原因（--reason）")
		}
		r.Status = "pending"
		r.PendingReason = reviewReason
	default:
		return fmt.Errorf("未知操作 %q，可选：approve / reject", reviewAction)
	}

	if err := d.UpdateRecord(r); err != nil {
		return fmt.Errorf("更新记录失败: %w", err)
	}

	cl := &db.ChangeLog{
		RecordID:   id,
		ChangeType: "review",
		Field:      "status",
		OldValue:   oldStatus,
		NewValue:   r.Status,
		Operator:   reviewOperator,
		Reason:     reviewReason,
	}
	if r.Status == "pending" {
		cl.Reason = reviewReason
	}
	d.InsertChangeLog(cl)

	if r.Status == "reviewed" {
		fmt.Printf("✓ #%d [%s/%s] 已复核通过 (was %s)\n", id, r.Source, r.Location, oldStatus)
	} else {
		fmt.Printf("↩ #%d [%s/%s] 退回待处理 (原因: %s)\n", id, r.Source, r.Location, reviewReason)
	}
	return nil
}
