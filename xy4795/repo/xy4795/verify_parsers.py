#!/usr/bin/env python3
"""验证解析器功能"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.pytest_parser import parse_pytest_xml
from app.services.coverage_parser import parse_coverage_xml
from app.services.flaky_parser import parse_flaky_log


def verify_pytest_parser():
    print("=" * 60)
    print("验证 pytest XML 解析器...")
    print("=" * 60)
    
    sample_file = os.path.join(os.path.dirname(__file__), 'sample_data', 'pytest_report.xml')
    with open(sample_file, 'r', encoding='utf-8') as f:
        xml_content = f.read()
    
    report = parse_pytest_xml(xml_content, 'test-report')
    
    print(f"报告名称: {report.report_name}")
    print(f"总测试数: {report.total_tests}")
    print(f"通过: {report.passed}")
    print(f"失败: {report.failed}")
    print(f"跳过: {report.skipped}")
    print(f"持续时间: {report.duration}s")
    print(f"测试用例数: {len(list(report.test_cases))}")
    
    print("\n测试用例详情:")
    for tc in report.test_cases:
        print(f"  - [{tc.status}] {tc.classname}::{tc.name} (模块: {tc.module})")
    
    print("\n✅ pytest 解析器验证通过!")
    return True


def verify_coverage_parser():
    print("\n" + "=" * 60)
    print("验证覆盖率 XML 解析器...")
    print("=" * 60)
    
    sample_file = os.path.join(os.path.dirname(__file__), 'sample_data', 'coverage.xml')
    with open(sample_file, 'r', encoding='utf-8') as f:
        xml_content = f.read()
    
    report = parse_coverage_xml(xml_content, 'coverage-report')
    
    print(f"报告名称: {report.report_name}")
    print(f"总行数: {report.total_lines}")
    print(f"已覆盖: {report.covered_lines}")
    print(f"未覆盖: {report.missed_lines}")
    print(f"行覆盖率: {report.line_coverage:.1f}%")
    print(f"分支覆盖率: {report.branch_coverage:.1f}%")
    print(f"文件数: {len(list(report.files))}")
    
    print("\n文件覆盖率详情:")
    for cf in report.files:
        print(f"  - {cf.file_path}: {cf.line_coverage:.1f}% (模块: {cf.module})")
        if cf.missed_lines > 0:
            missed = cf.get_missed_lines()
            print(f"    未覆盖行数: {cf.missed_lines}, 前10个: {missed[:10]}")
    
    print("\n✅ 覆盖率解析器验证通过!")
    return True


def verify_flaky_parser():
    print("\n" + "=" * 60)
    print("验证 flaky 日志解析器...")
    print("=" * 60)
    
    sample_file = os.path.join(os.path.dirname(__file__), 'sample_data', 'flaky_runs.log')
    with open(sample_file, 'r', encoding='utf-8') as f:
        log_content = f.read()
    
    flaky_runs = parse_flaky_log(log_content, 'CI-123')
    
    print(f"发现 flaky 测试数: {len(flaky_runs)}")
    
    print("\nFlaky 测试详情:")
    for fr in flaky_runs:
        print(f"  - {fr.test_name}")
        print(f"    运行次数: {fr.run_count}, 通过: {fr.pass_count}, 失败: {fr.fail_count}")
        print(f"    Flaky 率: {fr.flaky_rate:.1f}%")
        print(f"    首次状态: {fr.first_attempt_status}, 末次状态: {fr.last_attempt_status}")
        print(f"    重试次数: {fr.retry_count}")
        errors = fr.get_error_messages()
        if errors:
            print(f"    错误消息数: {len(errors)}")
            for i, err in enumerate(errors[:2]):
                print(f"      [{i+1}] {err[:100]}...")
    
    print("\n✅ Flaky 解析器验证通过!")
    return True


def main():
    print("开始验证解析器...\n")
    
    all_passed = True
    
    try:
        verify_pytest_parser()
    except Exception as e:
        print(f"\n❌ pytest 解析器验证失败: {e}")
        import traceback
        traceback.print_exc()
        all_passed = False
    
    try:
        verify_coverage_parser()
    except Exception as e:
        print(f"\n❌ 覆盖率解析器验证失败: {e}")
        import traceback
        traceback.print_exc()
        all_passed = False
    
    try:
        verify_flaky_parser()
    except Exception as e:
        print(f"\n❌ Flaky 解析器验证失败: {e}")
        import traceback
        traceback.print_exc()
        all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ 所有解析器验证通过!")
    else:
        print("❌ 部分解析器验证失败!")
    print("=" * 60)
    
    return 0 if all_passed else 1


if __name__ == '__main__':
    sys.exit(main())
