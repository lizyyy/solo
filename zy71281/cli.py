#!/usr/bin/env python3
import sys
import argparse
from datetime import date
from validator import RoyaltyMatrixValidator
from normalizer import RatioNormalizer, DifferenceExplainer
from exporter import ReportExporter
from models import (
    Track, RightsHolder, Contract, RoyaltySplit, PlatformDeduction,
    RightType, Platform
)


def load_sample_data(validator: RoyaltyMatrixValidator):
    validator.add_track(Track(id="T001", title="夜曲", artist="周杰伦"))
    validator.add_track(Track(id="T002", title="晴天", artist="周杰伦"))
    validator.add_track(Track(id="T003", title="稻香", artist="周杰伦"))

    validator.add_rights_holder(RightsHolder(id="RH001", name="杰威尔音乐", type="唱片公司"))
    validator.add_rights_holder(RightsHolder(id="RH002", name="方文山", type="作词人"))
    validator.add_rights_holder(RightsHolder(id="RH003", name="周杰伦", type="作曲人"))
    validator.add_rights_holder(RightsHolder(id="RH004", name="腾讯音乐", type="发行方"))

    validator.add_contract(Contract(
        id="C001", track_id="T001", version="v1.0",
        effective_date=date(2023, 1, 1), is_active=True
    ))
    validator.add_contract(Contract(
        id="C002", track_id="T001", version="v1.1",
        effective_date=date(2024, 1, 1), is_active=True
    ))
    validator.add_contract(Contract(
        id="C003", track_id="T002", version="v1.0",
        effective_date=date(2023, 1, 1), is_active=True
    ))
    validator.add_contract(Contract(
        id="C004", track_id="T003", version="v1.0",
        effective_date=date(2023, 1, 1), is_active=True
    ))

    validator.add_split(RoyaltySplit(
        id="S001", contract_id="C001", track_id="T001",
        right_type=RightType.LYRIC, rights_holder_id="RH002",
        platform=None, split_ratio=0.30, source_ref="合同C001第5条"
    ))
    validator.add_split(RoyaltySplit(
        id="S002", contract_id="C001", track_id="T001",
        right_type=RightType.LYRIC, rights_holder_id="RH003",
        platform=None, split_ratio=0.60, source_ref="合同C001第5条"
    ))

    validator.add_split(RoyaltySplit(
        id="S003", contract_id="C003", track_id="T002",
        right_type=RightType.LYRIC, rights_holder_id="RH002",
        platform=None, split_ratio=0.30, source_ref="合同C003第5条"
    ))
    validator.add_split(RoyaltySplit(
        id="S004", contract_id="C003", track_id="T002",
        right_type=RightType.LYRIC, rights_holder_id="RH003",
        platform=None, split_ratio=0.70, source_ref="合同C003第5条"
    ))

    validator.add_split(RoyaltySplit(
        id="S005", contract_id="C001", track_id="T001",
        right_type=RightType.RECORDING, rights_holder_id="RH001",
        platform=Platform.QQ, split_ratio=0.80, source_ref="合同C001第7条"
    ))
    validator.add_split(RoyaltySplit(
        id="S006", contract_id="C001", track_id="T001",
        right_type=RightType.RECORDING, rights_holder_id="RH004",
        platform=Platform.QQ, split_ratio=0.15, source_ref="合同C001第7条"
    ))

    validator.add_split(RoyaltySplit(
        id="S007", contract_id="C004", track_id="T003",
        right_type=RightType.DISTRIBUTION, rights_holder_id="RH004",
        platform=Platform.NETEASE, split_ratio=1.00, source_ref="合同C004第9条"
    ))

    validator.add_deduction(PlatformDeduction(
        id="D001", track_id="T001", platform=Platform.QQ,
        deduction_type="平台服务费", deduction_ratio=0.15,
        source_ref="QQ音乐2024版费率表"
    ))
    validator.add_deduction(PlatformDeduction(
        id="D002", track_id="T001", platform=Platform.QQ,
        deduction_type="平台服务费", deduction_ratio=0.15,
        source_ref="QQ音乐2024版费率表-副本"
    ))
    validator.add_deduction(PlatformDeduction(
        id="D003", track_id="T002", platform=Platform.NETEASE,
        deduction_type="渠道费", deduction_ratio=0.10,
        source_ref="网易云合作协议"
    ))


def print_matrix(matrix):
    print("\n" + "=" * 120)
    print(f"{'曲目':<15} {'类型':<8} {'权利人':<12} {'平台':<12} {'原始比例':>10} {'归一化':>10} {'合同版本':>10} {'来源':<20}")
    print("-" * 120)
    for row in matrix:
        normalized = f"{row.normalized_ratio:>8.2%}" if row.normalized_ratio else "     -"
        print(f"{row.track_title:<15} {row.right_type:<8} {row.rights_holder:<12} "
              f"{row.platform:<12} {row.split_ratio:>8.2%} {normalized} "
              f"{row.contract_version:>10} {row.source_ref:<20}")
    print("=" * 120)


