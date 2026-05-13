#!/usr/bin/env python3
"""
变更单关联告警 CLI 工具

用于在故障复盘时关联变更与告警，提供可解释的评分和报告。
"""

import argparse
import sys
import json
from typing import Optional
from datetime import datetime

from .storage import StorageManager
from .correlator import Correlator
from .report_generator import ReportGenerator
from .sample_data import SampleDataGenerator


class ChangeCorrelatorCLI:
    def __init__(self, data_dir: str = "./data"):
        self.storage = StorageManager(data_dir)
        self.report_gen = ReportGenerator()

    def cmd_init_samples(self, args):
        generator = SampleDataGenerator()
        changes, alerts, aliases = generator.generate_samples()

        self.storage.save_changes(changes)
        self.storage.save_alerts(alerts)
        self.storage.save_aliases(aliases)

        print(f"✅ 已初始化样例数据:")
        print(f"   - {len(changes)} 条变更记录")
        print(f"   - {len(alerts)} 条告警记录")
        print(f"   - {len(aliases)} 组服务别名")
        print(f"   数据目录: {self.storage.data_dir}")

    def cmd_correlate(self, args):
        changes = self.storage.load_changes()
        alerts = self.storage.load_alerts()
        aliases = self.storage.load_aliases()

        if not changes:
            print("❌ 没有找到变更记录，请先初始化样例数据或导入数据。")
            return 1

        if not alerts:
            print("❌ 没有找到告警记录，请先初始化样例数据或导入数据。")
            return 1

        correlator = Correlator(
            time_window_minutes=args.time_window,
            service_aliases=aliases,
        )

        if args.deduplicate:
            original_count = len(alerts)
            alerts = correlator.deduplicate_alerts(alerts)
            deduplicated = original_count - len(alerts)
            if deduplicated > 0:
                print(f"ℹ️  去重了 {deduplicated} 条重复告警")

        correlations = correlator.correlate(changes, alerts)
        self.storage.save_correlations(correlations)

        report = self.report_gen.generate_report(changes, alerts, correlations)

        if args.output == "summary":
            print(self.report_gen.format_summary(report))
        elif args.output == "full":
            print(self.report_gen.format_text_report(report))
        elif args.output == "json":
            print(json.dumps(report.to_dict(), ensure_ascii=False, indent=2))

        print(f"\n💾 已保存 {len(correlations)} 条关联结果")
        return 0

    def cmd_explain(self, args):
        correlations = self.storage.load_correlations()

        if not correlations:
            print("❌ 没有找到关联结果，请先运行 correlate 命令。")
            return 1

        if args.change_id and args.alert_id:
            results = [
                c
                for c in correlations
                if c.change.id == args.change_id and c.alert.id == args.alert_id
            ]
        elif args.change_id:
            results = [c for c in correlations if c.change.id == args.change_id]
        elif args.alert_id:
            results = [c for c in correlations if c.alert.id == args.alert_id]
        else:
            results = correlations[:5]

        if not results:
            print("❌ 没有找到匹配的关联结果。")
            return 1

        for i, corr in enumerate(results, 1):
            score = corr.score
            print(f"\n{'='*60}")
            print(f"关联 #{i}")
            print(f"{'='*60}")
            print(f"\n【变更】")
            print(f"  ID: {corr.change.id}")
            print(f"  类型: {corr.change.type.value}")
            print(f"  服务: {corr.change.service}")
            print(f"  时间: {corr.change.start_time}")
            print(f"  描述: {corr.change.description}")

            print(f"\n【告警】")
            print(f"  ID: {corr.alert.id}")
            print(f"  级别: {corr.alert.severity}")
            print(f"  指标: {corr.alert.metric_type.value}")
            print(f"  服务: {corr.alert.service}")
            print(f"  时间: {corr.alert.start_time}")
            print(f"  描述: {corr.alert.description}")

            print(f"\n【评分详情】（总分: {score.total_score}）")
            print(f"  {'指标':<10} {'评分':<8} 说明")
            print(f"  {'-'*50}")
            print(f"  时间       {score.time_score:<8} {score.time_reason}")
            print(f"  服务       {score.service_score:<8} {score.service_reason}")
            print(f"  实例       {score.instance_score:<8} {score.instance_reason}")
            print(f"  租户       {score.tenant_score:<8} {score.tenant_reason}")
            print(f"  指标       {score.metric_score:<8} {score.metric_reason}")
            print(f"\n  时间窗口: {score.time_window_minutes} 分钟")

            if corr.is_root_cause:
                print(f"\n  ★ 已标记为根因")
                if corr.change.cause_remark:
                    print(f"     说明: {corr.change.cause_remark}")

        return 0

    def cmd_mark_cause(self, args):
        change = self.storage.get_change(args.change_id)
        if not change:
            print(f"❌ 没有找到变更 {args.change_id}")
            return 1

        change.marked_cause = True
        if args.remark:
            change.cause_remark = args.remark
        self.storage.update_change(change)

        print(f"✅ 已将变更 {args.change_id} 标记为根因")
        if args.remark:
            print(f"   说明: {args.remark}")

        changes = self.storage.load_changes()
        alerts = self.storage.load_alerts()
        aliases = self.storage.load_aliases()

        correlator = Correlator(
            time_window_minutes=60,
            service_aliases=aliases,
        )
        correlations = correlator.correlate(changes, alerts)
        self.storage.save_correlations(correlations)

        report = self.report_gen.generate_report(changes, alerts, correlations)
        self.storage.save_report(report)

        print(f"🔄 已重新生成关联结果和报告")
        return 0

    def cmd_exclude(self, args):
        change = self.storage.get_change(args.change_id)
        if not change:
            print(f"❌ 没有找到变更 {args.change_id}")
            return 1

        change.excluded = True
        if args.reason:
            change.exclude_reason = args.reason
        self.storage.update_change(change)

        print(f"✅ 已将变更 {args.change_id} 排除出关联分析")
        if args.reason:
            print(f"   原因: {args.reason}")

        changes = self.storage.load_changes()
        alerts = self.storage.load_alerts()
        aliases = self.storage.load_aliases()

        correlator = Correlator(
            time_window_minutes=60,
            service_aliases=aliases,
        )
        correlations = correlator.correlate(changes, alerts)
        self.storage.save_correlations(correlations)

        report = self.report_gen.generate_report(changes, alerts, correlations)
        self.storage.save_report(report)

        print(f"🔄 已重新生成关联结果和报告")
        return 0

    def cmd_report(self, args):
        report = self.storage.load_latest_report()

        if not report:
            changes = self.storage.load_changes()
            alerts = self.storage.load_alerts()
            correlations = self.storage.load_correlations()

            if not correlations:
                print("❌ 没有找到报告和关联结果，请先运行 correlate 命令。")
                return 1

            report = self.report_gen.generate_report(changes, alerts, correlations)

        if args.format == "text":
            print(self.report_gen.format_text_report(report))
        elif args.format == "summary":
            print(self.report_gen.format_summary(report))
        elif args.format == "json":
            print(json.dumps(report.to_dict(), ensure_ascii=False, indent=2))

        return 0

    def cmd_list(self, args):
        changes = self.storage.load_changes()
        alerts = self.storage.load_alerts()

        if args.type == "changes" or args.type == "all":
            print(f"\n【变更记录】({len(changes)} 条)")
            print("-" * 80)
            for c in changes:
                status = []
                if c.excluded:
                    status.append("已排除")
                if c.marked_cause:
                    status.append("根因")
                status_str = f" [{', '.join(status)}]" if status else ""
                print(f"  {c.id:<10} {c.type.value:<15} {c.service:<20} {c.start_time}{status_str}")

        if args.type == "alerts" or args.type == "all":
            print(f"\n【告警记录】({len(alerts)} 条)")
            print("-" * 80)
            for a in alerts:
                print(f"  {a.id:<10} {a.severity:<8} {a.metric_type.value:<15} {a.service:<20} {a.start_time}")

        return 0


