"""
命令行接口模块 - 提供 validate、audit、export 三个命令
"""

import argparse
import sys
from pathlib import Path
from typing import Dict, Any, Optional

from .parser import Parser
from .rules import RuleEngine, Severity
from .state_machine import FlowStateMachine, StateValidator
from .reporter import Reporter


def create_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="exam_flow_auditor",
        description="高校考务流转复核工具 - 复核备用卷袋和答题卡袋的流转闭环",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 验证流转数据
  exam_flow_auditor validate --rooms sample/exam_rooms.csv --scans sample/bag_scans.jsonl --manifest sample/paper_manifest.yaml --invigilators sample/invigilators.csv --rules sample/flow_rules.yaml

  # 执行完整审计
  exam_flow_auditor audit --rooms sample/exam_rooms.csv --scans sample/bag_scans.jsonl --manifest sample/paper_manifest.yaml --invigilators sample/invigilators.csv --rules sample/flow_rules.yaml

  # 导出报告
  exam_flow_auditor export --rooms sample/exam_rooms.csv --scans sample/bag_scans.jsonl --manifest sample/paper_manifest.yaml --invigilators sample/invigilators.csv --rules sample/flow_rules.yaml --output ./output
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    validate_parser = subparsers.add_parser("validate", help="验证流转数据的合法性")
    audit_parser = subparsers.add_parser("audit", help="执行完整审计并显示结果")
    export_parser = subparsers.add_parser("export", help="导出审计报告文件")

    for subparser in [validate_parser, audit_parser, export_parser]:
        subparser.add_argument(
            "--rooms", "-r",
            required=True,
            help="考场信息 CSV 文件路径"
        )
        subparser.add_argument(
            "--scans", "-s",
            required=True,
            help="袋扫描记录 JSONL 文件路径"
        )
        subparser.add_argument(
            "--manifest", "-m",
            required=True,
            help="试卷清单 YAML 文件路径"
        )
        subparser.add_argument(
            "--invigilators", "-i",
            required=True,
            help="监考人员信息 CSV 文件路径"
        )
        subparser.add_argument(
            "--rules", "-f",
            required=True,
            help="流转规则 YAML 文件路径"
        )
        subparser.add_argument(
            "--verbose", "-v",
            action="store_true",
            help="显示详细输出"
        )

    export_parser.add_argument(
        "--output", "-o",
        default=".",
        help="输出目录路径 (默认: 当前目录)"
    )

    return parser


class FlowAuditor:
    def __init__(self, base_path: Optional[Path] = None):
        self.base_path = base_path or Path.cwd()
        self.parser = Parser(self.base_path)
        self.rule_engine = RuleEngine()

    def load_data(self, rooms_path: str, scans_path: str, manifest_path: str,
                  invigilators_path: str, rules_path: str) -> Dict[str, Any]:
        parsed_data = self.parser.parse_all(
            exam_rooms_path=rooms_path,
            invigilators_path=invigilators_path,
            paper_manifest_path=manifest_path,
            bag_scans_path=scans_path,
            flow_rules_path=rules_path
        )

        return {
            "exam_rooms": parsed_data["exam_rooms"],
            "invigilators": parsed_data["invigilators"],
            "bag_manifests": parsed_data["bag_manifests"],
            "bag_scans": parsed_data["bag_scans"],
            "flow_rules": parsed_data["flow_rules"]["flow_rules"],
            "validation_rules": parsed_data["flow_rules"]["validation_rules"]
        }

    def run_validate(self, context: Dict[str, Any]) -> Dict[str, Any]:
        flow_rules = context["flow_rules"]
        bag_scans = context["bag_scans"]
        bag_manifests = context["bag_manifests"]

        state_machine = FlowStateMachine(flow_rules)
        state_validator = StateValidator(flow_rules)

        state_machine_results = state_machine.process_all_scans(bag_scans, bag_manifests)

        rule_results = self.rule_engine.run_all(context)

        return {
            "state_machine": state_machine_results,
            "rule_results": rule_results,
            "state_validator": state_validator.validate_all_bags(bag_manifests)
        }

    def run_audit(self, context: Dict[str, Any]) -> Dict[str, Any]:
        return self.run_validate(context)

    def run_export(self, context: Dict[str, Any], output_dir: Path) -> Dict[str, Any]:
        results = self.run_validate(context)

        output_dir.mkdir(parents=True, exist_ok=True)

        reporter = Reporter(output_dir)

        report_files = reporter.generate_all_reports(
            rule_results=results["rule_results"],
            state_machine_results=results["state_machine"],
            context=context
        )

        results["report_files"] = report_files
        return results


