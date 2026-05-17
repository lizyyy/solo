#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path
from typing import List
from models import BookingInterval, ParseError
from csv_parser import CSVParser
from ics_parser import ICSParser
from interval_merger import IntervalMerger
from conflict_detector import ConflictDetector
from report_generator import ReportGenerator


class BookingConflictChecker:
    def __init__(self):
        self.csv_parser = CSVParser()
        self.ics_parser = ICSParser()
        self.merger = IntervalMerger()
        self.detector = ConflictDetector()
        self.reporter = ReportGenerator()

    def process_files(
        self, file_paths: List[str]
    ):
        all_intervals: List[BookingInterval] = []
        all_errors: List[ParseError] = []

        for file_path in file_paths:
            path = Path(file_path)
            if not path.exists():
                print(f"警告: 文件不存在: {file_path}", file=sys.stderr)
                continue

            if path.suffix.lower() == ".csv":
                intervals, errors = self.csv_parser.parse_file(str(path))
                all_intervals.extend(intervals)
                all_errors.extend(errors)
                print(f"解析CSV文件: {file_path}, 成功{len(intervals)}条, 失败{len(errors)}条")
            elif path.suffix.lower() in [".ics", ".ical"]:
                intervals, errors = self.ics_parser.parse_file(str(path))
                all_intervals.extend(intervals)
                all_errors.extend(errors)
                print(f"解析ICS文件: {file_path}, 成功{len(intervals)}条, 失败{len(errors)}条")
            else:
                print(f"警告: 不支持的文件格式: {file_path}", file=sys.stderr)

        if not all_intervals:
            print("错误: 未找到任何有效预订记录", file=sys.stderr)
            return None, None, None

        all_intervals_sorted = sorted(
            all_intervals, key=lambda x: (x.room_id, x.checkin_date, x.checkout_date)
        )

        merged_intervals = self.merger.merge_consecutive_intervals(all_intervals_sorted)

        print(f"原始记录: {len(all_intervals)} 条")
        print(f"合并后记录: {len(merged_intervals)} 条")

        conflicts = self.detector.detect_all_conflicts(merged_intervals)
        print(f"检测到冲突: {len(conflicts)} 处")

        return all_intervals_sorted, merged_intervals, conflicts, all_errors

    def run(
        self,
        input_files: List[str],
        output_text: str = None,
        output_json: str = None,
        show_calendar: bool = False,
    ):
        result = self.process_files(input_files)
        if result is None:
            return 1

        intervals, merged_intervals, conflicts, parse_errors = result

        if output_text:
            text_report = self.reporter.generate_text_report(
                intervals, merged_intervals, conflicts, parse_errors
            )
            self.reporter.save_report(text_report, output_text, "text")

        if output_json:
            json_report = self.reporter.generate_json_report(
                intervals, merged_intervals, conflicts, parse_errors
            )
            self.reporter.save_report(json_report, output_json, "json")

        if show_calendar:
            calendar_view = self.reporter.generate_room_calendar_view(merged_intervals)
            print("\n" + calendar_view)

        if not output_text and not output_json:
            text_report = self.reporter.generate_text_report(
                intervals, merged_intervals, conflicts, parse_errors
            )
            print("\n" + text_report)

        if conflicts:
            print(f"\n⚠️  发现 {len(conflicts)} 处冲突，请查看报告详情")
            return 2

        if parse_errors:
            print(f"\n⚠️  发现 {len(parse_errors)} 条解析错误，请检查原始文件")
            return 1

        print("\n✅ 检测完成，未发现冲突")
        return 0


def main():
    parser = argparse.ArgumentParser(
        description="房态日历连住区间锁房冲突检测CLI工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s airbnb.csv tujia.ics --output-text report.txt
  %(prog)s bookings/*.csv --output-json report.json
  %(prog)s calendar.ics --show-calendar
        """,
    )

    parser.add_argument(
        "input_files",
        nargs="+",
        help="输入文件路径 (支持CSV和ICS格式)",
    )

    parser.add_argument(
        "--output-text",
        "-t",
        help="输出文本报告路径",
    )

    parser.add_argument(
        "--output-json",
        "-j",
        help="输出JSON报告路径",
    )

    parser.add_argument(
        "--show-calendar",
        "-c",
        action="store_true",
        help="显示房间日历视图",
    )

    args = parser.parse_args()

    checker = BookingConflictChecker()
    sys.exit(
        checker.run(
            input_files=args.input_files,
            output_text=args.output_text,
            output_json=args.output_json,
            show_calendar=args.show_calendar,
        )
    )


if __name__ == "__main__":
    main()