def main():
    parser = argparse.ArgumentParser(
        prog="change-correlate",
        description="变更单关联告警 CLI - 故障复盘时的证据链分析工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  change-correlate init-samples                    # 初始化样例数据
  change-correlate correlate                        # 执行关联分析
  change-correlate explain --change-id CHG-001     # 解释特定变更的关联
  change-correlate mark-cause CHG-001 "发布引入的bug" # 标记根因
  change-correlate exclude CHG-002 "扩容是预防性的"  # 排除变更
  change-correlate report --format text            # 生成文本报告
        """,
    )

    parser.add_argument(
        "--data-dir",
        default="./data",
        help="数据目录路径 (默认: ./data)",
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    subparsers.add_parser(
        "init-samples",
        help="初始化样例数据用于测试",
    )

    corr_parser = subparsers.add_parser(
        "correlate",
        help="执行变更与告警的关联分析",
    )
    corr_parser.add_argument(
        "--time-window",
        type=int,
        default=60,
        help="时间窗口（分钟），变更后多久内的告警视为可能相关 (默认: 60)",
    )
    corr_parser.add_argument(
        "--deduplicate",
        action="store_true",
        help="对重复告警进行去重",
    )
    corr_parser.add_argument(
        "--output",
        choices=["summary", "full", "json"],
        default="summary",
        help="输出格式 (默认: summary)",
    )

    explain_parser = subparsers.add_parser(
        "explain",
        help="详细解释关联评分",
    )
    explain_parser.add_argument(
        "--change-id",
        help="按变更ID筛选",
    )
    explain_parser.add_argument(
        "--alert-id",
        help="按告警ID筛选",
    )

    mark_parser = subparsers.add_parser(
        "mark-cause",
        help="标记变更为根因",
    )
    mark_parser.add_argument(
        "change_id",
        help="变更ID",
    )
    mark_parser.add_argument(
        "remark",
        nargs="?",
        help="根因说明（可选）",
    )

    exclude_parser = subparsers.add_parser(
        "exclude",
        help="排除变更（保留在报告中但不参与关联）",
    )
    exclude_parser.add_argument(
        "change_id",
        help="变更ID",
    )
    exclude_parser.add_argument(
        "reason",
        nargs="?",
        help="排除原因（可选）",
    )

    report_parser = subparsers.add_parser(
        "report",
        help="生成复盘报告",
    )
    report_parser.add_argument(
        "--format",
        choices=["text", "summary", "json"],
        default="text",
        help="报告格式 (默认: text)",
    )

    list_parser = subparsers.add_parser(
        "list",
        help="列出变更或告警",
    )
    list_parser.add_argument(
        "type",
        choices=["changes", "alerts", "all"],
        default="all",
        nargs="?",
        help="列出类型 (默认: all)",
    )

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    cli = ChangeCorrelatorCLI(data_dir=args.data_dir)

    commands = {
        "init-samples": cli.cmd_init_samples,
        "correlate": cli.cmd_correlate,
        "explain": cli.cmd_explain,
        "mark-cause": cli.cmd_mark_cause,
        "exclude": cli.cmd_exclude,
        "report": cli.cmd_report,
        "list": cli.cmd_list,
    }

    handler = commands.get(args.command)
    if handler:
        return handler(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
