"""命令行接口"""

import argparse
import sys
from typing import Optional

from .service import (
    DEFAULT_RATE,
    confirm_settlement,
    export_settlement_to_csv,
    generate_batch_id,
    get_settlement,
    import_records,
    list_settlements,
    calculate_settlement,
)


def print_separator(char: str = "=", length: int = 80) -> None:
    print(char * length)


def print_header(title: str) -> None:
    print_separator("=")
    print(f"  {title}")
    print_separator("-")


def cmd_import(args: argparse.Namespace) -> int:
    print_header("导入采摘记录")
    print(f"  文件: {args.file}")
    print()

    result = import_records(args.file)

    print(f"总记录数: {result['total']}")
    print(f"成功导入: {result['imported']}")
    print(f"重复记录: {result['duplicates']}")
    print(f"无效记录: {result['invalid']}")
    print(f"未复核: {result['unreviewed']}")
    print()

    print_header("记录详情")
    print(
        f"{'行号':<6} {'工人':<15} {'日期':<12} {'筐数':<6} {'总重':<10} {'坏果':<10} {'状态':<12}"
    )
    print("-" * 75)

    for d in result["details"]:
        status = d["status"]
        if status in ["重复记录", "无效记录", "解析错误"]:
            status_mark = f"[{status}]"
        elif status == "待复核":
            status_mark = f"[⚠ {status}]"
        else:
            status_mark = f"[✓ {status}]"
        print(
            f"{d['row']:<6} {d['worker']:<15} {d['pick_date']:<12} {d['baskets']:<6} {str(d['weight'])+'kg':<10} {str(d['bad_weight'])+'kg':<10} {status_mark:<12}"
        )
        if d["errors"]:
            for err in d["errors"]:
                print(f"       └─ 错误: {err}")

    print()
    print_separator()
    return 0


def cmd_trial(args: argparse.Namespace) -> int:
    batch_id = args.batch or generate_batch_id()
    print_header(f"试算结算 [{batch_id}]")
    print(f"单价: {DEFAULT_RATE}元/kg")
    print()

    summary, _ = calculate_settlement(batch_id)

    if summary.valid_records == 0:
        print("⚠ 没有可结算的有效记录")
        if summary.warnings:
            print()
            print_header("异常警告")
            for w in summary.warnings:
                print(f"  ! {w}")
        print_separator()
        return 0

    print_header("汇总数据")
    print(f"  有效记录数: {summary.valid_records}")
    print(f"  总筐数: {summary.total_baskets}")
    print(f"  总重量: {summary.total_gross_weight:.2f}kg")
    print(f"  坏果扣重: {summary.total_bad_weight:.2f}kg")
    print(f"  净重量: {summary.total_net_weight:.2f}kg")
    print()
    print(f"  应发金额: {summary.gross_amount:.2f}元")
    print(f"  ├─ 坏果扣款: -{summary.total_deductions:.2f}元")
    print(f"  └─ 预支工资: -{summary.total_advance:.2f}元")
    print(f"  {''.join(['─']*30)}")
    print(f"  实发金额: {summary.net_amount:.2f}元")
    print()

    if summary.warnings:
        print_header("异常警告")
        for w in summary.warnings:
            print(f"  ! {w}")
        print()

    print_header("班组结算")
    print(
        f"{'班组':<20} {'工人':<6} {'筐数':<8} {'毛重(kg)':<12} {'坏果(kg)':<12} {'净重(kg)':<12} {'应发(元)':<12} {'实发(元)':<12}"
    )
    print("-" * 100)
    for ts in summary.team_settlements:
        print(
            f"{ts.team_name}({ts.team_id}):<20".ljust(20)
            + f" {len(ts.workers):<6} {ts.total_baskets:<8} {ts.total_gross_weight:<12.2f} {ts.total_bad_weight:<12.2f} {ts.total_net_weight:<12.2f} {ts.gross_amount:<12.2f} {ts.net_amount:<12.2f}"
        )
    print()

    print_header("工人明细")
    print(
        f"{'班组':<15} {'工人':<15} {'筐数':<6} {'毛重':<10} {'坏果':<10} {'净重':<10} {'应发':<10} {'扣款':<10} {'预支':<10} {'实发':<10}"
    )
    print("-" * 110)
    for ts in summary.team_settlements:
        for w in ts.workers:
            print(
                f"{ts.team_name:<15} {w.worker_name:<15} {w.total_baskets:<6} "
                f"{w.total_gross_weight:<9.2f}kg {w.total_bad_weight:<9.2f}kg "
                f"{w.total_net_weight:<9.2f}kg {w.gross_amount:<9.2f}元 "
                f"{w.total_deductions:<9.2f}元 {w.advance_payment:<9.2f}元 "
                f"{w.net_amount:<9.2f}元"
            )
    print()

    if summary.deductions:
        print_header("扣减明细 (含处理前后对比)")
        print(
            f"{'工人':<15} {'类别':<12} {'描述':<30} {'金额':<10} {'处理前':<12} {'处理后':<12}"
        )
        print("-" * 95)
        for d in summary.deductions:
            print(
                f"{d.worker_name:<15} {d.category:<12} {d.description:<30} "
                f"{d.amount:<9.2f}元 {d.before_value:<11.2f} {d.after_value:<11.2f}"
            )
    print()

    print(f"试算批次号: {batch_id}")
    print("如需确认结算，请运行:")
    print(f"  python -m orchard_settlement confirm {batch_id}")
    print_separator()
    return 0


