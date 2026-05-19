#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

from .parsers.identity_source_parser import IdentitySourceParser, IdentitySourceJsonParser
from .parsers.mapping_parser import AttributeMappingParser, AttributeMappingJsonParser
from .parsers.test_user_parser import TestUserParser, TestUserJsonParser
from .parsers.role_result_parser import RoleResultParser, RoleResultJsonParser
from .parsers.correction_parser import CorrectionParser, CorrectionJsonParser
from .core.validator import MappingValidator
from .core.playback import PlaybackEngine
from .core.conflict_detector import ConflictDetector
from .reports.report_generator import ReportGenerator


def auto_parse(parser_cls, json_parser_cls, file_path: str):
    path = Path(file_path)
    if path.suffix.lower() == ".json":
        parser = json_parser_cls(file_path)
    else:
        parser = parser_cls(file_path)
    return parser.parse()


def main():
    parser = argparse.ArgumentParser(
        description="SSO 属性映射测试用户回放排查工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  %(prog)s -i identity.csv -m mapping.csv -t test_users.csv -r roles.csv -c corrections.csv -o output
  %(prog)s --identity identity.json --mapping mapping.json --test test.json --roles roles.json --output output
        """,
    )

    parser.add_argument(
        "-i", "--identity",
        required=True,
        help="身份源数据文件 (CSV或JSON)",
    )
    parser.add_argument(
        "-m", "--mapping",
        required=True,
        help="属性映射规则文件 (CSV或JSON)",
    )
    parser.add_argument(
        "-t", "--test",
        required=True,
        help="测试用户期望结果文件 (CSV或JSON)",
    )
    parser.add_argument(
        "-r", "--roles",
        required=True,
        help="实际角色结果文件 (CSV或JSON)",
    )
    parser.add_argument(
        "-c", "--corrections",
        default=None,
        help="修正记录文件 (CSV或JSON, 可选)",
    )
    parser.add_argument(
        "-o", "--output",
        required=True,
        help="报告输出目录",
    )
    parser.add_argument(
        "-f", "--format",
        choices=["all", "json", "csv", "markdown"],
        default="all",
        help="输出报告格式 (默认: all)",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="显示详细输出",
    )

    args = parser.parse_args()

    if args.verbose:
        print("🔍 开始解析输入文件...")

    parse_results = {}

    identity_result = auto_parse(IdentitySourceParser, IdentitySourceJsonParser, args.identity)
    parse_results["identity_source"] = identity_result
    if args.verbose:
        print(f"  ✓ 身份源: {len(identity_result.items)} 条记录, {len(identity_result.errors)} 个错误")

    mapping_result = auto_parse(AttributeMappingParser, AttributeMappingJsonParser, args.mapping)
    parse_results["mapping"] = mapping_result
    if args.verbose:
        print(f"  ✓ 属性映射: {len(mapping_result.items[0].rules) if mapping_result.items else 0} 条规则")

    test_result = auto_parse(TestUserParser, TestUserJsonParser, args.test)
    parse_results["test_users"] = test_result
    if args.verbose:
        print(f"  ✓ 测试用户: {len(test_result.items)} 条记录, {len(test_result.errors)} 个错误")

    roles_result = auto_parse(RoleResultParser, RoleResultJsonParser, args.roles)
    parse_results["role_results"] = roles_result
    if args.verbose:
        print(f"  ✓ 角色结果: {len(roles_result.items)} 条记录, {len(roles_result.errors)} 个错误")

    corrections = []
    if args.corrections:
        corrections_result = auto_parse(CorrectionParser, CorrectionJsonParser, args.corrections)
        parse_results["corrections"] = corrections_result
        corrections = corrections_result.items
        if args.verbose:
            print(f"  ✓ 修正记录: {len(corrections)} 条记录, {len(corrections_result.errors)} 个错误")

    if args.verbose:
        print("\n⚙️  执行属性映射验证...")

    if not mapping_result.items:
        print("❌ 错误: 属性映射规则为空")
        sys.exit(1)

    validator = MappingValidator(mapping_result.items[0])
    mapping_results = validator.validate_all(identity_result.items)

    failed_count = sum(1 for r in mapping_results if not r.success)
    if args.verbose:
        print(f"  ✓ 已验证 {len(mapping_results)} 个用户, {failed_count} 个失败")

    if args.verbose:
        print("\n🔄 执行测试用户回放...")

    playback_engine = PlaybackEngine(test_result.items)
    playback_results = playback_engine.playback_all(mapping_results, roles_result.items)

    matched_count = sum(1 for r in playback_results if r.matched)
    if args.verbose:
        print(f"  ✓ 已回放 {len(playback_results)} 个测试用户, {matched_count} 个匹配")

    if args.verbose:
        print("\n⚠️  执行角色冲突检测...")

    expected_roles_map = {tu.user_id: tu.expected_roles for tu in test_result.items}
    conflict_detector = ConflictDetector(corrections)
    conflict_results = conflict_detector.detect_all(roles_result.items, expected_roles_map)

    conflict_count = sum(1 for r in conflict_results if r.has_conflicts)
    if args.verbose:
        print(f"  ✓ 已检测 {len(conflict_results)} 个用户, {conflict_count} 个有冲突")

    if args.verbose:
        print("\n📊 生成报告...")

    report_generator = ReportGenerator(
        mapping_results=mapping_results,
        playback_results=playback_results,
        conflict_results=conflict_results,
        parse_results=parse_results,
    )

    output_path = Path(args.output)
    output_path.mkdir(parents=True, exist_ok=True)

    if args.format == "all":
        report_generator.generate_all(args.output)
    elif args.format == "json":
        report_generator.generate_json(str(output_path / "report.json"), include_details=True)
    elif args.format == "csv":
        report_generator.generate_csv(str(output_path / "csv"))
    elif args.format == "markdown":
        report_generator.generate_markdown(str(output_path / "report.md"), include_details=True)

    if args.verbose:
        print(f"  ✓ 报告已生成到: {output_path.absolute()}")

    summary = report_generator._get_summary()
    has_errors = summary["has_errors"]

    print("\n" + "=" * 50)
    print("📋 执行摘要")
    print("=" * 50)
    print(f"\n属性映射验证:")
    print(f"  总用户数: {summary['mapping']['total_users']}")
    print(f"  成功: {summary['mapping']['success_count']}")
    print(f"  失败: {summary['mapping']['failed_count']}")
    print(f"  成功率: {summary['mapping']['success_rate']:.2%}")

    print(f"\n测试用户回放:")
    print(f"  总测试用户数: {summary['playback']['total_test_users']}")
    print(f"  匹配: {summary['playback']['matched_count']}")
    print(f"  差异: {summary['playback']['diff_count']}")
    print(f"  匹配率: {summary['playback']['match_rate']:.2%}")

    print(f"\n角色冲突检测:")
    print(f"  总冲突数: {summary['conflicts']['total_conflicts']}")
    print(f"  有冲突用户数: {summary['conflicts']['conflict_user_count']}")

    if summary["parse_errors"]:
        print(f"\n解析错误: {len(summary['parse_errors'])} 个")

    print("\n" + "=" * 50)
    if has_errors:
        print("⚠️  检测到错误，请查看报告详情")
        sys.exit(1)
    else:
        print("✅ 所有检查通过!")
        sys.exit(0)


if __name__ == "__main__":
    main()
