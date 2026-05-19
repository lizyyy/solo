#!/usr/bin/env python3
import argparse
import sys
import json
from pathlib import Path
from typing import List, Optional

from .policy_parser import PolicyParser, PasswordPolicy
from .boundary_generator import BoundaryGenerator, BoundarySample
from .rule_engine import RuleEngine
from .reporter import Reporter


def load_policy(args) -> PasswordPolicy:
    if args.policy:
        return PolicyParser.parse(args.policy)
    elif args.policy_json:
        return PolicyParser.parse_string(args.policy_json, format='json')
    else:
        return PasswordPolicy(
            min_length=args.min_length,
            max_length=args.max_length,
            min_uppercase=args.min_uppercase,
            min_lowercase=args.min_lowercase,
            min_digits=args.min_digits,
            min_special=args.min_special,
            special_chars=args.special_chars or "!@#$%^&*()_+-=[]{}|;:,.<>?",
            forbid_consecutive=args.forbid_consecutive
        )


def load_samples(args, policy: PasswordPolicy) -> List[BoundarySample]:
    samples = []

    if args.generate:
        generator = BoundaryGenerator(policy)
        samples.extend(generator.generate_all_boundaries())

    if args.candidates:
        for candidate_file in args.candidates:
            try:
                file_samples = BoundaryGenerator.load_candidates_from_file(candidate_file)
                samples.extend(file_samples)
            except Exception as e:
                print(f"警告: 无法加载候选文件 {candidate_file}: {e}", file=sys.stderr)

    if args.password:
        for idx, pwd in enumerate(args.password):
            samples.append(BoundarySample(
                password=pwd,
                test_group='cli_candidate',
                description=f'命令行候选密码 #{idx + 1}'
            ))

    samples.sort(key=lambda s: (s.test_group, s.password))

    return samples


def main():
    parser = argparse.ArgumentParser(
        description='密码策略边界夹具失败理由排查工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s --policy policy.json --generate --output-report report.json
  %(prog)s --min-length 8 --min-uppercase 1 --password "Pass123!"
  %(prog)s --policy policy.yaml --candidates passwords.txt --generate-group-reports groups/
        """
    )

    policy_group = parser.add_argument_group('策略配置')
    policy_group.add_argument('--policy', type=str, help='策略配置文件路径 (JSON/YAML)')
    policy_group.add_argument('--policy-json', type=str, help='JSON格式的策略配置字符串')
    policy_group.add_argument('--min-length', type=int, default=8, help='最小密码长度 (默认: 8)')
    policy_group.add_argument('--max-length', type=int, default=64, help='最大密码长度 (默认: 64)')
    policy_group.add_argument('--min-uppercase', type=int, default=0, help='最小大写字母数')
    policy_group.add_argument('--min-lowercase', type=int, default=0, help='最小小写字母数')
    policy_group.add_argument('--min-digits', type=int, default=0, help='最小数字数')
    policy_group.add_argument('--min-special', type=int, default=0, help='最小特殊字符数')
    policy_group.add_argument('--special-chars', type=str, help='特殊字符集合')
    policy_group.add_argument('--forbid-consecutive', action='store_true', help='禁止连续3个相同字符')

    input_group = parser.add_argument_group('输入选项')
    input_group.add_argument('--generate', action='store_true', help='自动生成边界测试样本')
    input_group.add_argument('--candidates', nargs='+', help='候选密码文件列表 (每行一个密码)')
    input_group.add_argument('--password', nargs='+', help='命令行直接指定密码')

    output_group = parser.add_argument_group('输出选项')
    output_group.add_argument('--output-report', type=str, help='输出JSON报告文件路径')
    output_group.add_argument('--output-csv', type=str, help='输出CSV报告文件路径')
    output_group.add_argument('--generate-group-reports', type=str, help='按测试分组生成报告的输出目录')
    output_group.add_argument('--quiet', action='store_true', help='静默模式，不打印摘要')
    output_group.add_argument('--show-policy', action='store_true', help='显示当前使用的策略配置')

    args = parser.parse_args()

    if not args.generate and not args.candidates and not args.password:
        parser.error('必须指定至少一个输入选项: --generate, --candidates, 或 --password')

    try:
        policy = load_policy(args)

        if args.show_policy:
            print("当前策略配置:")
            print(json.dumps(policy.to_dict(), ensure_ascii=False, indent=2))

        samples = load_samples(args, policy)

        if not samples:
            print("警告: 没有加载到任何测试样本", file=sys.stderr)
            return 0

        engine = RuleEngine(policy)
        results = engine.validate_batch(samples)

        reporter = Reporter(results)

        if not args.quiet:
            reporter.print_summary()

        if args.output_report:
            reporter.generate_json_report(args.output_report)
            if not args.quiet:
                print(f"JSON报告已保存到: {args.output_report}")

        if args.output_csv:
            reporter.generate_csv_report(args.output_csv)
            if not args.quiet:
                print(f"CSV报告已保存到: {args.output_csv}")

        if args.generate_group_reports:
            reporter.generate_group_reports(args.generate_group_reports, format='json')
            reporter.generate_group_reports(args.generate_group_reports, format='csv')
            if not args.quiet:
                print(f"分组报告已保存到: {args.generate_group_reports}/")

        return reporter.get_exit_code()

    except FileNotFoundError as e:
        print(f"错误: 文件未找到 - {e}", file=sys.stderr)
        return 2
    except json.JSONDecodeError as e:
        print(f"错误: JSON解析失败 - {e}", file=sys.stderr)
        return 3
    except ValueError as e:
        print(f"错误: 参数错误 - {e}", file=sys.stderr)
        return 4
    except Exception as e:
        print(f"错误: 未知错误 - {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 5


if __name__ == '__main__':
    sys.exit(main())
