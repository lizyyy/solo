#!/usr/bin/env python3
import argparse
import os
import sys
from pathlib import Path

from .constants import ExitCode
from .parser import LogParser
from .validator import OverspendValidator, DelayValidator
from .aggregator import DataAggregator
from .reporter import ReportGenerator


class AdOverspendChecker:
    def __init__(self, output_dir: str = "./reports"):
        self.parser = LogParser()
        self.overspend_validator = OverspendValidator()
        self.delay_validator = DelayValidator()
        self.aggregator = DataAggregator()
        self.reporter = ReportGenerator(output_dir=output_dir)

    def run(self, input_path: str) -> ExitCode:
        try:
            if os.path.isdir(input_path):
                all_records, parse_warnings = self.parser.parse_directory(input_path)
            elif os.path.isfile(input_path):
                all_records, parse_warnings = self.parser.parse_file(input_path)
            else:
                print(f"错误: 输入路径不存在: {input_path}", file=sys.stderr)
                return ExitCode.FILE_NOT_FOUND

            if not all_records:
                print("警告: 未解析到任何有效记录", file=sys.stderr)
                return ExitCode.NO_DATA

            normal_records, overspend_records = self.overspend_validator.validate(all_records)

            final_normal, delay_records, processing_issues = self.delay_validator.validate(
                normal_records
            )

            special_cases = self.delay_validator.check_special_cases(all_records)
            processing_issues.extend(special_cases)

            summary = self.aggregator.aggregate_all(
                final_normal,
                overspend_records,
                delay_records,
                processing_issues,
                parse_warnings,
            )

            overspend_details = self.aggregator.export_details(overspend_records, "overspend")
            delay_details = self.aggregator.export_details(delay_records, "delay")

            if parse_warnings or processing_issues:
                exit_code = ExitCode.PARTIAL_SUCCESS
            else:
                exit_code = ExitCode.SUCCESS

            self.reporter.generate_all_reports(
                summary, overspend_details, delay_details, exit_code
            )
            self.reporter.generate_text_report(summary)

            return exit_code

        except Exception as e:
            print(f"运行错误: {str(e)}", file=sys.stderr)
            import traceback

            traceback.print_exc()
            return ExitCode.VALIDATION_ERROR


def main():
    parser = argparse.ArgumentParser(
        description="广告消耗日志超投计划筛查 - AD Overspend Checker",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python -m ad_overspend_checker.main examples/normal_data.csv
  python -m ad_overspend_checker.main --input examples/ --output ./my_reports
        """,
    )

    parser.add_argument(
        "input",
        nargs="?",
        help="输入文件或目录路径（支持CSV、JSON、JSONL格式）",
    )

    parser.add_argument(
        "--input",
        "-i",
        dest="input_path",
        help="输入文件或目录路径（与位置参数二选一）",
    )

    parser.add_argument(
        "--output",
        "-o",
        default="./reports",
        help="报告输出目录（默认: ./reports）",
    )

    parser.add_argument(
        "--version",
        "-v",
        action="version",
        version="广告消耗日志超投计划筛查 v1.0.0",
    )

    args = parser.parse_args()

    input_path = args.input_path or args.input

    if not input_path:
        parser.print_help()
        print("\n错误: 请提供输入文件或目录路径", file=sys.stderr)
        sys.exit(ExitCode.CONFIG_ERROR.value)

    checker = AdOverspendChecker(output_dir=args.output)
    exit_code = checker.run(input_path)
    sys.exit(exit_code.value)


if __name__ == "__main__":
    main()
