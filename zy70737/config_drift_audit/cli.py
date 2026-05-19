#!/usr/bin/env python3
import argparse
import sys
from datetime import datetime
from pathlib import Path

from . import __version__
from .parsers import ParserFactory
from .rules import RuleEngine
from .reports import ReportGenerator
from .utils import IdempotencyManager


def main():
    parser = argparse.ArgumentParser(
        description="配置漂移豁免到期复核排查工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 基本用法
  python -m config_drift_audit -c configs.csv -e exemptions.csv

  # 指定输出目录和报告前缀
  python -m config_drift_audit -c configs.xlsx -e exemptions.xlsx -o ./reports -p prod_audit

  # 指定检查日期
  python -m config_drift_audit -c configs.csv -e exemptions.csv -d 2024-12-31

  # 跳过重复检测
  python -m config_drift_audit -c configs.csv -e exemptions.csv --no-idempotency
        """,
    )

    parser.add_argument(
        "-c", "--configs",
        required=True,
        help="配置项文件路径 (CSV或Excel)",
    )
    parser.add_argument(
        "-e", "--exemptions",
        required=True,
        help="豁免记录文件路径 (CSV或Excel)",
    )
    parser.add_argument(
        "-o", "--output-dir",
        default=None,
        help="报告输出目录 (默认: ./audit_reports)",
    )
    parser.add_argument(
        "-p", "--prefix",
        default="drift_audit",
        help="报告文件名前缀 (默认: drift_audit)",
    )
    parser.add_argument(
        "-d", "--check-date",
        default=None,
        help="豁免到期检查日期 YYYY-MM-DD (默认: 今天)",
    )
    parser.add_argument(
        "--no-idempotency",
        action="store_true",
        help="跳过幂等性检查，强制重新运行",
    )
    parser.add_argument(
        "--clear-history",
        action="store_true",
        help="清除运行历史后退出",
    )
    parser.add_argument(
        "--list-runs",
        action="store_true",
        help="列出最近的运行记录后退出",
    )
    parser.add_argument(
        "-v", "--version",
        action="version",
        version=f"%(prog)s {__version__}",
    )

    args = parser.parse_args()

    idempotency_manager = IdempotencyManager()

    if args.clear_history:
        idempotency_manager.clear_history()
        print("运行历史已清除")
        sys.exit(0)

    if args.list_runs:
        runs = idempotency_manager.get_recent_runs()
        if not runs:
            print("暂无运行记录")
            sys.exit(0)
        print(f"最近 {len(runs)} 次运行:")
        for run in runs:
            print(f"  {run.timestamp} - ID: {run.run_id}, 漂移: {run.drift_count}, 坏行: {run.bad_rows_count}")
        sys.exit(0)

    for file_path in [args.configs, args.exemptions]:
        if not Path(file_path).exists():
            print(f"错误: 文件不存在 - {file_path}")
            sys.exit(1)

    print("正在解析配置项文件...")
    config_parser = ParserFactory.get_parser(args.configs)
    config_items = config_parser.parse_config_items(args.configs)
    print(f"  解析完成: {len(config_items.items)} 条配置项, {len(config_items.source_tracker.bad_rows)} 条坏行")

    print("正在解析豁免记录文件...")
    exemption_parser = ParserFactory.get_parser(args.exemptions)
    exemptions = exemption_parser.parse_exemptions(args.exemptions)
    print(f"  解析完成: {len(exemptions.items)} 条豁免, {len(exemptions.source_tracker.bad_rows)} 条坏行")

    config_items.items = idempotency_manager.deduplicate_config_items(config_items.items)
    exemptions.items = idempotency_manager.deduplicate_exemptions(exemptions.items)
    print(f"  去重后: {len(config_items.items)} 条配置项, {len(exemptions.items)} 条豁免")

    if not args.no_idempotency:
        is_duplicate, previous = idempotency_manager.is_duplicate_run(config_items, exemptions)
        if is_duplicate:
            print(f"警告: 检测到重复运行!")
            print(f"  上次运行时间: {previous.timestamp}")
            print(f"  上次运行ID: {previous.run_id}")
            response = input("是否继续运行? (y/N): ").strip().lower()
            if response != 'y':
                print("已取消")
                sys.exit(0)

    check_date = None
    if args.check_date:
        try:
            check_date = datetime.strptime(args.check_date, "%Y-%m-%d")
            print(f"使用检查日期: {args.check_date}")
        except ValueError:
            print(f"错误: 无效的日期格式 - {args.check_date}, 请使用 YYYY-MM-DD")
            sys.exit(1)

    print("正在执行规则引擎...")
    rule_engine = RuleEngine(check_date=check_date)
    engine_result = rule_engine.process(config_items, exemptions)
    audit_result = engine_result.audit_result

    print(f"  审计完成:")
    print(f"    总漂移记录: {audit_result.summary.drifted_records}")
    print(f"    已豁免记录: {audit_result.summary.exempted_records}")
    print(f"    豁免已过期: {audit_result.summary.expired_exemptions}")
    print(f"    待复核: {audit_result.summary.pending_review}")
    print(f"    无豁免: {audit_result.summary.no_exemption}")

    print("正在生成报告...")
    report_generator = ReportGenerator(output_dir=args.output_dir)
    result = report_generator.generate_all(audit_result, prefix=args.prefix)
    print(f"  {result}")

    if not args.no_idempotency:
        input_hash = idempotency_manager.compute_input_hash(config_items, exemptions)
        idempotency_manager.record_run(
            input_hash=input_hash,
            run_id=audit_result.run_id,
            config_items=config_items,
            exemptions=exemptions,
            audit_result=audit_result,
        )
        print(f"运行已记录: {audit_result.run_id}")

    print("\n审计完成!")
    if audit_result.summary.expired_exemptions > 0:
        print(f"警告: 发现 {audit_result.summary.expired_exemptions} 条豁免已过期，请及时清理!")


if __name__ == "__main__":
    main()
