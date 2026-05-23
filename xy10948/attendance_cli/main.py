#!/usr/bin/env python3
import argparse
import csv
import json
import os
import sys
from datetime import datetime
from pathlib import Path

from .data_processor import AttendanceDataProcessor
from .report_generator import ReportGenerator


def parse_args():
    parser = argparse.ArgumentParser(
        description="培训签到补签 CLI - 合并签到机数据与老师补签表，检测冲突并生成结业资格报告",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  attendance --machine machine.csv --teacher teacher.csv --courses courses.csv --output ./results
  attendance --self-test
  attendance --summary --machine machine.csv --teacher teacher.csv
        """
    )

    parser.add_argument(
        "--machine", "-m",
        type=str,
        help="签到机导出的 CSV 文件路径"
    )

    parser.add_argument(
        "--teacher", "-t",
        type=str,
        help="老师补签表 CSV 文件路径"
    )

    parser.add_argument(
        "--courses", "-c",
        type=str,
        help="课程场次配置 CSV 文件路径"
    )

    parser.add_argument(
        "--output", "-o",
        type=str,
        default="./attendance_output",
        help="输出目录路径 (默认: ./attendance_output)"
    )

    parser.add_argument(
        "--attendance-rate",
        type=float,
        default=0.8,
        help="结业要求的最低出勤率 (默认: 0.8, 即 80%%)"
    )

    parser.add_argument(
        "--self-test",
        action="store_true",
        help="运行自检程序，验证工具功能"
    )

    parser.add_argument(
        "--summary",
        action="store_true",
        help="仅在终端显示摘要，不生成完整报告文件"
    )

    parser.add_argument(
        "--encoding",
        type=str,
        default="utf-8",
        help="输入文件编码 (默认: utf-8, 可选: gbk, gb2312)"
    )

    return parser.parse_args()


def validate_file(filepath, encoding, file_desc):
    if not filepath:
        print(f"错误: 必须提供 {file_desc} 路径", file=sys.stderr)
        return False

    path = Path(filepath)
    if not path.exists():
        print(f"错误: {file_desc} 文件不存在: {filepath}", file=sys.stderr)
        return False

    if not path.is_file():
        print(f"错误: {file_desc} 路径不是文件: {filepath}", file=sys.stderr)
        return False

    try:
        with open(path, 'r', encoding=encoding) as f:
            f.read(1024)
    except UnicodeDecodeError:
        print(f"错误: {file_desc} 编码错误，请尝试使用 --encoding gbk", file=sys.stderr)
        return False
    except Exception as e:
        print(f"错误: 无法读取 {file_desc}: {str(e)}", file=sys.stderr)
        return False

    return True


def validate_args(args):
    if args.self_test:
        return True

    if not args.machine or not args.teacher or not args.courses:
        print("错误: 非自检模式下必须提供 --machine、--teacher 和 --courses 参数", file=sys.stderr)
        return False

    if not validate_file(args.machine, args.encoding, "签到机数据"):
        return False
    if not validate_file(args.teacher, args.encoding, "补签表数据"):
        return False
    if not validate_file(args.courses, args.encoding, "课程场次配置"):
        return False

    if args.attendance_rate < 0 or args.attendance_rate > 1:
        print("错误: 出勤率必须在 0 到 1 之间", file=sys.stderr)
        return False

    output_path = Path(args.output)
    try:
        output_path.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        print(f"错误: 无法创建输出目录: {str(e)}", file=sys.stderr)
        return False

    return True


def run_self_test():
    print("=" * 60)
    print("运行培训签到补签 CLI 自检程序")
    print("=" * 60)

    from .self_test import run_all_tests
    success = run_all_tests()

    if success:
        print("\n✅ 所有自检通过！")
        return 0
    else:
        print("\n❌ 部分自检失败！")
        return 1


def main():
    args = parse_args()

    if not validate_args(args):
        sys.exit(1)

    if args.self_test:
        sys.exit(run_self_test())

    print(f"开始处理数据...")
    print(f"  签到机数据: {args.machine}")
    print(f"  补签表数据: {args.teacher}")
    print(f"  课程配置: {args.courses}")
    print(f"  输出目录: {args.output}")
    print(f"  结业出勤率要求: {args.attendance_rate * 100}%")

    processor = AttendanceDataProcessor(
        machine_file=args.machine,
        teacher_file=args.teacher,
        courses_file=args.courses,
        encoding=args.encoding,
        min_attendance_rate=args.attendance_rate
    )

    try:
        processor.process()
    except Exception as e:
        print(f"\n处理失败: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

    report_gen = ReportGenerator(processor, args.output)

    print("\n" + "=" * 60)
    print("处理摘要")
    print("=" * 60)
    report_gen.print_terminal_summary()

    if not args.summary:
        print(f"\n正在生成报告文件...")
        report_gen.generate_all_reports()
        print(f"报告已生成到: {args.output}")

    print("\n✅ 处理完成！")


if __name__ == "__main__":
    main()
