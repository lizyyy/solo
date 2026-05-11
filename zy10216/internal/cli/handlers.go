package cli

import (
	"fmt"
	"time"

	"lensrent/internal/export"
	"lensrent/internal/models"
	"lensrent/internal/service"
	"lensrent/internal/store"

	"github.com/spf13/cobra"
)

type CLI struct {
	store    *store.Store
	svc      *service.RentalService
	exporter *export.Exporter
}

func New() *CLI {
	s := store.New()
	return &CLI{
		store:    s,
		svc:      service.NewRentalService(s),
		exporter: export.New(),
	}
}

func (c *CLI) HandleAddEquipment(cmd *cobra.Command, args []string) error {
	name, _ := cmd.Flags().GetString("name")
	eqType, _ := cmd.Flags().GetString("type")
	depositStr, _ := cmd.Flags().GetString("deposit")
	rateStr, _ := cmd.Flags().GetString("rate")
	accessoriesStr, _ := cmd.Flags().GetString("accessories")

	deposit := parseFloatOrDefault(depositStr, 0)
	rate := parseFloatOrDefault(rateStr, 0)
	accessories := parseStringSlice(accessoriesStr)

	db, err := c.store.Load()
	if err != nil {
		return err
	}

	eq, created, err := c.svc.GetOrCreateEquipment(db, "", name, eqType, deposit, rate, accessories)
	if err != nil {
		return err
	}

	if err := c.store.Save(db); err != nil {
		return err
	}

	if created {
		fmt.Printf("✅ 新器材已添加\n")
	} else {
		fmt.Printf("ℹ️  已找到同名器材\n")
	}
	fmt.Printf("   ID:     %s\n", eq.ID)
	fmt.Printf("   名称:   %s\n", eq.Name)
	fmt.Printf("   类型:   %s\n", eq.Type)
	fmt.Printf("   押金:   ¥%.2f\n", eq.Deposit)
	fmt.Printf("   日租:   ¥%.2f/天\n", eq.DailyRate)
	if len(eq.Accessories) > 0 {
		fmt.Printf("   配件:   %v\n", eq.Accessories)
	}
	return nil
}

func (c *CLI) HandleAddRenter(cmd *cobra.Command, args []string) error {
	name, _ := cmd.Flags().GetString("name")
	phone, _ := cmd.Flags().GetString("phone")
	email, _ := cmd.Flags().GetString("email")
	notes, _ := cmd.Flags().GetString("notes")

	db, err := c.store.Load()
	if err != nil {
		return err
	}

	renter, created, err := c.svc.GetOrCreateRenter(db, "", name, phone, email, notes)
	if err != nil {
		return err
	}

	if err := c.store.Save(db); err != nil {
		return err
	}

	if created {
		fmt.Printf("✅ 新租客已添加\n")
	} else {
		fmt.Printf("ℹ️  已找到同手机号租客\n")
	}
	fmt.Printf("   ID:     %s\n", renter.ID)
	fmt.Printf("   姓名:   %s\n", renter.Name)
	fmt.Printf("   电话:   %s\n", renter.Phone)
	return nil
}

func (c *CLI) HandleRentOut(cmd *cobra.Command, args []string) error {
	equipmentID, _ := cmd.Flags().GetString("equipment-id")
	renterID, _ := cmd.Flags().GetString("renter-id")
	start, _ := cmd.Flags().GetString("start")
	end, _ := cmd.Flags().GetString("end")
	depositStr, _ := cmd.Flags().GetString("deposit")
	rateStr, _ := cmd.Flags().GetString("rate")
	accessoriesStr, _ := cmd.Flags().GetString("accessories")
	checklistRaw, _ := cmd.Flags().GetStringSlice("check")
	customID, _ := cmd.Flags().GetString("id")
	yes, _ := cmd.Flags().GetBool("yes")

	accessories := parseStringSlice(accessoriesStr)
	checklist := parseChecklistItems(checklistRaw)
	deposit := parseFloatOrDefault(depositStr, 0)
	rate := parseFloatOrDefault(rateStr, 0)

	db, err := c.store.Load()
	if err != nil {
		return err
	}

	rental, validation, err := c.svc.CreateRental(
		db,
		equipmentID, renterID,
		start, end,
		deposit, rate,
		accessories, checklist,
		customID,
	)

	if validation != nil {
		printValidationResult(validation)
	}

	if err != nil {
		return fmt.Errorf("创建订单失败: %w", err)
	}

	printRentalSummary(rental)

	if !yes {
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
		confirmed := promptYesNo("确认创建订单并保存?", true)
		if !confirmed {
			fmt.Println("❌ 操作已取消")
			return nil
		}
	}

	if err := c.store.Save(db); err != nil {
		return err
	}

	fmt.Printf("✅ 订单已创建，ID: %s\n", rental.ID)
	return nil
}

