#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
电场线绘制检查工具 - 命令行入口
"""

import argparse
import json
import sys
import os
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from efield_checker import EFieldChecker


def main():
    parser = argparse.ArgumentParser(
        description="电场线绘制检查工具 - 批量检查学生电场线图的方向、疏密和电荷符号"
    )

    parser.add_argument(
        "input",
        nargs="?",
        help="输入JSON文件路径，或包含JSON文件的目录路径",
    )

    parser.add_argument(
        "-o", "--output",
        help="输出报告文件路径（JSON格式），默认打印到控制台",
    )

    parser.add_argument(
        "-m", "--methodology",
        action="store_true",
        help="显示检查方法说明",
    )

    parser.add_argument(
        "--angle-threshold",
        type=float,
        default=90.0,
        help="方向偏差阈值（度），默认90°",
    )

    parser.add_argument(
        "--charge-radius",
        type=float,
        default=0.3,
        help="电荷半径阈值（单位长度），默认0.3",
    )

    parser.add_argument(
        "--sampling-distance",
        type=float,
        default=0.5,
        help="电场线采样间距（单位长度），默认0.5",
    )

    parser.add_argument(
        "--grid-spacing",
        type=float,
        default=1.0,
        help="密度分析网格间距（单位长度），默认1.0",
    )

    parser.add_argument(
        "--batch",
        action="store_true",
        help="批量处理目录下所有JSON文件",
    )

    args = parser.parse_args()

    checker = EFieldChecker(
        sampling_distance=args.sampling_distance,
        angle_threshold_degrees=args.angle_threshold,
        charge_radius=args.charge_radius,
        grid_spacing=args.grid_spacing,
    )

    if args.methodology:
        print(checker.get_methodology_explanation())
        return

    if not args.input:
        parser.print_help()
        return

    input_path = Path(args.input)

    if args.batch or input_path.is_dir():
        process_directory(checker, input_path, args.output)
    else:
        process_single_file(checker, input_path, args.output)


def process_single_file(checker: EFieldChecker, input_file: Path, output_path: str = None):
    print(f"\n正在检查: {input_file}")
    print("-" * 70)

    report = checker.check_file(str(input_file))

    if output_path:
        output_file = Path(output_path)
        if output_file.is_dir():
            output_file = output_file / f"{input_file.stem}_report.json"
        checker.save_report(report, str(output_file))
        print(f"报告已保存到: {output_file}")
    else:
        checker.print_report(report)

    return report


def process_directory(checker: EFieldChecker, input_dir: Path, output_dir: str = None):
    if not input_dir.is_dir():
        print(f"错误: {input_dir} 不是目录")
        return

    json_files = sorted(input_dir.glob("*.json"))

    if not json_files:
        print(f"目录 {input_dir} 中没有找到JSON文件")
        return

    print(f"找到 {len(json_files)} 个JSON文件待检查")
    print("=" * 70)

    all_reports = []
    for json_file in json_files:
        report = process_single_file(checker, json_file, output_dir)
        all_reports.append(report)
        print("\n" + "=" * 70 + "\n")

    if len(all_reports) > 1:
        print_batch_summary(all_reports)


def print_batch_summary(reports):
    print("\n" + "=" * 70)
    print("批量检查汇总")
    print("=" * 70)

    total_issues = 0
    issue_type_counts = {}

    for report in reports:
        total_issues += len(report.issues)
        for issue in report.issues:
            key = issue.issue_type.value
            issue_type_counts[key] = issue_type_counts.get(key, 0) + 1

    print(f"共检查 {len(reports)} 个文件")
    print(f"发现问题总数: {total_issues}")
    print()

    type_names = {
        "direction_reversed": "方向颠倒",
        "line_traverses_charge": "线条穿电荷",
        "density_misjudged": "密度误判",
        "bad_data": "坏数据",
        "data_conflict": "数据冲突",
    }

    for issue_type, count in sorted(issue_type_counts.items()):
        name = type_names.get(issue_type, issue_type)
        print(f"  {name}: {count} 个")

    files_with_errors = sum(
        1 for r in reports if any(i.severity == "error" for i in r.issues)
    )
    print(f"\n存在严重错误的文件: {files_with_errors}/{len(reports)}")


if __name__ == "__main__":
    main()