def print_summary(summary):
    print("\n【数据概览】")
    for key, value in summary.items():
        print(f"  {key}: {value}")


def print_issues(issues, explainer):
    if not issues:
        print("\n✓ 未发现任何校验问题")
        return

    print(f"\n【校验问题】共发现 {len(issues)} 个问题:")
    for idx, issue in enumerate(issues, 1):
        level_icon = "✗" if issue.level == "error" else "!"
        print(f"\n  {idx}. [{level_icon}] {issue.category}: {issue.message}")
        print(f"     判断依据:")
        for ev in issue.evidence:
            ev_str = ", ".join([f"{k}={v}" for k, v in ev.items()])
            print(f"       - {ev_str}")


def main():
    parser = argparse.ArgumentParser(
        description="音乐版权分成矩阵校验系统",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python cli.py validate                              # 完整校验
  python cli.py validate --track T001                 # 按曲目筛选
  python cli.py validate --right-type 词曲            # 按权利类型筛选
  python cli.py validate --platform QQ音乐            # 按平台筛选
  python cli.py export --format csv                   # 导出CSV
  python cli.py export --format json --output report.json
  python cli.py explain --issue 1                     # 解释第1个问题
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    validate_parser = subparsers.add_parser("validate", help="校验分成矩阵")
    validate_parser.add_argument("--track", help="按曲目ID筛选")
    validate_parser.add_argument("--right-type", help="按权利类型筛选 (词曲/录音/发行)")
    validate_parser.add_argument("--platform", help="按平台筛选")
    validate_parser.add_argument("--normalize", action="store_true", help="启用比例归一化")

    export_parser = subparsers.add_parser("export", help="导出报告")
    export_parser.add_argument("--format", choices=["csv", "txt", "json"], default="csv", help="导出格式")
    export_parser.add_argument("--output", help="输出文件路径")
    export_parser.add_argument("--track", help="按曲目ID筛选")
    export_parser.add_argument("--right-type", help="按权利类型筛选")
    export_parser.add_argument("--platform", help="按平台筛选")

    explain_parser = subparsers.add_parser("explain", help="详细解释问题")
    explain_parser.add_argument("--issue", type=int, help="问题编号")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    validator = RoyaltyMatrixValidator()
    normalizer = RatioNormalizer()
    explainer = DifferenceExplainer()
    exporter = ReportExporter()

    load_sample_data(validator)

    filters = {}
    if hasattr(args, 'track') and args.track:
        filters['track_id'] = args.track
    if hasattr(args, 'right_type') and args.right_type:
        filters['right_type'] = args.right_type
    if hasattr(args, 'platform') and args.platform:
        filters['platform'] = args.platform

    if args.command == "validate":
        result = validator.validate_all(filters)

        if args.normalize:
            result.matrix, norm_summary = normalizer.normalize_matrix(
                validator.splits, result.matrix
            )

        print_summary(result.summary)
        print_matrix(result.matrix)
        print_issues(result.issues, explainer)

        if args.normalize:
            print(f"\n【归一化统计】{norm_summary['需要归一化组数']}/{norm_summary['总分组数']} 组需要归一化")

        if result.is_valid:
            print("\n✓ 校验通过!")
        else:
            print(f"\n✗ 校验失败，存在 {sum(1 for i in result.issues if i.level == 'error')} 个错误")

    elif args.command == "export":
        result = validator.validate_all(filters)
        result.matrix, _ = normalizer.normalize_matrix(validator.splits, result.matrix)

        output = args.output or f"royalty_report.{args.format}"

        if args.format == "csv":
            exporter.export_matrix_csv(result.matrix, output, filters)
            exporter.export_issues_csv(result.issues, f"issues_{output}", filters)
        elif args.format == "txt":
            exporter.export_full_report(result, output, filters)
        else:
            exporter.export_json(result, output, filters)

        print(f"✓ 报告已导出到: {output}")
        if args.format == "csv":
            print(f"✓ 问题报告已导出到: issues_{output}")

    elif args.command == "explain":
        result = validator.validate_all(filters)
        if args.issue and 1 <= args.issue <= len(result.issues):
            issue = result.issues[args.issue - 1]
            print(explainer.explain_issue(issue))
        else:
            for idx, issue in enumerate(result.issues, 1):
                print(f"\n{'='*60}")
                print(f"问题 {idx}:")
                print(explainer.explain_issue(issue))


if __name__ == "__main__":
    main()
