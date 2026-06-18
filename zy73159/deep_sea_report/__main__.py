#!/usr/bin/env python3
"""深海采样报告汇总 - 命令行入口.

使用方式:
    python -m deep_sea_report --input <输入目录> --output <输出目录>
"""

import argparse
import os
import sys

from .parser import parse_directory
from .classifier import classify_records
from .persistence import (
    load_previous_state,
    merge_with_previous_state,
    save_state,
    export_raw_records,
)
from .report import print_terminal_summary, write_screenshot_notes, write_summary_csv


def main():
    parser = argparse.ArgumentParser(
        description="深海采样报告汇总工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python -m deep_sea_report --input ./input --output ./output
  python -m deep_sea_report -i ./records -o ./result
        """,
    )

    parser.add_argument(
        "--input", "-i",
        required=True,
        help="输入目录，包含船上记录本文件 (CSV/TXT/TSV格式)",
    )
    parser.add_argument(
        "--output", "-o",
        required=True,
        help="输出目录，汇总结果将保存到这里",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="重置状态，不保留之前的备注和截图说明",
    )

    args = parser.parse_args()

    input_dir = os.path.abspath(args.input)
    output_dir = os.path.abspath(args.output)

    if not os.path.isdir(input_dir):
        print(f"错误: 输入目录不存在: {input_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"正在读取输入目录: {input_dir}")
    records = parse_directory(input_dir)
    print(f"共解析到 {len(records)} 条记录")

    if not args.reset:
        previous_state = load_previous_state(output_dir)
        if previous_state:
            print(f"检测到历史状态，保留旧备注和截图说明...")
            records = merge_with_previous_state(records, previous_state)

    classify_records(records)

    print()
    print_terminal_summary(records, input_dir, output_dir)

    os.makedirs(output_dir, exist_ok=True)
    write_summary_csv(output_dir, records)
    write_screenshot_notes(output_dir, records)
    export_raw_records(output_dir, records)
    save_state(output_dir, records, metadata={"input_dir": input_dir})

    print(f"✓ 汇总完成，结果已保存到: {output_dir}")
    print()
    print("下一步:")
    print("  1. 打开 summary_report.csv 查看汇总表")
    print("  2. 打开 screenshot_notes.txt 查看截图说明（复核用）")
    print("  3. 查看 raw_records_with_issues.json 查看带原始数据的完整记录")
    print()


if __name__ == "__main__":
    main()