def cmd_confirm(args: argparse.Namespace) -> int:
    batch_id = args.batch
    print_header(f"确认结算 [{batch_id}]")
    print()

    if not args.yes:
        print("⚠ 确认操作将冻结以下记录，再次导入不会重复结算:")
        print("  - 所有已复核的有效记录")
        print()
        response = input("确认执行结算？[y/N]: ").strip().lower()
        if response not in ["y", "yes"]:
            print("操作已取消")
            return 0

    try:
        success, summary = confirm_settlement(batch_id)
        if success:
            print(f"✓ 结算确认成功！批次号: {batch_id}")
            print()
            print(f"  有效记录: {summary['valid_records']} 条")
            print(f"  实发金额: {summary['net_amount']:.2f}元")
            print(f"  已关联记录数: {len(summary.get('settled_records', []))}")
            print()
            print("后续可使用以下命令导出:")
            print(f"  python -m orchard_settlement export {batch_id} output.csv")
        else:
            print("✗ 结算确认失败")
    except Exception as e:
        print(f"✗ 结算确认失败: {e}")
        return 1

    print_separator()
    return 0


def cmd_export(args: argparse.Namespace) -> int:
    batch_id = args.batch
    output_path = args.output

    print_header(f"导出结算表 [{batch_id}]")
    print(f"输出文件: {output_path}")
    print()

    settlement = get_settlement(batch_id)
    if not settlement:
        print("✗ 结算批次不存在，请先试算并确认")
        return 1

    try:
        result = export_settlement_to_csv(batch_id, output_path)
        print(f"✓ 导出成功: {result}")
        print()
        print("文件包含以下内容:")
        print("  1. 汇总数据（含处理前后对比）")
        print("  2. 班组汇总")
        print("  3. 工人明细")
        print("  4. 扣减明细（含处理前后数值）")
        print("  5. 异常警告")
    except Exception as e:
        print(f"✗ 导出失败: {e}")
        return 1

    print_separator()
    return 0


def cmd_list(args: argparse.Namespace) -> int:
    print_header("结算批次列表")
    settlements = list_settlements()

    if not settlements:
        print("暂无结算批次")
        print_separator()
        return 0

    print(
        f"{'批次号':<20} {'日期':<20} {'状态':<12} {'记录数':<8} {'实发金额':<15}"
    )
    print("-" * 75)
    for s in settlements:
        status = (
            "[已确认]"
            if s["status"] == "已确认"
            else "[草稿]"
            if s["status"] == "草稿"
            else f"[{s['status']}]"
        )
        print(
            f"{s['batch_id']:<20} {s['created_at']:<20} {status:<12} {s['valid_records']:<8} {s['net_amount']:<14.2f}元"
        )

    print_separator()
    return 0