func (c *CLI) HandleRentIn(cmd *cobra.Command, args []string) error {
	rentalID, _ := cmd.Flags().GetString("id")
	actualReturn, _ := cmd.Flags().GetString("return-date")
	accessoriesStr, _ := cmd.Flags().GetString("accessories")
	checklistRaw, _ := cmd.Flags().GetStringSlice("check")
	yes, _ := cmd.Flags().GetBool("yes")

	accessories := parseStringSlice(accessoriesStr)
	checklist := parseChecklistItems(checklistRaw)

	if actualReturn == "" {
		actualReturn = time.Now().Format("2006-01-02")
	}

	db, err := c.store.Load()
	if err != nil {
		return err
	}

	rental, validation, err := c.svc.ProcessReturn(db, rentalID, actualReturn, accessories, checklist)

	if validation != nil {
		printValidationResult(validation)
	}

	if err != nil {
		return fmt.Errorf("归还处理失败: %w", err)
	}

	printRentalSummary(rental)

	if !yes {
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
		confirmed := promptYesNo("确认完成归还并保存?", true)
		if !confirmed {
			fmt.Println("❌ 操作已取消")
			return nil
		}
	}

	if err := c.store.Save(db); err != nil {
		return err
	}

	fmt.Printf("✅ 订单 %s 已完成归还，应退押金: ¥%.2f\n", rentalID, rental.RefundAmount)
	return nil
}

func (c *CLI) HandleCompensate(cmd *cobra.Command, args []string) error {
	rentalID, _ := cmd.Flags().GetString("id")
	amountStr, _ := cmd.Flags().GetString("amount")
	note, _ := cmd.Flags().GetString("note")
	yes, _ := cmd.Flags().GetBool("yes")

	amount := parseFloatOrDefault(amountStr, 0)
	if amount <= 0 {
		return fmt.Errorf("赔付金额必须大于0")
	}

	db, err := c.store.Load()
	if err != nil {
		return err
	}

	rental, validation, err := c.svc.ApplyCompensation(db, rentalID, amount, note)

	if validation != nil {
		printValidationResult(validation)
	}

	if err != nil {
		return fmt.Errorf("赔付处理失败: %w", err)
	}

	printRentalSummary(rental)

	if !yes {
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
		confirmed := promptYesNo("确认添加赔付记录?", true)
		if !confirmed {
			fmt.Println("❌ 操作已取消")
			return nil
		}
	}

	if err := c.store.Save(db); err != nil {
		return err
	}

	fmt.Printf("✅ 赔付已记录，更新后应退押金: ¥%.2f\n", rental.RefundAmount)
	return nil
}

func (c *CLI) HandleListRentals(cmd *cobra.Command, args []string) error {
	status, _ := cmd.Flags().GetString("status")

	db, err := c.store.Load()
	if err != nil {
		return err
	}

	rentals := c.svc.ListRentals(db, status)

	if len(rentals) == 0 {
		fmt.Println("📋 暂无订单记录")
		return nil
	}

	fmt.Printf("📋 订单列表 (共 %d 条)\n", len(rentals))
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	for _, r := range rentals {
		fmt.Printf("[%s] %s - %s\n", r.Status, r.ID, r.EquipmentName)
		fmt.Printf("    租客: %s | 租期: %s → %s\n", r.RenterName, r.RentalStart, r.RentalEnd)
		if r.IsReturned {
			fmt.Printf("    押金: ¥%.2f | 应退: ¥%.2f\n", r.DepositPaid, r.RefundAmount)
		} else {
			fmt.Printf("    押金: ¥%.2f | 状态: 在租\n", r.DepositPaid)
		}
		fmt.Println()
	}
	return nil
}

func (c *CLI) HandleShowRental(cmd *cobra.Command, args []string) error {
	rentalID, _ := cmd.Flags().GetString("id")

	db, err := c.store.Load()
	if err != nil {
		return err
	}

	rental := c.svc.GetRentalByID(db, rentalID)
	if rental == nil {
		return fmt.Errorf("未找到订单: %s", rentalID)
	}

	printRentalDetail(rental)
	return nil
}

