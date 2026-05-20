#!/usr/bin/env python3
"""测试报告生成功能"""

import sys
sys.path.insert(0, '.')

from datetime import date
from services.reconciliation_service import reconciliation_engine
from services.report_service import report_generator
from models.report import ReportType, ReportFormat


def test_report_generation():
    print("测试报告生成功能...")

    result = reconciliation_engine.run_reconciliation(
        name="2024年1月对账",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 31)
    )

    print(f"对账任务ID: {result.id}")

    print("\n1. 生成汇总Excel报告...")
    report = report_generator.generate_report(
        reconciliation_id=result.id,
        report_type=ReportType.SUMMARY,
        report_format=ReportFormat.EXCEL,
        generated_by="测试用户"
    )
    print(f"报告标题: {report.title}")
    print(f"文件路径: {report.file_path}")
    print(f"文件大小: {report.file_size} bytes")

    print("\n2. 生成明细CSV报告...")
    report = report_generator.generate_report(
        reconciliation_id=result.id,
        report_type=ReportType.DETAIL,
        report_format=ReportFormat.CSV,
        generated_by="测试用户"
    )
    print(f"报告标题: {report.title}")
    print(f"文件路径: {report.file_path}")

    print("\n3. 生成差异报告...")
    report = report_generator.generate_report(
        reconciliation_id=result.id,
        report_type=ReportType.DISCREPANCY,
        report_format=ReportFormat.EXCEL,
        generated_by="测试用户"
    )
    print(f"报告标题: {report.title}")

    print("\n4. 生成召回专项报告...")
    report = report_generator.generate_report(
        reconciliation_id=result.id,
        report_type=ReportType.RECALL,
        report_format=ReportFormat.EXCEL,
        generated_by="测试用户"
    )
    print(f"报告标题: {report.title}")

    print("\n5. 生成效期专项报告...")
    report = report_generator.generate_report(
        reconciliation_id=result.id,
        report_type=ReportType.EXPIRY,
        report_format=ReportFormat.EXCEL,
        generated_by="测试用户"
    )
    print(f"报告标题: {report.title}")

    print("\n报告统计:")
    for key, value in report.statistics.items():
        print(f"  {key}: {value}")


if __name__ == '__main__':
    print("=" * 50)
    print("报告生成测试")
    print("=" * 50)

    test_report_generation()

    print("\n" + "=" * 50)
    print("报告测试完成!")
    print("=" * 50)