def print_summary(results: Dict[str, Any], verbose: bool = False):
    state_machine = results.get("state_machine", {})
    rule_results = results.get("rule_results", {})
    summary = rule_results.get("summary", {})

    print("=" * 70)
    print("高校考务流转复核工具 - 验证结果摘要")
    print("=" * 70)
    print()

    print("【流转状态概览】")
    print(f"  总扫描记录数: {state_machine.get('total_scans', 0)}")
    print(f"  ✅ 有效流转: {state_machine.get('valid_transitions', 0)}")
    print(f"  ❌ 无效流转: {state_machine.get('invalid_transitions', 0)}")
    print(f"  ✅ 已完成流转: {state_machine.get('completed_bags', 0)} 个试卷袋")
    print(f"  ⏳ 进行中: {state_machine.get('in_progress_bags', 0)} 个试卷袋")
    print()

    print("【问题检测概览】")
    total = summary.get("total", 0)
    critical = summary.get("critical", 0)
    high = summary.get("high", 0)
    medium = summary.get("medium", 0)
    low = summary.get("low", 0)

    if total == 0:
        print("  ✅ 未检测到任何问题")
    else:
        print(f"  🔴 严重 (CRITICAL): {critical}")
        print(f"  🟠 高危 (HIGH): {high}")
        print(f"  🟡 中危 (MEDIUM): {medium}")
        print(f"  🟢 低危 (LOW): {low}")
        print()

        if critical > 0:
            print("  ⚠️ 警告: 存在严重问题，建议立即处理！")
        elif high > 0:
            print("  ⚠️ 警告: 存在高危问题，建议尽快处理")

    print()
    print("=" * 70)

    if verbose and total > 0:
        print()
        print("【详细问题列表】")
        print("-" * 70)

        by_severity = rule_results.get("by_severity", {})
        all_issues = rule_results.get("all_issues", [])

        for issue in all_issues:
            icon = {
                Severity.CRITICAL: "🔴",
                Severity.HIGH: "🟠",
                Severity.MEDIUM: "🟡",
                Severity.LOW: "🟢"
            }.get(issue.severity, "⚪")

            print(f"\n{icon} [{issue.severity.value}] {issue.rule_name}")
            print(f"    问题ID: {issue.issue_id}")
            print(f"    描述: {issue.description}")
            if issue.bag_id:
                print(f"    试卷袋: {issue.bag_id}")
            if issue.scan_id:
                print(f"    扫描ID: {issue.scan_id}")

            if issue.details:
                print("    详情:")
                for key, value in issue.details.items():
                    if isinstance(value, list):
                        value_str = ", ".join(str(v) for v in value)
                    else:
                        value_str = str(value)
                    print(f"      - {key}: {value_str}")

        print()
        print("=" * 70)


def print_export_results(results: Dict[str, Any]):
    report_files = results.get("report_files", {})

    print()
    print("【报告文件已生成】")
    print("-" * 70)

    if "issues_csv" in report_files:
        print(f"  📄 问题列表 (issues.csv): {report_files['issues_csv']}")

    if "handover_audit_md" in report_files:
        print(f"  📄 交接审计报告 (handover_audit.md): {report_files['handover_audit_md']}")

    print()
    print("=" * 70)


def main():
    parser = create_argument_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    base_path = Path.cwd()
    auditor = FlowAuditor(base_path)

    try:
        print(f"正在加载数据...")
        context = auditor.load_data(
            rooms_path=args.rooms,
            scans_path=args.scans,
            manifest_path=args.manifest,
            invigilators_path=args.invigilators,
            rules_path=args.rules
        )

        bag_manifests = context["bag_manifests"]
        bag_scans = context["bag_scans"]
        exam_rooms = context["exam_rooms"]
        invigilators = context["invigilators"]

        print(f"  考场: {len(exam_rooms)} 个")
        print(f"  监考人员: {len(invigilators)} 人")
        print(f"  试卷袋/答题卡袋: {len(bag_manifests)} 个")
        print(f"  扫描记录: {len(bag_scans)} 条")
        print()

        if args.command == "validate":
            print("执行验证...")
            results = auditor.run_validate(context)
            print_summary(results, verbose=args.verbose)

            summary = results["rule_results"].get("summary", {})
            if summary.get("critical", 0) > 0 or summary.get("high", 0) > 0:
                sys.exit(2)
            elif summary.get("total", 0) > 0:
                sys.exit(1)
            else:
                sys.exit(0)

        elif args.command == "audit":
            print("执行完整审计...")
            results = auditor.run_audit(context)
            print_summary(results, verbose=args.verbose)
            sys.exit(0)

        elif args.command == "export":
            print("导出审计报告...")
            output_dir = Path(args.output)
            results = auditor.run_export(context, output_dir)
            print_summary(results, verbose=args.verbose)
            print_export_results(results)
            sys.exit(0)

    except FileNotFoundError as e:
        print(f"错误: 找不到文件 - {e}")
        sys.exit(1)
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
