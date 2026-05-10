#!/usr/bin/env python3
"""
运行示例测试脚本
"""

import os
import sys
import shutil
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
EXAMPLES_DIR = os.path.join(BASE_DIR, "examples")


def run_cmd(cmd):
    """运行命令"""
    print(f"\n>>> {cmd}")
    print("-" * 70)
    return os.system(cmd)


def clean_data():
    """清理数据目录"""
    if os.path.exists(DATA_DIR):
        shutil.rmtree(DATA_DIR)
    print(f"已清理数据目录: {DATA_DIR}")


def test_case1_normal():
    """测试用例1: 正常巡检"""
    print("\n" + "=" * 70)
    print("测试用例1: 正常巡检 (2026-05-11)")
    print("=" * 70)

    case_dir = os.path.join(EXAMPLES_DIR, "case1_normal")

    run_cmd(f"python main.py import --type inspection --file {case_dir}/inspections.csv")
    run_cmd(f"python main.py import --type ups --file {case_dir}/ups_status.csv")
    run_cmd(f"python main.py import --type alarm --file {case_dir}/ac_alarms.csv")

    run_cmd("python main.py check --date 2026-05-11")
    run_cmd("python main.py review --date 2026-05-11 --reviewer 王主管")
    run_cmd("python main.py status --date 2026-05-11")

    output_file = os.path.join(BASE_DIR, "report_case1.txt")
    run_cmd(f"python main.py export --date 2026-05-11 --format txt --output {output_file}")


def test_case2_humidity():
    """测试用例2: 湿度超标"""
    print("\n" + "=" * 70)
    print("测试用例2: 湿度超标 (2026-05-12)")
    print("=" * 70)

    case_dir = os.path.join(EXAMPLES_DIR, "case2_humidity_exceed")

    run_cmd(f"python main.py import --type inspection --file {case_dir}/inspections.csv")
    run_cmd(f"python main.py import --type ups --file {case_dir}/ups_status.csv")

    run_cmd("python main.py check --date 2026-05-12")
    run_cmd("python main.py risks --date 2026-05-12")
    run_cmd("python main.py review --date 2026-05-12 --reviewer 李主管 --status 有异常 --notes 湿度超标，需检查空调除湿功能")
    run_cmd("python main.py status --date 2026-05-12")


def test_case3_ups():
    """测试用例3: UPS异常"""
    print("\n" + "=" * 70)
    print("测试用例3: UPS异常 (2026-05-13)")
    print("=" * 70)

    case_dir = os.path.join(EXAMPLES_DIR, "case3_ups_abnormal")

    run_cmd(f"python main.py import --type inspection --file {case_dir}/inspections.csv")
    run_cmd(f"python main.py import --type ups --file {case_dir}/ups_status.csv")

    run_cmd("python main.py check --date 2026-05-13")
    run_cmd("python main.py risks --date 2026-05-13")
    run_cmd("python main.py status --date 2026-05-13")

    output_file = os.path.join(BASE_DIR, "report_case3.json")
    run_cmd(f"python main.py export --date 2026-05-13 --format json --output {output_file}")


def test_case4_missing_review():
    """测试用例4: 缺少复核 + 空调告警未处理"""
    print("\n" + "=" * 70)
    print("测试用例4: 缺少复核 + 空调告警未处理 (2026-05-14)")
    print("=" * 70)

    case_dir = os.path.join(EXAMPLES_DIR, "case4_missing_review")

    run_cmd(f"python main.py import --type inspection --file {case_dir}/inspections.csv")
    run_cmd(f"python main.py import --type ups --file {case_dir}/ups_status.csv")
    run_cmd(f"python main.py import --type alarm --file {case_dir}/ac_alarms.csv")

    run_cmd("python main.py check --date 2026-05-14")
    run_cmd("python main.py status --date 2026-05-14")

    print("\n[验证] 此时应该看到'MISSING_REVIEW'风险（未执行review）")
    run_cmd("python main.py risks --date 2026-05-14")

    print("\n[补录复核] 现在执行复核...")
    run_cmd("python main.py review --date 2026-05-14 --reviewer 赵主管 --status 有异常 --notes 存在未处理的空调告警，需优先处理")

    print("\n[再次检查] 复核后...")
    run_cmd("python main.py check --date 2026-05-14")
    run_cmd("python main.py status --date 2026-05-14")


def test_case5_unit_error():
    """测试用例5: 单位错误"""
    print("\n" + "=" * 70)
    print("测试用例5: 温湿度单位错误 (2026-05-15)")
    print("=" * 70)

    case_dir = os.path.join(EXAMPLES_DIR, "case5_unit_error")

    run_cmd(f"python main.py import --type inspection --file {case_dir}/inspections.csv")

    run_cmd("python main.py check --date 2026-05-15")
    run_cmd("python main.py risks --date 2026-05-15")
    run_cmd("python main.py status --date 2026-05-15")


def test_update_duplicate():
    """测试重复导入更新"""
    print("\n" + "=" * 70)
    print("测试: 重复导入同一巡检时间应更新而非追加")
    print("=" * 70)

    case_dir = os.path.join(EXAMPLES_DIR, "case1_normal")

    print("\n[第一次导入]")
    run_cmd(f"python main.py import --type inspection --file {case_dir}/inspections.csv")

    print("\n[第二次导入同一文件（应更新，不增加记录数）]")
    run_cmd(f"python main.py import --type inspection --file {case_dir}/inspections.csv")


def test_merge_info():
    """测试补录合并信息"""
    print("\n" + "=" * 70)
    print("测试: 补录数据合并信息")
    print("=" * 70)

    run_cmd("python main.py merge-info --date 2026-05-11")


def main():
    """主函数"""
    print("=" * 70)
    print("机房巡检温湿度 CLI 工具 - 示例测试")
    print("=" * 70)

    clean_data()

    test_update_duplicate()
    test_case1_normal()
    test_case2_humidity()
    test_case3_ups()
    test_case4_missing_review()
    test_case5_unit_error()
    test_merge_info()

    print("\n" + "=" * 70)
    print("所有测试用例执行完成！")
    print("=" * 70)
    print(f"\n数据文件位置: {DATA_DIR}")
    print("生成的报告:")
    for f in os.listdir(BASE_DIR):
        if f.startswith("report_"):
            print(f"  - {os.path.join(BASE_DIR, f)}")


if __name__ == "__main__":
    main()
