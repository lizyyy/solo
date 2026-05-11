package cli

import (
	"github.com/spf13/cobra"
)

func (c *CLI) NewRootCmd() *cobra.Command {
	rootCmd := &cobra.Command{
		Use:   "lensrent",
		Short: "相机镜头出租押金管理 CLI",
		Long: `相机镜头出租押金管理工具 - 记录器材、配件、租客、租期、押金、
出库验机和归还检查。支持分步骤运行、先检查再确认，
历史可查询可导出，并处理多种边界情况。

示例:
  lensrent add-equipment --name "索尼 FE 24-70mm F2.8" --type 镜头 --deposit 5000 --rate 200
  lensrent add-renter --name "张三" --phone "13800138000"
  lensrent rent-out --equipment-id EQ... --renter-id RT... --start 2026-05-01 --end 2026-05-05
  lensrent rent-in --id RN... --return-date 2026-05-06
  lensrent list --status all
  lensrent show --id RN...
  lensrent export-rentals`,
	}

	rootCmd.AddCommand(c.newAddEquipmentCmd())
	rootCmd.AddCommand(c.newAddRenterCmd())
	rootCmd.AddCommand(c.newRentOutCmd())
	rootCmd.AddCommand(c.newRentInCmd())
	rootCmd.AddCommand(c.newCompensateCmd())
	rootCmd.AddCommand(c.newListCmd())
	rootCmd.AddCommand(c.newShowCmd())
	rootCmd.AddCommand(c.newExportRentalsCmd())
	rootCmd.AddCommand(c.newExportDisputesCmd())
	rootCmd.AddCommand(c.newExportDisputeSummaryCmd())
	rootCmd.AddCommand(c.newExportDetailCmd())

	return rootCmd
}

func (c *CLI) newAddEquipmentCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "add-equipment",
		Short: "添加器材（相机/镜头等）",
		Long: `添加器材到库存。可指定押金、日租金、配件清单等。

示例:
  lensrent add-equipment --name "索尼 A7M4" --type 相机 --deposit 8000 --rate 300
  lensrent add-equipment --name "索尼 FE 24-70mm F2.8" --type 镜头 --deposit 5000 --rate 200 --accessories "镜头盖,遮光罩,UV镜"`,
		RunE: c.HandleAddEquipment,
	}

	cmd.Flags().String("name", "", "器材名称 (必填)")
	cmd.Flags().String("type", "", "器材类型 (如: 相机/镜头)")
	cmd.Flags().String("deposit", "0", "押金金额 (元)")
	cmd.Flags().String("rate", "0", "日租金 (元/天)")
	cmd.Flags().String("accessories", "", "配件清单 (逗号分隔，如: 镜头盖,遮光罩)")

	_ = cmd.MarkFlagRequired("name")
	return cmd
}

func (c *CLI) newAddRenterCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "add-renter",
		Short: "添加租客信息",
		Long: `添加租客信息。系统会自动根据手机号去重。

示例:
  lensrent add-renter --name "张三" --phone "13800138000"
  lensrent add-renter --name "李四" --phone "13900139000" --email lisi@example.com`,
		RunE: c.HandleAddRenter,
	}

	cmd.Flags().String("name", "", "租客姓名 (必填)")
	cmd.Flags().String("phone", "", "联系电话")
	cmd.Flags().String("email", "", "电子邮箱")
	cmd.Flags().String("notes", "", "备注")

	_ = cmd.MarkFlagRequired("name")
	return cmd
}

func (c *CLI) newRentOutCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "rent-out",
		Short: "【步骤1】借出登记 - 创建出租订单",
		Long: `创建出租订单，记录器材、租客、租期、押金和配件。

⚠️  校验规则:
  - 归还日期不能早于借出日期
  - 器材不能与已有在租订单冲突
  - 出库验机清单可选但建议填写
  - 默认使用器材预设的押金和日租金

验机清单格式: --check "项目名" --check "项目名:NG-问题描述"
  例如: --check "外观完好" --check "功能正常:NG-对焦卡顿"

示例:
  lensrent rent-out --equipment-id EQ2026... --renter-id RT2026... \
    --start 2026-05-01 --end 2026-05-05 \
    --accessories "镜头盖,遮光罩" \
    --check "外观完好" --check "功能正常" --check "配件齐全"`,
		RunE: c.HandleRentOut,
	}

	cmd.Flags().String("equipment-id", "", "器材ID (必填)")
	cmd.Flags().String("renter-id", "", "租客ID (必填)")
	cmd.Flags().String("start", "", "借出日期 YYYY-MM-DD (必填)")
	cmd.Flags().String("end", "", "计划归还日期 YYYY-MM-DD (必填)")
	cmd.Flags().String("deposit", "", "实际押金 (不填则用器材预设)")
	cmd.Flags().String("rate", "", "实际日租金 (不填则用器材预设)")
	cmd.Flags().String("accessories", "", "实际出库配件 (逗号分隔)")
	cmd.Flags().StringSlice("check", []string{}, "出库验机清单 (可多次使用)")
	cmd.Flags().String("id", "", "自定义订单ID (不填则自动生成)")
	cmd.Flags().Bool("yes", false, "跳过确认直接保存")

	_ = cmd.MarkFlagRequired("equipment-id")
	_ = cmd.MarkFlagRequired("renter-id")
	_ = cmd.MarkFlagRequired("start")
	_ = cmd.MarkFlagRequired("end")
	return cmd
}