func printRentalDetail(r *models.Rental) {
	fmt.Println("")
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Printf("订单ID:   %s\n", r.ID)
	fmt.Printf("状态:     %s\n", r.Status)
	fmt.Println("────────────────────────────────────────")
	fmt.Printf("器材:     %s (%s)\n", r.EquipmentName, r.EquipmentID)
	fmt.Printf("租客:     %s (%s)\n", r.RenterName, r.RenterPhone)
	fmt.Println("────────────────────────────────────────")
	fmt.Printf("借出日期: %s\n", r.RentalStart)
	fmt.Printf("计划归还: %s\n", r.RentalEnd)
	if r.ActualReturn != "" {
		fmt.Printf("实际归还: %s\n", r.ActualReturn)
	}
	fmt.Println("────────────────────────────────────────")
	fmt.Printf("押金:     ¥%.2f\n", r.DepositPaid)
	fmt.Printf("日租金:   ¥%.2f/天\n", r.DailyRate)
	fmt.Printf("出库配件: %v\n", r.AccessoriesOut)
	if len(r.AccessoriesBack) > 0 {
		fmt.Printf("归还配件: %v\n", r.AccessoriesBack)
	}

	if r.IsReturned {
		fmt.Println("────────────────────────────────────────")
		fmt.Println("【 结算明细 】")
		fmt.Printf("  押金已付: ¥%.2f\n", r.DepositPaid)
		if r.OverdueDays > 0 {
			fmt.Printf("  逾期天数: %d 天\n", r.OverdueDays)
			fmt.Printf("  逾期费用: ¥%.2f (日租金的1.5倍)\n", r.OverdueFee)
		}
		if len(r.MissingAccessories) > 0 {
			fmt.Printf("  缺失配件: %v\n", r.MissingAccessories)
			fmt.Printf("  缺失扣款: ¥%.2f (每件 ¥50)\n", r.MissingFee)
		}
		if r.IsCompensated {
			fmt.Printf("  赔付金额: ¥%.2f\n", r.CompensationAmount)
			fmt.Printf("  赔付说明: %s\n", r.CompensationNote)
		}
		totalDeduct := r.OverdueFee + r.MissingFee + r.CompensationAmount
		fmt.Printf("  ───────────────────────────────\n")
		fmt.Printf("  扣款合计: ¥%.2f\n", totalDeduct)
		fmt.Printf("  应退押金: ¥%.2f\n", r.RefundAmount)
	}

	if len(r.OutChecklist) > 0 {
		fmt.Println("────────────────────────────────────────")
		fmt.Println("【 出库验机 】")
		for _, item := range r.OutChecklist {
			status := "✅"
			if !item.IsGood {
				status = "❌"
			}
			note := ""
			if item.Comment != "" {
				note = fmt.Sprintf(" (%s)", item.Comment)
			}
			fmt.Printf("  %s %s%s\n", status, item.Name, note)
		}
	}

	if len(r.InChecklist) > 0 {
		fmt.Println("────────────────────────────────────────")
		fmt.Println("【 归还验机 】")
		for _, item := range r.InChecklist {
			status := "✅"
			if !item.IsGood {
				status = "❌"
			}
			note := ""
			if item.Comment != "" {
				note = fmt.Sprintf(" (%s)", item.Comment)
			}
			fmt.Printf("  %s %s%s\n", status, item.Name, note)
		}
	}
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Println("")
}

func (c *CLI) HandleExportRentals(cmd *cobra.Command, args []string) error {
	output, _ := cmd.Flags().GetString("output")
	status, _ := cmd.Flags().GetString("status")

	if output == "" {
		output = fmt.Sprintf("exports/rentals_%s.csv", time.Now().Format("20060102_150405"))
	}

	db, err := c.store.Load()
	if err != nil {
		return err
	}

	rentals := c.svc.ListRentals(db, status)

	if err := c.exporter.ExportRentalsToCSV(rentals, output); err != nil {
		return err
	}

	fmt.Printf("✅ 已导出 %d 条订单到: %s\n", len(rentals), output)
	return nil
}

