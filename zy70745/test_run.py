#!/usr/bin/env python
"""快速测试脚本 - 验证项目基本功能"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from branch_protection_audit.parser import ParserFactory
from branch_protection_audit.rules import RuleEngine
from branch_protection_audit.reporter import ReportGenerator


def test_parser():
    print("=" * 60)
    print("测试 1: 数据解析模块")
    print("=" * 60)

    result = ParserFactory.parse_file("examples/sample_data.json")
    print(f"✓ 解析成功")
    print(f"  - 仓库: {len(result.repositories)} 个")
    print(f"  - 例外申请: {len(result.exceptions)} 个")
    print(f"  - 放开窗口: {len(result.windows)} 个")
    print(f"  - 恢复动作: {len(result.recoveries)} 个")
    print(f"  - 解析错误: {len(result.parse_errors)} 个")

    if result.parse_errors:
        for err in result.parse_errors:
            print(f"    错误: {err.get('message')}")

    return result


def test_rule_engine(parse_result):
    print("\n" + "=" * 60)
    print("测试 2: 规则引擎")
    print("=" * 60)

    rule_engine = RuleEngine()
    conclusion = rule_engine.run_all_rules(parse_result)

    print(f"✓ 规则引擎执行完成")
    print(f"  - 审计ID: {conclusion.audit_id}")
    print(f"  - 总记录数: {conclusion.total_records}")
    print(f"  - 通过: {conclusion.pass_count}")
    print(f"  - 警告: {conclusion.warn_count}")
    print(f"  - 失败: {conclusion.fail_count}")
    print(f"  - 跳过: {conclusion.skip_count}")

    print("\n审计记录验证结果:")
    for record in conclusion.records[:3]:
        print(f"  记录 {record.record_id}: {record.overall_status}")
        for validation in record.validations:
            print(f"    - [{validation.status}] {validation.rule_name}: {validation.message[:50]}...")

    return conclusion


def test_reporter(conclusion, parse_result):
    print("\n" + "=" * 60)
    print("测试 3: 报告生成模块")
    print("=" * 60)

    os.makedirs("test_output", exist_ok=True)

    reporter = ReportGenerator(conclusion, parse_result)

    reporter.generate_json_report("test_output/test_report.json")
    print("✓ JSON报告已生成: test_output/test_report.json")

    reporter.generate_csv_report("test_output/test_report.csv")
    print("✓ CSV报告已生成: test_output/test_report.csv")

    reporter.generate_text_report("test_output/test_report.txt")
    print("✓ TEXT报告已生成: test_output/test_report.txt")


def main():
    print("分支保护例外恢复审计排查工具 - 功能测试")
    print()

    parse_result = test_parser()
    conclusion = test_rule_engine(parse_result)
    test_reporter(conclusion, parse_result)

    print("\n" + "=" * 60)
    print("所有测试完成 ✓")
    print("=" * 60)


if __name__ == "__main__":
    main()