def cmd_full(args: argparse.Namespace) -> int:
    """一键流程：导入 -> 试算 -> 确认 -> 导出"""
    print_header("一键结算流程")
    print()

    import_result = import_records(args.file)
    print(f"导入完成: {import_result['imported']}/{import_result['total']} 条记录")

    if import_result["imported"] == 0:
        print("✗ 没有成功导入任何记录，流程终止")
        return 1

    batch_id = generate_batch_id()
    print(f"生成批次号: {batch_id}")
    print()

    summary, _ = calculate_settlement(batch_id)

    if summary.valid_records == 0:
        print("⚠ 没有可结算的有效记录")
        if summary.warnings:
            for w in summary.warnings:
                print(f"  ! {w}")
        return 0

    print(f"试算结果:")
    print(f"  有效记录: {summary.valid_records}")
    print(f"  实发金额: {summary.net_amount:.2f}元")
    print()

    if summary.warnings:
        print("异常警告:")
        for w in summary.warnings:
            print(f"  ! {w}")
        print()

    if not args.yes:
        response = input("确认执行结算并导出？[y/N]: ").strip().lower()
        if response not in ["y", "yes"]:
            print("操作已取消")
            return 0

    print()
    confirm_settlement(batch_id)
    print("✓ 结算已确认")

    output_path = args.output or f"settlement_{batch_id}.csv"
    export_settlement_to_csv(batch_id, output_path)
    print(f"✓ 结算表已导出: {output_path}")

    print_separator()
    print("结算完成！批次号:", batch_id)
    print_separator()
    return 0


def main(argv: Optional[list] = None) -> int:
    parser = argparse.ArgumentParser(
        prog="orchard-settle",
        description="果园采摘工计件结算 CLI 工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例命令:
  # 1. 导入记录
  python -m orchard_settlement import records.csv

  # 2. 试算（不确认）
  python -m orchard_settlement trial
  python -m orchard_settlement trial --batch 20260510BATCH01

  # 3. 确认结算
  python -m orchard_settlement confirm 20260510BATCH01 --yes

  # 4. 导出结算表
  python -m orchard_settlement export 20260510BATCH01 settlement.csv

  # 一键流程
  python -m orchard_settlement full records.csv -o settlement.csv --yes

  # 查看历史结算
  python -m orchard_settlement list

数据字段 (CSV):
  worker_id, worker_name, team_id, team_name,
  pick_date, baskets, total_weight, bad_weight,
  reviewed, reviewer, review_time, advance_payment

业务规则:
  - 重复上报: 同一工人+日期+筐数+重量，系统自动去重
  - 坏果扣重 > 总重: 标记为无效，不参与结算
  - 未复核: 记录状态为待复核，不参与结算
  - 预支超额: 显示警告，实发保底为0
  - 确认后: 记录被标记，再次导入不会重复发薪
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    import_parser = subparsers.add_parser("import", help="导入采摘记录 CSV")
    import_parser.add_argument("file", help="CSV 文件路径")
    import_parser.set_defaults(func=cmd_import)

    trial_parser = subparsers.add_parser("trial", help="试算（不确认）")
    trial_parser.add_argument("--batch", help="指定批次号（可选）")
    trial_parser.set_defaults(func=cmd_trial)

    confirm_parser = subparsers.add_parser("confirm", help="确认结算")
    confirm_parser.add_argument("batch", help="试算时的批次号")
    confirm_parser.add_argument(
        "--yes", action="store_true", help="跳过确认提示"
    )
    confirm_parser.set_defaults(func=cmd_confirm)

    export_parser = subparsers.add_parser("export", help="导出结算表")
    export_parser.add_argument("batch", help="批次号")
    export_parser.add_argument("output", help="输出 CSV 路径")
    export_parser.set_defaults(func=cmd_export)

    list_parser = subparsers.add_parser("list", help="查看历史结算")
    list_parser.set_defaults(func=cmd_list)

    full_parser = subparsers.add_parser(
        "full", help="一键流程：导入->试算->确认->导出"
    )
    full_parser.add_argument("file", help="CSV 文件路径")
    full_parser.add_argument(
        "-o", "--output", help="输出文件路径（可选）"
    )
    full_parser.add_argument(
        "--yes", action="store_true", help="跳过所有确认提示"
    )
    full_parser.set_defaults(func=cmd_full)

    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        return 0

    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
