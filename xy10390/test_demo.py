#!/usr/bin/env python3
"""
演示测试脚本 - 直接调用Python API
"""

import sys
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

import shutil
from datetime import datetime
from server_room_inspection.storage import DataStore
from server_room_inspection.importer import DataImporter
from server_room_inspection.checker import RiskChecker
from server_room_inspection.reporter import DailyReporter
from server_room_inspection.models import ReviewRecord


DATA_DIR = os.path.join(BASE_DIR, "data")
EXAMPLES_DIR = os.path.join(BASE_DIR, "examples")


def print_header(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_separator():
    print("-" * 70)


def clean_data():
    if os.path.exists(DATA_DIR):
        shutil.rmtree(DATA_DIR)
    print(f"已清理数据目录: {DATA_DIR}")


def test_case1_normal():
    """测试用例1: 正常巡检"""
    print_header("测试用例1: 正常巡检 (2026-05-11)")

    store = DataStore(DATA_DIR)
    importer = DataImporter(store)
    checker = RiskChecker(store)
    reporter = DailyReporter(store)

    case_dir = os.path.join(EXAMPLES_DIR, "case1_normal")

    results = importer.import_inspections(os.path.join(case_dir, "inspections.csv"))
    print(f"\n导入巡检数据: 新增={results['created']}, 更新={results['updated']}, 错误={results['errors']}")

    results = importer.import_ups_status(os.path.join(case_dir, "ups_status.csv"))
    print(f"导入UPS状态: 新增={results['created']}, 更新={results['updated']}, 错误={results['errors']}")

    results = importer.import_ac_alarms(os.path.join(case_dir, "ac_alarms.csv"))
    print(f"导入空调告警: 新增={results['created']}, 更新={results['updated']}, 错误={results['errors']}")

    check_result = checker.check_date("2026-05-11")
    print_separator()
    print(f"风险检查结果: 共发现 {check_result['total']} 项风险")
    print(f"  高危: {check_result['by_level']['high']}, 中危: {check_result['by_level']['medium']}, 低危: {check_result['by_level']['low']}")

    review = ReviewRecord(
        date="2026-05-11",
        reviewer="王主管",
        reviewed_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        status="通过",
        notes="数据正常，无异常"
    )
    store.save_review(review)
    print(f"\n复核完成: 复核人={review.reviewer}, 结果={review.status}")

    report = reporter.generate_report("2026-05-11")
    print_separator()
    print(f"日报状态: {report['status']}")

    output_file = os.path.join(BASE_DIR, "report_case1.txt")
    reporter.export_report("2026-05-11", output_file, "txt")
    print(f"报告已导出: {output_file}")


def test_case2_humidity():
    """测试用例2: 湿度超标"""
    print_header("测试用例2: 湿度超标 (2026-05-12)")

    store = DataStore(DATA_DIR)
    importer = DataImporter(store)
    checker = RiskChecker(store)
    reporter = DailyReporter(store)

    case_dir = os.path.join(EXAMPLES_DIR, "case2_humidity_exceed")

    importer.import_inspections(os.path.join(case_dir, "inspections.csv"))
    importer.import_ups_status(os.path.join(case_dir, "ups_status.csv"))

    check_result = checker.check_date("2026-05-12")
    print_separator()
    print(f"风险检查结果: 共发现 {check_result['total']} 项风险")

    if check_result['risks']:
        print_separator()
        print("风险详情:")
        for r in check_result['risks']:
            level_display = {"high": "高危", "medium": "中危", "low": "低危"}
            print(f"  [{level_display[r.level]}] {r.code}: {r.message}")
            print(f"      建议: {r.suggestion}")

    review = ReviewRecord(
        date="2026-05-12",
        reviewer="李主管",
        reviewed_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        status="有异常",
        notes="湿度超标，需检查空调除湿功能"
    )
    store.save_review(review)

    report = reporter.generate_report("2026-05-12")
    print_separator()
    print(f"日报状态: {report['status']}")


def test_case3_ups():
    """测试用例3: UPS异常"""
    print_header("测试用例3: UPS异常 (2026-05-13)")

    store = DataStore(DATA_DIR)
    importer = DataImporter(store)
    checker = RiskChecker(store)
    reporter = DailyReporter(store)

    case_dir = os.path.join(EXAMPLES_DIR, "case3_ups_abnormal")

    importer.import_inspections(os.path.join(case_dir, "inspections.csv"))
    importer.import_ups_status(os.path.join(case_dir, "ups_status.csv"))

    check_result = checker.check_date("2026-05-13")
    print_separator()
    print(f"风险检查结果: 共发现 {check_result['total']} 项风险")

    if check_result['risks']:
        print_separator()
        print("风险详情:")
        for r in check_result['risks']:
            level_display = {"high": "高危", "medium": "中危", "low": "低危"}
            print(f"  [{level_display[r.level]}] {r.code}: {r.message}")
            print(f"      建议: {r.suggestion}")

    output_file = os.path.join(BASE_DIR, "report_case3.json")
    reporter.export_report("2026-05-13", output_file, "json")
    print(f"\n报告已导出: {output_file}")


def test_case4_missing_review():
    """测试用例4: 缺少复核 + 空调告警未处理"""
    print_header("测试用例4: 缺少复核 + 空调告警未处理 (2026-05-14)")

    store = DataStore(DATA_DIR)
    importer = DataImporter(store)
    checker = RiskChecker(store)
    reporter = DailyReporter(store)

    case_dir = os.path.join(EXAMPLES_DIR, "case4_missing_review")

    importer.import_inspections(os.path.join(case_dir, "inspections.csv"))
    importer.import_ups_status(os.path.join(case_dir, "ups_status.csv"))
    importer.import_ac_alarms(os.path.join(case_dir, "ac_alarms.csv"))

    print("\n[首次检查 - 未执行复核]")
    check_result = checker.check_date("2026-05-14")
    print(f"风险检查结果: 共发现 {check_result['total']} 项风险")
    for r in check_result['risks']:
        level_display = {"high": "高危", "medium": "中危", "low": "低危"}
        print(f"  [{level_display[r.level]}] {r.code}: {r.message[:50]}...")

    print("\n[补录复核]")
    review = ReviewRecord(
        date="2026-05-14",
        reviewer="赵主管",
        reviewed_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        status="有异常",
        notes="存在未处理的空调告警，需优先处理"
    )
    store.save_review(review)
    print(f"  复核人: {review.reviewer}")
    print(f"  结果: {review.status}")

    print("\n[再次检查 - 复核后]")
    check_result2 = checker.check_date("2026-05-14")
    print(f"风险检查结果: 共发现 {check_result2['total']} 项风险")
    for r in check_result2['risks']:
        level_display = {"high": "高危", "medium": "中危", "low": "低危"}
        print(f"  [{level_display[r.level]}] {r.code}: {r.message[:50]}...")


def test_case5_unit_error():
    """测试用例5: 单位错误"""
    print_header("测试用例5: 温湿度单位错误 (2026-05-15)")

    store = DataStore(DATA_DIR)
    importer = DataImporter(store)
    checker = RiskChecker(store)
    reporter = DailyReporter(store)

    case_dir = os.path.join(EXAMPLES_DIR, "case5_unit_error")

    importer.import_inspections(os.path.join(case_dir, "inspections.csv"))

    check_result = checker.check_date("2026-05-15")
    print_separator()
    print(f"风险检查结果: 共发现 {check_result['total']} 项风险")

    if check_result['risks']:
        print_separator()
        print("风险详情:")
        for r in check_result['risks']:
            level_display = {"high": "高危", "medium": "中危", "low": "低危"}
            print(f"  [{level_display[r.level]}] {r.code}: {r.message}")
            print(f"      建议: {r.suggestion}")


def test_update_duplicate():
    """测试重复导入更新"""
    print_header("测试: 重复导入同一巡检时间应更新而非追加")

    store = DataStore(DATA_DIR)
    importer = DataImporter(store)

    case_dir = os.path.join(EXAMPLES_DIR, "case1_normal")

    print("\n[第一次导入]")
    results1 = importer.import_inspections(os.path.join(case_dir, "inspections.csv"))
    print(f"  新增: {results1['created']}, 更新: {results1['updated']}")

    print("\n[第二次导入同一文件（应更新，不增加记录数）]")
    results2 = importer.import_inspections(os.path.join(case_dir, "inspections.csv"))
    print(f"  新增: {results2['created']}, 更新: {results2['updated']}")
    print(f"\n  [验证] 第二次导入应该全部是更新(updated)而非新增(created)")


def test_merge_info():
    """测试补录合并信息"""
    print_header("测试: 补录数据合并信息")

    store = DataStore(DATA_DIR)
    importer = DataImporter(store)

    info = importer.get_merge_info("2026-05-11")

    print(f"\n日期: {info['date']}")
    print(f"巡检记录: {info['inspections']['count']} 条")
    print(f"UPS状态: {info['ups']['count']} 条")
    print(f"空调告警: {info['ac_alarms']['count']} 条")

    print_separator()
    print("合并规则说明:")
    print("  ✅ 允许改正 (当日记录):")
    print("     - 巡检数据录入错误（如温湿度数值、单位）")
    print("     - 漏录的正常巡检数据")
    print("     - 备注信息补充")
    print("  ❌ 必须退回 (历史记录):")
    print("     - 超过24小时的记录修改")
    print("     - 涉及风险判定的关键数据篡改")
    print("     - 已复核完成的数据修改（需主管审批）")


def main():
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
