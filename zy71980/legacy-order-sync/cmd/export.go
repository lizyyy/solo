package cmd

import (
	"encoding/csv"
	"fmt"
	"os"
	"strconv"
	"time"

	"legacy-order-sync/db"

	"github.com/spf13/cobra"
)

var exportOutput string
var exportStatus string
var exportOperator string

var exportCmd = &cobra.Command{
	Use:   "export",
	Short: "导出迁移报告",
	Long: `导出迁移报告为 CSV 格式，重点不是排版，而是下一班能继续查。

每条记录包含：ID、订单号、来源、状态、幂等键状态、参数破坏、
待处理原因、复核原因、复核人、修正人、创建时间、更新时间。
争议记录会附带完整的复核原因，不只是总数。

使用方式：
  los export -o report.csv
  los export -o pending.csv --status pending
  los export -o reviewed.csv --status reviewed`,
	RunE: runExport,
}

func init() {
	rootCmd.AddCommand(exportCmd)
	exportCmd.Flags().StringVarP(&exportOutput, "output", "o", "", "输出文件路径 (默认: migration_report_YYYYMMDD.csv)")
	exportCmd.Flags().StringVar(&exportStatus, "status", "", "只导出指定状态的记录")
	exportCmd.Flags().StringVar(&exportOperator, "operator", "system", "导出操作人")
}

func runExport(cmd *cobra.Command, args []string) error {
	database, err := db.EnsureDB()
	if err != nil {
		return fmt.Errorf("初始化数据库失败: %w", err)
	}
	defer database.Close()

	var orders []db.Order
	if exportStatus != "" {
		if !db.IsValidStatus(exportStatus) {
			return fmt.Errorf("无效状态 %q", exportStatus)
		}
		orders, err = db.ListOrdersByStatus(database, exportStatus, 10000)
	} else {
		orders, err = db.ListAllOrders(database, 10000)
	}
	if err != nil {
		return fmt.Errorf("查询记录失败: %w", err)
	}

	if len(orders) == 0 {
		fmt.Println("没有可导出的记录")
		return nil
	}

	outputPath := exportOutput
	if outputPath == "" {
		outputPath = fmt.Sprintf("migration_report_%s.csv", time.Now().Format("20060102"))
	}

	f, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("创建输出文件失败: %w", err)
	}
	defer f.Close()

	f.Write([]byte("\xEF\xBB\xBF"))

	writer := csv.NewWriter(f)
	defer writer.Flush()

	header := []string{
		"ID", "订单号", "来源", "状态",
		"幂等键", "幂等键有效", "客户端参数破坏",
		"待处理原因", "复核原因", "复核人", "复核时间",
		"创建时间", "更新时间",
	}
	if err := writer.Write(header); err != nil {
		return fmt.Errorf("写入表头失败: %w", err)
	}

	statusCounts := make(map[string]int)
	pendingWithReason := 0
	reviewedWithReason := 0
	corruptedWithReview := 0

	for _, o := range orders {
		statusCounts[o.Status]++

		if o.Status == db.StatusPending && o.PendingReason != "" {
			pendingWithReason++
		}
		if o.Status == db.StatusReviewed && o.ReviewReason != "" {
			reviewedWithReason++
		}
		if o.ClientParamsCorrupted && o.ReviewReason != "" {
			corruptedWithReview++
		}

		reviewedAt := ""
		if o.ReviewedAt != nil {
			reviewedAt = o.ReviewedAt.Format("2006-01-02 15:04:05")
		}

		ikValid := "是"
		if !o.IdempotencyKeyValid {
			ikValid = "否"
		}
		corrupted := "否"
		if o.ClientParamsCorrupted {
			corrupted = "是"
		}

		row := []string{
			strconv.FormatInt(o.ID, 10),
			o.OrderNo,
			o.Source,
			o.Status,
			o.IdempotencyKey,
			ikValid,
			corrupted,
			o.PendingReason,
			o.ReviewReason,
			o.ReviewedBy,
			reviewedAt,
			o.CreatedAt.Format("2006-01-02 15:04:05"),
			o.UpdatedAt.Format("2006-01-02 15:04:05"),
		}
		if err := writer.Write(row); err != nil {
			return fmt.Errorf("写入行失败: %w", err)
		}
	}

	history := &db.OrderHistory{
		OrderID:   0,
		Action:    "export",
		OldStatus: "",
		NewStatus: "",
		Operator:  exportOperator,
		Reason:    fmt.Sprintf("导出 %d 条记录到 %s", len(orders), outputPath),
		Detail:    fmt.Sprintf(`{"total":%d,"status_filter":"%s"}`, len(orders), exportStatus),
	}
	if err := db.InsertHistory(database, history); err != nil {
		fmt.Fprintf(os.Stderr, "警告: 写入导出历史失败: %v\n", err)
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return fmt.Errorf("写入 CSV 失败: %w", err)
	}

	fmt.Printf("导出完成: %s (%d 条记录)\n", outputPath, len(orders))
	fmt.Println()
	fmt.Println("统计摘要:")
	fmt.Println("─────────────────────────────────────")
	for _, s := range []string{db.StatusImported, db.StatusPending, db.StatusReviewed, db.StatusFixed, db.StatusMigrated, db.StatusSkipped} {
		if c, ok := statusCounts[s]; ok {
			fmt.Printf("  %-10s %d 条\n", s, c)
		}
	}
	fmt.Println("─────────────────────────────────────")
	fmt.Printf("  待处理(有原因): %d 条\n", pendingWithReason)
	fmt.Printf("  已复核(有原因): %d 条\n", reviewedWithReason)
	fmt.Printf("  参数破坏(有复核): %d 条\n", corruptedWithReview)
	fmt.Println()
	fmt.Println("提示: 争议记录的复核原因已在 CSV 的「复核原因」列，下一班可直接筛选查看，不必翻聊天记录。")
	return nil
}