func (c *CLI) HandleExportDisputes(cmd *cobra.Command, args []string) error {
	output, _ := cmd.Flags().GetString("output")

	if output == "" {
		output = fmt.Sprintf("exports/disputes_%s.csv", time.Now().Format("20060102_150405"))
	}

	db, err := c.store.Load()
	if err != nil {
		return err
	}

	if err := c.exporter.ExportDisputesToCSV(db.Disputes, output); err != nil {
		return err
	}

	fmt.Printf("✅ 已导出 %d 条争议记录到: %s\n", len(db.Disputes), output)
	return nil
}

func (c *CLI) HandleExportDisputeSummary(cmd *cobra.Command, args []string) error {
	output, _ := cmd.Flags().GetString("output")

	if output == "" {
		output = fmt.Sprintf("exports/dispute_summary_%s.txt", time.Now().Format("20060102_150405"))
	}

	db, err := c.store.Load()
	if err != nil {
		return err
	}

	if err := c.exporter.ExportDisputeSummary(db, output); err != nil {
		return err
	}

	fmt.Printf("✅ 已导出争议汇总报告到: %s\n", output)
	return nil
}

func (c *CLI) HandleExportDetail(cmd *cobra.Command, args []string) error {
	rentalID, _ := cmd.Flags().GetString("id")
	output, _ := cmd.Flags().GetString("output")

	db, err := c.store.Load()
	if err != nil {
		return err
	}

	rental := c.svc.GetRentalByID(db, rentalID)
	if rental == nil {
		return fmt.Errorf("未找到订单: %s", rentalID)
	}

	if output == "" {
		output = fmt.Sprintf("exports/rental_%s_detail.txt", rentalID)
	}

	if err := c.exporter.ExportSingleRentalDetail(rental, output); err != nil {
		return err
	}

	fmt.Printf("✅ 已导出订单详情到: %s\n", output)
	return nil
}

func (c *CLI) HandleImportRentals(cmd *cobra.Command, args []string) error {
	input, _ := cmd.Flags().GetString("input")
	dryRun, _ := cmd.Flags().GetBool("dry-run")
	yes, _ := cmd.Flags().GetBool("yes")

	if input == "" {
		return fmt.Errorf("请指定输入文件路径 (--input)")
	}

	importedRentals, parseResult, err := c.exporter.ImportRentalsFromCSV(input)
	if err != nil {
		return fmt.Errorf("解析CSV失败: %w", err)
	}

	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Printf("CSV解析结果:\n")
	fmt.Printf("  总行数:   %d\n", parseResult.TotalRows)
	fmt.Printf("  解析成功: %d\n", len(*importedRentals))
	if parseResult.Failed > 0 {
		fmt.Printf("  解析失败: %d\n", parseResult.Failed)
		for _, d := range parseResult.FailedDetails {
			fmt.Printf("    - %s\n", d)
		}
	}
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	db, err := c.store.Load()
	if err != nil {
		return err
	}

	mergeResult := c.svc.MergeImportedRentals(db, importedRentals)

	fmt.Println()
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Printf("导入规划:\n")
	fmt.Printf("  待导入:   %d\n", mergeResult.TotalRows)
	fmt.Printf("  新增:     %d\n", mergeResult.ImportedNew)
	fmt.Printf("  跳过重复: %d\n", mergeResult.SkippedExisting)
	if mergeResult.SkippedExisting > 0 {
		fmt.Printf("  重复ID:   %v\n", mergeResult.SkippedIDs)
	}
	if mergeResult.Failed > 0 {
		fmt.Printf("  失败:     %d\n", mergeResult.Failed)
		for _, d := range mergeResult.FailedDetails {
			fmt.Printf("    - %s\n", d)
		}
	}
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	if dryRun {
		fmt.Println("\n📋 [Dry Run] 仅预览，未执行实际导入")
		return nil
	}

	if !yes {
		confirmed := promptYesNo("确认执行导入?", false)
		if !confirmed {
			fmt.Println("❌ 操作已取消")
			return nil
		}
	}

	if err := c.store.Save(db); err != nil {
		return fmt.Errorf("保存数据库失败: %w", err)
	}

	fmt.Printf("\n✅ 导入完成: 新增 %d 条, 跳过 %d 条重复\n",
		mergeResult.ImportedNew, mergeResult.SkippedExisting)

	if mergeResult.SkippedExisting > 0 {
		fmt.Printf("⚠️  跳过的重复订单不会影响现有历史和报表\n")
	}

	return nil
}
