#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

from .parsers.parser import DataParser
from .tracker.source_tracker import SourceTracker
from .rules.engine import RuleEngine, NotificationStatus
from .reports.generator import ReportGenerator, ReportFormat, ReportOptions


def print_summary(summary: dict):
    print("\n" + "=" * 60)
    print("处理汇总")
    print("=" * 60)
    print(f"总记录数: {summary['total']}")
    print(f"超时未确认: {summary['timeout_count']}")
    print(f"待确认: {summary['pending_count']}")
    print(f"已确认: {summary['confirmed_count']}")
    print(f"重复通知: {summary['duplicate_count']}")
    print(f"需补发: {summary['reissue_count']}")
    print(f"超时阈值: {summary['timeout_hours']}小时")
    print(f"订阅规则数: {summary['subscription_count']}")
    print()


def print_timeout_list(results: list):
    if not results:
        return
    
    print("=" * 60)
    print("超时未确认列表")
    print("=" * 60)
    for idx, result in enumerate(results, 1):
        record = result.tracked_record.record
        print(f"\n{idx}. {record.subscriber}")
        print(f"   接口: {record.api_path}")
        print(f"   批次: {record.batch_id}")
        print(f"   超时: {result.timeout_hours}小时")
        print(f"   来源: {result.tracked_record.source_location.to_string()}")
    print()


def print_reissue_list(results: list):
    if not results:
        return
    
    print("=" * 60)
    print("需补发列表")
    print("=" * 60)
    for idx, result in enumerate(results, 1):
        record = result.tracked_record.record
        print(f"\n{idx}. {record.subscriber}")
        print(f"   接口: {record.api_path}")
        print(f"   批次: {record.batch_id}")
        print(f"   原因: {result.reissue_reason}")
    print()


def print_errors(tracked_records: list):
    errors = [r for r in tracked_records if r.error is not None]
    if not errors:
        return
    
    print("=" * 60)
    print("解析错误")
    print("=" * 60)
    for idx, tracked in enumerate(errors, 1):
        error = tracked.error
        print(f"\n{idx}. {error.file_path}:{error.line_number}")
        print(f"   错误: {error.error_message}")
        print(f"   内容: {error.raw_content}")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="接口变更订阅确认超时排查工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s data/notifications.csv
  %(prog)s data/*.csv -s "order-*:/api/order/*" -t 48
  %(prog)s data/*.json -o report.csv -f csv
  %(prog)s data/*.csv --group-by subscriber
        """
    )
    
    parser.add_argument(
        "files",
        nargs="+",
        help="输入文件路径，支持CSV、JSON、TXT格式"
    )
    
    parser.add_argument(
        "-s", "--subscribe",
        action="append",
        help="订阅规则，格式: 订阅方模式:接口路径模式，如 order-*:/api/order/*"
    )
    
    parser.add_argument(
        "-t", "--timeout",
        type=int,
        default=24,
        help="超时阈值（小时），默认: 24"
    )
    
    parser.add_argument(
        "-o", "--output",
        help="输出报告路径"
    )
    
    parser.add_argument(
        "-f", "--format",
        choices=["json", "csv", "text"],
        default="json",
        help="输出报告格式，默认: json"
    )
    
    parser.add_argument(
        "--group-by",
        choices=["subscriber", "batch"],
        help="按订阅方或批次分组输出"
    )
    
    parser.add_argument(
        "--show-timeout",
        action="store_true",
        help="在控制台显示超时列表"
    )
    
    parser.add_argument(
        "--show-reissue",
        action="store_true",
        help="在控制台显示补发列表"
    )
    
    parser.add_argument(
        "--show-errors",
        action="store_true",
        help="在控制台显示解析错误"
    )
    
    parser.add_argument(
        "--no-summary",
        action="store_true",
        help="不显示汇总信息"
    )
    
    parser.add_argument(
        "--subscriber-report",
        help="生成指定订阅方的专属报告"
    )
    
    args = parser.parse_args()

    data_parser = DataParser()
    
    all_records = []
    all_errors = []
    
    for file_pattern in args.files:
        path = Path(file_pattern)
        if path.is_dir():
            for file_path in path.glob("*"):
                if file_path.suffix.lower() in ['.csv', '.json', '.txt', '.log']:
                    records, errors = data_parser.parse_file(file_path)
                    all_records.extend(records)
                    all_errors.extend(errors)
        else:
            parent = Path(file_pattern).parent
            pattern = Path(file_pattern).name
            for file_path in parent.glob(pattern):
                if file_path.is_file():
                    records, errors = data_parser.parse_file(file_path)
                    all_records.extend(records)
                    all_errors.extend(errors)
    
    tracker = SourceTracker()
    tracked_records = tracker.track(all_records, all_errors)
    
    rule_engine = RuleEngine(timeout_hours=args.timeout)
    
    if args.subscribe:
        for sub in args.subscribe:
            rule_engine.add_subscription(sub)
    
    match_results = rule_engine.process(tracked_records)
    
    summary = rule_engine.get_summary()
    
    if not args.no_summary:
        print_summary(summary)
    
    if args.show_timeout:
        print_timeout_list(rule_engine.get_timeout_records())
    
    if args.show_reissue:
        print_reissue_list(rule_engine.get_reissue_candidates())
    
    if args.show_errors:
        print_errors(tracked_records)
    
    if args.output:
        report_options = ReportOptions(
            group_by=args.group_by,
            pretty_print=True
        )
        generator = ReportGenerator(report_options)
        
        format_map = {
            "json": ReportFormat.JSON,
            "csv": ReportFormat.CSV,
            "text": ReportFormat.TEXT
        }
        
        output_path = generator.generate(
            match_results=match_results,
            tracked_records=tracked_records,
            summary=summary,
            output_path=args.output,
            format=format_map[args.format]
        )
        print(f"报告已生成: {output_path}")
    
    if args.subscriber_report:
        generator = ReportGenerator()
        subscriber_output = f"subscriber_{args.subscriber_report}.txt"
        if args.output:
            subscriber_output = str(Path(args.output).parent / f"subscriber_{args.subscriber_report}.txt")
        
        output_path = generator.generate_subscriber_report(
            match_results=match_results,
            subscriber=args.subscriber_report,
            output_path=subscriber_output
        )
        print(f"订阅方报告已生成: {output_path}")


if __name__ == "__main__":
    main()
