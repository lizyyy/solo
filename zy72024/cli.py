#!/usr/bin/env python3
import argparse
import sys
import os
from pathlib import Path

from models import Database
from importer import DataImporter
from reconciler import Reconciler
from reporter import Reporter


def main():
    parser = argparse.ArgumentParser(
        description="水电费预付余额对账工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 导入数据
  python cli.py import data/sample.csv
  
  # 导入数据，重复时更新
  python cli.py import data/sample.xlsx --on-duplicate update
  
  # 执行对账
  python cli.py reconcile
  
  # 指定期间对账
  python cli.py reconcile --period 2024-01
  
  # 添加备注
  python cli.py note 5 "此条为1月补录，经办人小周确认" --operator 小周
  
  # 查询记录溯源
  python cli.py trace 5
  
  # 查看对账历史批次
  python cli.py batches
  
  # 完整流程（导入 + 对账 + 导出）
  python cli.py full data/sample.csv
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    import_parser = subparsers.add_parser("import", help="导入数据文件")
    import_parser.add_argument("file", help="CSV或Excel文件路径")
    import_parser.add_argument(
        "--on-duplicate",
        choices=["skip", "update", "conflict"],
        default="skip",
        help="重复记录处理方式: skip(跳过,默认), update(更新), conflict(标记冲突)"
    )
    import_parser.add_argument("--no-export", action="store_true", help="不导出批次报告")

    reconcile_parser = subparsers.add_parser("reconcile", help="执行对账")
    reconcile_parser.add_argument("--period", help="对账期间, 如 2024-01")
    reconcile_parser.add_argument("--limit", type=int, default=30, help="显示明细条数")
    reconcile_parser.add_argument("--no-export", action="store_true", help="不导出报告")

    note_parser = subparsers.add_parser("note", help="给记录添加备注")
    note_parser.add_argument("record_id", type=int, help="记录ID")
    note_parser.add_argument("note_text", help="备注内容")
    note_parser.add_argument("--operator", default="operator", help="操作人")

    trace_parser = subparsers.add_parser("trace", help="查询记录溯源信息")
    trace_parser.add_argument("record_id", type=int, help="记录ID")

    subparsers.add_parser("batches", help="查看导入批次历史")

    subparsers.add_parser("conflicts", help="查看当前冲突记录")

    full_parser = subparsers.add_parser("full", help="完整流程: 导入->对账->导出")
    full_parser.add_argument("file", help="CSV或Excel文件路径")
    full_parser.add_argument(
        "--on-duplicate",
        choices=["skip", "update", "conflict"],
        default="skip",
        help="重复记录处理方式"
    )
    full_parser.add_argument("--period", help="对账期间")
    full_parser.add_argument("--operator", default="operator", help="操作人")

    subparsers.add_parser("reset", help="重置数据库(删除所有数据)")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    db = Database()
    importer = DataImporter(db)
    reconciler = Reconciler(db)
    reporter = Reporter()

    if args.command == "reset":
        confirm = input("确定要删除所有数据吗? 输入 YES 确认: ")
        if confirm == "YES":
            db.delete_database()
            print("✓ 数据库已重置")
        else:
            print("已取消")
        return

    if args.command == "import":
        if not Path(args.file).exists():
            print(f"✗ 文件不存在: {args.file}")
            sys.exit(1)

        result = importer.import_file(args.file, on_duplicate=args.on_duplicate)
        reporter.print_import_summary(result)

        if not args.no_export:
            batch_summary = db.get_import_summary(result['batch_id'])
            if batch_summary:
                reporter.export_import_batch_report(batch_summary, result['warnings'])

    elif args.command == "reconcile":
        before_reconcile = reconciler.reconcile(args.period)

        if not before_reconcile['success']:
            print(f"✗ {before_reconcile['error']}")
            sys.exit(1)

        reporter.print_reconciliation_summary(before_reconcile)
        reporter.print_running_balance(before_reconcile, limit=args.limit)

        monthly = reconciler.get_monthly_summary()
        reporter.print_monthly_summary(monthly)

        if not args.no_export:
            all_records = db.get_all_records(args.period)
            reporter.export_financial_detail(all_records, args.period)
            reporter.export_reconciliation_report(before_reconcile, monthly)

    elif args.command == "note":
        result = importer.add_note_to_record(args.record_id, args.note_text, args.operator)

        if not result['success']:
            print(f"✗ {result['error']}")
            sys.exit(1)

        print("\n" + "=" * 60)
        print("  备注已添加")
        print("-" * 60)
        print(f"  记录ID:     {result['record_id']}")
        print(f"  备注ID:     {result['note_id']}")
        print(f"  操作人:     {args.operator}")
        print(f"  备注内容:   {args.note_text}")
        print("-" * 60)
        print(f"  补录前余额: ¥{result['balance_before']:,.2f}")
        print(f"  补录后余额: ¥{result['balance_after']:,.2f}")
        print(f"  差异:       {'¥' + str(result['balance_diff']) if result['balance_diff'] != 0 else '无变化'}")
        print("=" * 60)

        if result['balance_diff'] != 0:
            print("\n  ⚠ 注意: 余额已发生变化，请重新执行对账")
            print("     python cli.py reconcile")

    elif args.command == "trace":
        trace = reconciler.get_record_trace(args.record_id)
        reporter.print_trace(trace)

    elif args.command == "batches":
        batches = db.get_import_summary()
        if not batches:
            print("暂无导入批次记录")
            return

        print("\n" + "=" * 90)
        print(f"  {'批次ID':<30} {'文件':<30} {'记录':>6} {'跳过':>6} {'更新':>6} {'冲突':>6} {'状态':<10}")
        print("-" * 90)

        for b in batches:
            status_icon = "✓" if b['status'] == 'completed' else "⏳"
            print(
                f"  {b['batch_id']:<30} {Path(b['source_file']).name:<30} "
                f"{b['total_records']:>6} {b['skipped']:>6} {b['updated']:>6} {b['conflicts']:>6} "
                f"{status_icon} {b['status']:<10}"
            )
        print("=" * 90)

    elif args.command == "conflicts":
        conflicts = db.get_conflicts()
        if not conflicts:
            print("✓ 当前没有冲突记录")
            return

        print("\n" + "=" * 90)
        print("  冲突记录列表")
        print("-" * 90)
        print(f"  {'ID':<6} {'日期':<12} {'类型':<8} {'金额':>12} {'经办人':<10} 冲突说明")
        print("-" * 90)

        type_map = {"prepay": "预付", "usage": "使用"}
        for c in conflicts:
            type_cn = type_map.get(c['trans_type'], c['trans_type'])
            print(
                f"  {c['id']:<6} {c['trans_date']:<12} {type_cn:<8} "
                f"¥{c['amount']:>10,.2f} {c.get('handler', ''):<10} {c['conflict_detail']}"
            )
            print(f"        来源: {c['source_file']}:{c['row_number']}")

        print("=" * 90)

    elif args.command == "full":
        if not Path(args.file).exists():
            print(f"✗ 文件不存在: {args.file}")
            sys.exit(1)

        print("\n" + "=" * 70)
        print("  水电费预付余额对账 - 完整流程")
        print("=" * 70)

        print("\n▶ 第1步: 导入数据")
        import_result = importer.import_file(args.file, on_duplicate=args.on_duplicate)
        reporter.print_import_summary(import_result)

        batch_summary = db.get_import_summary(import_result['batch_id'])
        if batch_summary:
            reporter.export_import_batch_report(batch_summary, import_result['warnings'])

        print("\n▶ 第2步: 执行对账")
        reconcile_result = reconciler.reconcile(args.period)

        if not reconcile_result['success']:
            print(f"✗ {reconcile_result['error']}")
            sys.exit(1)

        reporter.print_reconciliation_summary(reconcile_result)
        reporter.print_running_balance(reconcile_result, limit=50)

        monthly = reconciler.get_monthly_summary()
        reporter.print_monthly_summary(monthly)

        print("\n▶ 第3步: 导出报告")
        all_records = db.get_all_records(args.period)
        detail_path = reporter.export_financial_detail(all_records, args.period)
        report_path = reporter.export_reconciliation_report(reconcile_result, monthly)

        print("\n" + "=" * 70)
        print("  ✓ 对账完成")
        print("-" * 70)
        print(f"  期末余额: ¥{reconcile_result['final_balance']:,.2f}")
        print(f"  记录总数: {reconcile_result['total_records']}")
        print(f"  正常: {reconcile_result['matched']} | 警告: {reconcile_result['warnings']} | 冲突: {reconcile_result['conflicts']}")
        print("-" * 70)
        print(f"  财务明细: {detail_path}")
        print(f"  对账报告: {report_path}")
        print("=" * 70)


if __name__ == "__main__":
    main()
