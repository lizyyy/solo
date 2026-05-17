#!/usr/bin/env python3
"""
团体锁座换座超时释放排查工具
命令行入口
"""
import argparse
import sys
import json
from pathlib import Path
from datetime import datetime

from seatlock.parser import DataParser
from seatlock.rules import SeatLockRuleEngine
from seatlock.reporter import ReportGenerator
from seatlock.run_state import RunStateManager


def print_banner():
    banner = """
╔══════════════════════════════════════════════════════════════╗
║           团体锁座换座超时释放排查 CLI 工具                    ║
║           SeatLock Group Reservation Troubleshooter           ║
╚══════════════════════════════════════════════════════════════╝
"""
    print(banner)


def cmd_check(args):
    """执行锁座检查命令"""
    print_banner()
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 开始执行锁座检查...\n")
    
    input_files = []
    for f in args.files or []:
        path = Path(f)
        if path.exists():
            input_files.append(str(path))
    
    if args.dir:
        dir_path = Path(args.dir)
        if dir_path.exists():
            for pattern in ["*show*.csv", "*seat*.csv", "*order*.csv", "*window*.csv", "*lock*.csv", "*change*.csv"]:
                input_files.extend([str(p) for p in dir_path.glob(pattern)])
    
    if not input_files:
        print("❌ 错误: 未找到任何输入文件，请指定 --files 或 --dir")
        sys.exit(1)
    
    input_files = sorted(set(input_files))
    print(f"📁 发现 {len(input_files)} 个输入文件:")
    for f in input_files:
        print(f"   - {f}")
    print()
    
    state_mgr = RunStateManager(args.state_dir)
    
    if not args.force:
        existing_run = state_mgr.find_idempotent_run(input_files)
        if existing_run:
            print(f"⏭️  发现幂等运行记录 (RunID: {existing_run.run_id})")
            print(f"   执行时间: {existing_run.started_at.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"   处理记录: {existing_run.records_processed}, 跳过: {existing_run.records_skipped}, 发现问题: {existing_run.issues_found}")
            print()
    
    state_mgr.start_new_run(input_files)
    
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 正在解析数据文件...")
    parser = DataParser()
    for f in input_files:
        fname = Path(f).name.lower()
        if "show" in fname:
            parser.parse_csv_file(f, "shows")
        elif "seat" in fname:
            parser.parse_csv_file(f, "seats")
        elif "order" in fname:
            parser.parse_csv_file(f, "orders")
        elif "window" in fname:
            parser.parse_csv_file(f, "windows")
        elif "lock" in fname:
            parser.parse_csv_file(f, "locks")
        elif "change" in fname:
            parser.parse_csv_file(f, "changes")
    
    summary = parser.get_parse_summary()
    total_records = sum(summary[k] for k in summary if k.endswith("_parsed"))
    state_mgr.update_progress(
        records_processed=total_records,
        records_skipped=summary["bad_records_count"]
    )
    
    print(f"   ✓ 演出场次: {summary['shows_parsed']}")
    print(f"   ✓ 座位数据: {summary['seats_parsed']}")
    print(f"   ✓ 团体订单: {summary['orders_parsed']}")
    print(f"   ✓ 保留窗口: {summary['windows_parsed']}")
    print(f"   ✓ 锁座记录: {summary['locks_parsed']}")
    print(f"   ✓ 换座申请: {summary['changes_parsed']}")
    print(f"   ✗ 解析失败: {summary['bad_records_count']} 条")
    print()
    
    if summary["bad_records_count"] > 0 and args.show_bad:
        print("=" * 60)
        print("【解析失败记录详情】")
        print("=" * 60)
        for br in summary["bad_records"]:
            print(f"\n📍 {br['source_trace']['source_file']}:{br['source_trace']['line_number']}")
            print(f"   错误类型: {br['error_type']}")
            print(f"   错误信息: {br['error_message']}")
        print()
    
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 正在执行规则检查...")
    engine = SeatLockRuleEngine()
    for show in parser.shows:
        engine.add_show(show)
    for seat in parser.seats:
        engine.add_seat(seat)
    for order in parser.orders:
        engine.add_order(order)
    for window in parser.windows:
        engine.add_window(window)
    for lock in parser.locks:
        engine.add_lock(lock)
    for change in parser.changes:
        engine.add_change(change)
    
    issues = engine.run_all_checks()
    state_mgr.update_progress(issues_found=len(issues))
    
    print(f"   ✓ 超时未释放检查: 发现 {len([i for i in issues if i.issue_type.value == 'TIMEOUT_UNRELEASED'])} 个")
    print(f"   ✓ 座位冲突检查: 发现 {len([i for i in issues if i.issue_type.value == 'SEAT_CONFLICT'])} 个")
    print(f"   ✓ 保留窗口重叠检查: 发现 {len([i for i in issues if i.issue_type.value == 'OVERLAPPING_WINDOW'])} 个")
    print(f"   ✓ 无效换座检查: 发现 {len([i for i in issues if i.issue_type.value == 'INVALID_CHANGE'])} 个")
    print(f"   ✓ 团体票数量不匹配检查: 发现 {len([i for i in issues if i.issue_type.value == 'GROUP_MISMATCH'])} 个")
    print()
    
    reporter = ReportGenerator(engine)
    
    output_formats = args.format.split(",") if args.format else ["text"]
    
    if args.output:
        for fmt in output_formats:
            if fmt == "csv":
                output_dir = Path(args.output).parent if args.output else "./reports"
                files = reporter.generate_csv_report(str(output_dir))
                print(f"📄 CSV报告已生成:")
                for name, f in files.items():
                    print(f"   - {name}: {f}")
            else:
                output_file = args.output.replace("{format}", fmt)
                reporter.save_report(output_file, fmt)
                print(f"📄 {fmt.upper()}报告已生成: {output_file}")
    else:
        print(reporter.generate_text_report())
    
    state_mgr.complete_run(success=True)
    print(f"\n✅ 检查完成! RunID: {state_mgr.current_run.run_id}")


def cmd_history(args):
    """查看历史运行记录"""
    state_mgr = RunStateManager(args.state_dir)
    history = state_mgr.get_run_history(limit=args.limit)
    
    print("=" * 80)
    print("历史运行记录")
    print("=" * 80)
    
    if not history:
        print("\n暂无历史运行记录\n")
        return
    
    for i, run in enumerate(history, 1):
        status_icon = "✅" if run["status"] == "COMPLETED" else "❌"
        print(f"\n{i}. RunID: {run['run_id']} {status_icon}")
        print(f"   开始时间: {run['started_at'][:19]}")
        if run.get("completed_at"):
            print(f"   完成时间: {run['completed_at'][:19]}")
        print(f"   处理文件: {len(run.get('input_files', []))} 个")
        print(f"   处理记录: {run.get('records_processed', 0)}")
        print(f"   发现问题: {run.get('issues_found', 0)}")
        if run.get("error_message"):
            print(f"   错误信息: {run['error_message']}")
    print()


def cmd_parse(args):
    """仅解析数据文件"""
    print_banner()
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 开始解析数据文件...\n")
    
    parser = DataParser()
    for f in args.files:
        fname = Path(f).name.lower()
        if "show" in fname:
            parser.parse_csv_file(f, "shows")
        elif "seat" in fname:
            parser.parse_csv_file(f, "seats")
        elif "order" in fname:
            parser.parse_csv_file(f, "orders")
        elif "window" in fname:
            parser.parse_csv_file(f, "windows")
        elif "lock" in fname:
            parser.parse_csv_file(f, "locks")
        elif "change" in fname:
            parser.parse_csv_file(f, "changes")
    
    summary = parser.get_parse_summary()
    
    print(f"📊 解析结果汇总:")
    print(f"   演出场次: {summary['shows_parsed']}")
    print(f"   座位数据: {summary['seats_parsed']}")
    print(f"   团体订单: {summary['orders_parsed']}")
    print(f"   保留窗口: {summary['windows_parsed']}")
    print(f"   锁座记录: {summary['locks_parsed']}")
    print(f"   换座申请: {summary['changes_parsed']}")
    print(f"   解析失败: {summary['bad_records_count']} 条\n")
    
    if summary["bad_records_count"] > 0:
        print("=" * 60)
        print("【解析失败记录】")
        print("=" * 60)
        for br in summary["bad_records"]:
            print(f"\n{br['source_trace']['source_file']}:{br['source_trace']['line_number']}")
            print(f"  错误: {br['error_type']} - {br['error_message']}")
        print()


def main():
    parser = argparse.ArgumentParser(
        description="团体锁座换座超时释放排查工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s check --dir ./data --output report.txt
  %(prog)s check --files shows.csv seats.csv locks.csv --format json
  %(prog)s history --limit 5
  %(prog)s parse --files data/*shows.csv data/*locks.csv
        """
    )
    
    parser.add_argument("--state-dir", default="./run_state", help="运行状态保存目录")
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    check_parser = subparsers.add_parser("check", help="执行锁座检查")
    check_parser.add_argument("--dir", "-d", help="数据文件目录")
    check_parser.add_argument("--files", "-f", nargs="+", help="指定数据文件列表")
    check_parser.add_argument("--output", "-o", help="输出文件路径")
    check_parser.add_argument("--format", default="text", help="输出格式: text,json,csv (可多选逗号分隔)")
    check_parser.add_argument("--force", action="store_true", help="强制重新运行(跳过幂等检查)")
    check_parser.add_argument("--show-bad", action="store_true", help="显示解析失败记录详情")
    
    history_parser = subparsers.add_parser("history", help="查看历史运行记录")
    history_parser.add_argument("--limit", "-n", type=int, default=10, help="显示最近N条记录")
    
    parse_parser = subparsers.add_parser("parse", help="仅解析数据文件")
    parse_parser.add_argument("--files", "-f", nargs="+", required=True, help="指定数据文件列表")
    
    args = parser.parse_args()
    
    if args.command == "check":
        cmd_check(args)
    elif args.command == "history":
        cmd_history(args)
    elif args.command == "parse":
        cmd_parse(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