func (c *CLI) newRentInCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "rent-in",
		Short: "【步骤2】归还登记 - 结算应退押金",
		Long: `处理器材归还，自动计算逾期费、缺失配件扣款，并算出应退押金。

⚠️  校验规则:
  - 实际归还日期不能早于借出日期
  - 已归还的订单不能重复操作
  - 系统自动比对出库/归还配件差异
  - 逾期费按日租金的1.5倍计算
  - 配件缺失按每件50元扣款

验机清单格式: --check "项目名" --check "项目名:NG-问题描述"

示例:
  lensrent rent-in --id RN2026... --return-date 2026-05-06 \
    --accessories "镜头盖" \
    --check "外观完好:NG-镜身有划痕" --check "功能正常"

  # 正常归还 (今天)
  lensrent rent-in --id RN2026... --accessories "镜头盖,遮光罩"`,
		RunE: c.HandleRentIn,
	}

	cmd.Flags().String("id", "", "订单ID (必填)")
	cmd.Flags().String("return-date", "", "实际归还日期 YYYY-MM-DD (默认今天)")
	cmd.Flags().String("accessories", "", "实际归还配件 (逗号分隔)")
	cmd.Flags().StringSlice("check", []string{}, "归还验机清单 (可多次使用)")
	cmd.Flags().Bool("yes", false, "跳过确认直接保存")

	_ = cmd.MarkFlagRequired("id")
	return cmd
}

func (c *CLI) newCompensateCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "compensate",
		Short: "【步骤3】赔付处理 - 添加额外扣款",
		Long: `添加赔付记录（如损坏赔偿）。

⚠️  校验规则:
  - 已做过赔付的订单不能再次修改赔付
  - 赔付金额从应退押金中扣除
  - 会记录到争议明细便于导出

示例:
  lensrent compensate --id RN2026... --amount 500 --note "镜头镀膜划伤需维修"`,
		RunE: c.HandleCompensate,
	}

	cmd.Flags().String("id", "", "订单ID (必填)")
	cmd.Flags().String("amount", "", "赔付金额 (必填)")
	cmd.Flags().String("note", "", "赔付说明")
	cmd.Flags().Bool("yes", false, "跳过确认直接保存")

	_ = cmd.MarkFlagRequired("id")
	_ = cmd.MarkFlagRequired("amount")
	return cmd
}

func (c *CLI) newListCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "查询订单列表",
		Long: `按状态查询订单列表。

状态值: all|out|returned

示例:
  lensrent list --status all
  lensrent list --status out      # 只看在租
  lensrent list --status returned # 只看已归还`,
		RunE: c.HandleListRentals,
	}

	cmd.Flags().String("status", "all", "状态筛选: all|out|returned")
	return cmd
}

func (c *CLI) newShowCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "show",
		Short: "查看订单详情",
		Example: `  lensrent show --id RN20260501120000001`,
		RunE: c.HandleShowRental,
	}

	cmd.Flags().String("id", "", "订单ID (必填)")
	_ = cmd.MarkFlagRequired("id")
	return cmd
}

func (c *CLI) newExportRentalsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "export-rentals",
		Short: "导出订单数据为CSV",
		Example: `  lensrent export-rentals
  lensrent export-rentals --output /path/to/orders.csv
  lensrent export-rentals --status returned`,
		RunE: c.HandleExportRentals,
	}

	cmd.Flags().String("output", "", "输出路径 (默认 exports/rentals_时间戳.csv)")
	cmd.Flags().String("status", "all", "筛选状态: all|out|returned")
	return cmd
}

func (c *CLI) newExportDisputesCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "export-disputes",
		Short: "导出争议记录为CSV",
		Example: `  lensrent export-disputes
  lensrent export-disputes --output /path/to/disputes.csv`,
		RunE: c.HandleExportDisputes,
	}

	cmd.Flags().String("output", "", "输出路径 (默认 exports/disputes_时间戳.csv)")
	return cmd
}

func (c *CLI) newExportDisputeSummaryCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "export-dispute-summary",
		Short: "导出争议处理汇总报告",
		Example: `  lensrent export-dispute-summary
  lensrent export-dispute-summary --output /path/to/summary.txt`,
		RunE: c.HandleExportDisputeSummary,
	}

	cmd.Flags().String("output", "", "输出路径 (默认 exports/dispute_summary_时间戳.txt)")
	return cmd
}

func (c *CLI) newExportDetailCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "export-detail",
		Short: "导出单个订单详细信息",
		Example: `  lensrent export-detail --id RN2026...
  lensrent export-detail --id RN2026... --output /path/to/detail.txt`,
		RunE: c.HandleExportDetail,
	}

	cmd.Flags().String("id", "", "订单ID (必填)")
	cmd.Flags().String("output", "", "输出路径")
	_ = cmd.MarkFlagRequired("id")
	return cmd
}
