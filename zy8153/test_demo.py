#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""测试 Demo 脚本"""

import os
import sys
import glob

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from gnss_checker.validator import DataValidator
from gnss_checker.reporter import ReportGenerator


def main():
    print("=" * 60)
    print("  GNSS Checker Demo 测试")
    print("=" * 60)
    print()

    base_dir = os.path.dirname(os.path.abspath(__file__))
    demo_dir = os.path.join(base_dir, "demo")
    obs_dir = os.path.join(demo_dir, "obs")
    output_dir = os.path.join(demo_dir, "reports")

    validator = DataValidator()

    print("[1/5] 加载基站台账...")
    stations_csv = os.path.join(demo_dir, "stations.csv")
    if validator.load_station_csv(stations_csv):
        print(f"      ✓ 成功加载 {len(validator.stations)} 个基站")
    else:
        print("      ✗ 加载失败")
        return 1

    print()
    print("[2/5] 加载测段计划...")
    sessions_yaml = os.path.join(demo_dir, "sessions.yaml")
    if validator.load_session_yaml(sessions_yaml):
        print(f"      ✓ 成功加载 {len(validator.sessions)} 个测段计划")
    else:
        print("      ✗ 加载失败")
        return 1

    print()
    print("[3/5] 查找 RINEX 文件...")
    rinex_files = glob.glob(os.path.join(obs_dir, "*.??O"))
    print(f"      找到 {len(rinex_files)} 个 RINEX 文件:")
    for f in rinex_files:
        print(f"        - {os.path.basename(f)}")

    print()
    print("[4/5] 解析并验证 RINEX 文件...")
    results = validator.load_rinex_files(rinex_files)
    success_count = sum(1 for v in results.values() if v)
    print(f"      ✓ 成功解析 {success_count} 个文件")

    issues = validator.validate_all()
    print(f"      检测到 {len(issues)} 个问题")

    summary = validator.get_validation_summary()
    print()
    print("      验证摘要:")
    print(f"        - 基站总数: {summary['total_stations']}")
    print(f"        - 测段总数: {summary['total_sessions']}")
    print(f"        - RINEX 文件: {summary['total_rinex_files']}")
    print(f"        - 问题总数: {summary['total_issues']}")

    if summary['issues_by_severity']:
        print("        - 问题分布:")
        for severity, count in summary['issues_by_severity'].items():
            print(f"          * {severity}: {count}")

    print()
    print("[5/5] 生成报告...")

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    reporter = ReportGenerator(validator)
    reporter.set_output_dir(output_dir)

    outputs = reporter.generate_all()
    print("      ✓ 报告已生成:")
    for name, path in outputs.items():
        print(f"        - {os.path.basename(path)}")

    print()
    print("=" * 60)
    print("  测试完成!")
    print("=" * 60)
    print()

    print("问题详情预览:")
    for issue in issues[:10]:
        print(f"  [{issue.issue_id}] [{issue.severity.upper()}] {issue.station_name}: {issue.message}")

    if len(issues) > 10:
        print(f"  ... 另有 {len(issues) - 10} 个问题")

    print()
    print(f"报告目录: {output_dir}")
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
