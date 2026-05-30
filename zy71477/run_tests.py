#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
电场线检查工具 - 测试验证脚本
"""

import sys
import os
import json
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from efield_checker import EFieldChecker


def run_test(test_name, filepath, expected_issue_types=None):
    """运行单个测试用例"""
    print(f"\n{'='*70}")
    print(f"测试: {test_name}")
    print(f"文件: {filepath}")
    print("="*70)

    checker = EFieldChecker()
    report = checker.check_file(filepath)

    issue_types_found = set(i.issue_type.value for i in report.issues)
    errors = [i for i in report.issues if i.severity == "error"]
    warnings = [i for i in report.issues if i.severity == "warning"]

    print(f"检查结果:")
    print(f"  电荷数: {report.total_charges_checked}")
    print(f"  电场线条数: {report.total_lines_checked}")
    print(f"  箭头数: {report.total_arrows_checked}")
    print(f"  问题总数: {len(report.issues)} (错误: {len(errors)}, 警告: {len(warnings)})")
    print(f"  问题类型: {sorted(issue_types_found)}")

    if expected_issue_types:
        expected_set = set(expected_issue_types)
        missing = expected_set - issue_types_found
        unexpected = issue_types_found - expected_set

        if missing:
            print(f"\n❌ 未检测到预期问题类型: {missing}")
        if unexpected:
            print(f"\n⚠️  检测到未预期的问题类型: {unexpected}")
        if not missing and not unexpected:
            print(f"\n✅ 问题类型检测符合预期")

    print(f"\n问题详情预览:")
    for issue in report.issues[:3]:
        print(f"  - [{issue.issue_type.value}] [{issue.severity}] {issue.description[:60]}...")
        if issue.source:
            print(f"    来源: {issue.source.source_file} | 原始内容: {issue.source.raw_content[:50]}...")
    if len(report.issues) > 3:
        print(f"  ... 还有 {len(report.issues) - 3} 个问题")

    return report


def main():
    test_data_dir = Path(__file__).parent / "test_data"

    tests = [
        (
            "正确偶极子电场线（无错误）",
            test_data_dir / "correct_dipole.json",
            [],
        ),
        (
            "方向颠倒（正负号反）",
            test_data_dir / "direction_reversed.json",
            ["direction_reversed"],
        ),
        (
            "线条穿电荷",
            test_data_dir / "line_traverses_charge.json",
            ["line_traverses_charge", "direction_reversed"],
        ),
        (
            "密度误判（疏密）",
            test_data_dir / "density_misjudged.json",
            ["density_misjudged"],
        ),
        (
            "坏数据检测",
            test_data_dir / "bad_data.json",
            ["bad_data", "data_conflict", "density_misjudged"],
        ),
    ]

    print("电场线绘制检查工具 - 测试验证")
    print("="*70)

    results = []
    for test_name, filepath, expected in tests:
        if not filepath.exists():
            print(f"\n❌ 测试文件不存在: {filepath}")
            continue
        report = run_test(test_name, str(filepath), expected)
        results.append((test_name, report))

    print("\n" + "="*70)
    print("测试汇总")
    print("="*70)

    for test_name, report in results:
        error_count = len([i for i in report.issues if i.severity == "error"])
        warning_count = len([i for i in report.issues if i.severity == "warning"])
        status = "✅" if error_count == 0 and warning_count == 0 else "⚠️"
        if "direction" in test_name and error_count > 0:
            status = "✅"
        elif "traverses" in test_name and error_count > 0:
            status = "✅"
        elif "density" in test_name and len(report.issues) > 0:
            status = "✅"
        elif "bad" in test_name and len(report.issues) > 0:
            status = "✅"
        print(f"  {status} {test_name}: {error_count} 错误, {warning_count} 警告")

    print("\n" + "="*70)
    print("测试完成！")
    print("="*70)


if __name__ == "__main__":
    main()
