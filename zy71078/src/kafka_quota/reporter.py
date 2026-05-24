from __future__ import annotations

import json
from dataclasses import asdict
from datetime import timedelta
from pathlib import Path
from typing import Any, Dict, List

from tabulate import tabulate

from .models import AnomalyLevel, QuotaReport, TeamQuotaSummary
from .parser import RetentionParser


class ReportSerializer:
    @staticmethod
    def _timedelta_to_str(td: timedelta) -> str:
        return RetentionParser.format(td)

    @classmethod
    def to_dict(cls, report: QuotaReport) -> Dict[str, Any]:
        data = {
            "generated_at": report.generated_at,
            "input_files": report.input_files,
            "summary": {
                "total_topics": len(report.all_topics),
                "assigned_topics": len(report.assigned_topics),
                "unassigned_topics": len(report.unassigned_topics),
                "total_partitions": report.total_partitions,
                "anomaly_counts": {k.value: v for k, v in report.anomaly_counts.items()},
                "has_errors": report.has_errors,
            },
            "team_summaries": {},
            "prefix_conflicts": [],
            "owner_merge_issues": report.owner_merge_issues,
            "topics": [],
        }

        for team_name, summary in report.team_summaries.items():
            data["team_summaries"][team_name] = {
                "team": {
                    "name": summary.team.name,
                    "owners": summary.team.owners,
                    "max_total_partitions": summary.team.max_total_partitions,
                    "max_partitions_per_topic": summary.team.max_partitions_per_topic,
                    "max_retention": cls._timedelta_to_str(summary.team.max_retention),
                },
                "topic_count": summary.topic_count,
                "total_partitions": summary.total_partitions,
                "partition_quota_used_pct": round(summary.partition_quota_used, 2),
                "over_partition_quota": summary.over_partition_quota,
                "anomalies": [
                    {
                        "rule_name": a.rule_name,
                        "level": a.level.value,
                        "message": a.message,
                        "details": a.details,
                    }
                    for a in summary.anomalies
                ],
                "topics": [t.name for t in summary.topics],
            }

        for conflict in report.prefix_conflicts:
            data["prefix_conflicts"].append(
                {
                    "prefix": conflict.prefix,
                    "teams": [t.name for t in conflict.teams],
                    "affected_topics": [t.name for t in conflict.topics],
                }
            )

        for topic in report.all_topics:
            data["topics"].append(
                {
                    "name": topic.name,
                    "partitions": topic.partitions,
                    "retention": cls._timedelta_to_str(topic.retention),
                    "team": topic.assigned_team.name if topic.assigned_team else None,
                    "team_hint": topic.team_hint,
                    "anomalies": [
                        {
                            "rule_name": a.rule_name,
                            "level": a.level.value,
                            "message": a.message,
                            "details": a.details,
                        }
                        for a in topic.anomalies
                    ],
                }
            )

        return data

    @classmethod
    def to_json(cls, report: QuotaReport, file_path: Path):
        data = cls.to_dict(report)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


class TerminalReporter:
    _COLORS = {
        AnomalyLevel.INFO: "\033[94m",
        AnomalyLevel.WARNING: "\033[93m",
        AnomalyLevel.ERROR: "\033[91m",
        AnomalyLevel.CRITICAL: "\033[95m",
        "RESET": "\033[0m",
        "GREEN": "\033[92m",
        "BOLD": "\033[1m",
    }

    @classmethod
    def print_summary(cls, report: QuotaReport):
        print(cls._COLORS["BOLD"] + "=" * 60 + cls._COLORS["RESET"])
        print(cls._COLORS["BOLD"] + "Kafka Topic 配额报告" + cls._COLORS["RESET"])
        print(cls._COLORS["BOLD"] + "=" * 60 + cls._COLORS["RESET"])
        print()

        cls._print_overview(report)
        print()
        cls._print_anomaly_summary(report)
        print()
        cls._print_team_summary(report)
        print()
        cls._print_prefix_conflicts(report)
        print()
        cls._print_unassigned_topics(report)

    @classmethod
    def _print_overview(cls, report: QuotaReport):
        print(cls._COLORS["BOLD"] + "📊 总览" + cls._COLORS["RESET"])
        rows = [
            ["Topic 总数", len(report.all_topics)],
            ["已分配团队", len(report.assigned_topics)],
            ["未分配团队", len(report.unassigned_topics)],
            ["总分区数", report.total_partitions],
        ]
        print(tabulate(rows, tablefmt="simple"))

    @classmethod
    def _print_anomaly_summary(cls, report: QuotaReport):
        counts = report.anomaly_counts
        total = sum(counts.values())

        print(cls._COLORS["BOLD"] + "⚠️  异常汇总" + cls._COLORS["RESET"])
        rows = []
        for level in [AnomalyLevel.CRITICAL, AnomalyLevel.ERROR, AnomalyLevel.WARNING, AnomalyLevel.INFO]:
            count = counts[level]
            if count > 0:
                rows.append([f"{cls._COLORS[level]}{level.value}{cls._COLORS['RESET']}", count])
        if not rows:
            print(cls._COLORS["GREEN"] + "  无异常" + cls._COLORS["RESET"])
        else:
            print(tabulate(rows, tablefmt="simple"))

    @classmethod
    def _print_team_summary(cls, report: QuotaReport):
        print(cls._COLORS["BOLD"] + "👥 团队配额使用情况" + cls._COLORS["RESET"])

        rows = []
        for team_name, summary in sorted(report.team_summaries.items()):
            if summary.topic_count == 0:
                continue

            used_pct = summary.partition_quota_used
            status_color = cls._COLORS["GREEN"]
            if summary.over_partition_quota:
                status_color = cls._COLORS[AnomalyLevel.CRITICAL]
            elif used_pct >= 80:
                status_color = cls._COLORS[AnomalyLevel.WARNING]

            rows.append(
                [
                    team_name,
                    summary.topic_count,
                    f"{summary.total_partitions}/{summary.team.max_total_partitions}",
                    f"{status_color}{used_pct:.1f}%{cls._COLORS['RESET']}",
                    len(summary.anomalies),
                ]
            )

        if rows:
            headers = ["团队", "Topic数", "分区数/配额", "使用率", "异常"]
            print(tabulate(rows, headers=headers, tablefmt="simple"))
        else:
            print("  无数据")

    @classmethod
    def _print_prefix_conflicts(cls, report: QuotaReport):
        if not report.prefix_conflicts:
            return

        print(cls._COLORS["BOLD"] + "🔀 前缀冲突" + cls._COLORS["RESET"])
        for conflict in report.prefix_conflicts:
            teams_str = ", ".join(t.name for t in conflict.teams)
            topics_str = ", ".join(t.name for t in conflict.topics)
            print(
                f"  {cls._COLORS[AnomalyLevel.WARNING]}⚠️  前缀 '{conflict.prefix}' "
                f"匹配团队: {teams_str}{cls._COLORS['RESET']}"
            )
            print(f"     影响Topic: {topics_str}")

    @classmethod
    def _print_unassigned_topics(cls, report: QuotaReport):
        if not report.unassigned_topics:
            return

        print(cls._COLORS["BOLD"] + "❓ 未分配团队的Topic" + cls._COLORS["RESET"])
        for topic in report.unassigned_topics:
            print(f"  {cls._COLORS[AnomalyLevel.WARNING]}- {topic.name}{cls._COLORS['RESET']}")


class MarkdownReporter:
    @staticmethod
    def generate(report: QuotaReport, file_path: Path):
        lines = []
        lines.append("# Kafka Topic 配额报告")
        lines.append("")
        lines.append(f"> 生成时间: {report.generated_at}")
        lines.append("")

        lines.append("## 输入文件")
        lines.append("")
        for key, path in report.input_files.items():
            lines.append(f"- **{key}**: `{path}`")
        lines.append("")

        lines.append("## 📊 总览")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| Topic 总数 | {len(report.all_topics)} |")
        lines.append(f"| 已分配团队 | {len(report.assigned_topics)} |")
        lines.append(f"| 未分配团队 | {len(report.unassigned_topics)} |")
        lines.append(f"| 总分区数 | {report.total_partitions} |")
        lines.append("")

        lines.append("## ⚠️ 异常汇总")
        lines.append("")
        counts = report.anomaly_counts
        has_anomalies = any(counts.values())
        if not has_anomalies:
            lines.append("✅ 无异常")
        else:
            lines.append("| 等级 | 数量 |")
            lines.append("|------|------|")
            for level in [AnomalyLevel.CRITICAL, AnomalyLevel.ERROR, AnomalyLevel.WARNING, AnomalyLevel.INFO]:
                count = counts[level]
                icon = {"CRITICAL": "🔴", "ERROR": "🟠", "WARNING": "🟡", "INFO": "🔵"}[level.value]
                lines.append(f"| {icon} {level.value} | {count} |")
        lines.append("")

        lines.append("## 👥 团队配额详情")
        lines.append("")
        for team_name, summary in sorted(report.team_summaries.items()):
            lines.append(f"### {team_name}")
            lines.append("")

            lines.append("#### 配额使用情况")
            lines.append("")
            lines.append("| 指标 | 数值 |")
            lines.append("|------|------|")
            lines.append(f"| Topic 数量 | {summary.topic_count} |")
            lines.append(f"| 总分区数 | {summary.total_partitions} |")
            lines.append(f"| 分区配额 | {summary.team.max_total_partitions} |")
            lines.append(f"| 使用率 | {summary.partition_quota_used:.1f}% |")
            lines.append("")

            if summary.anomalies:
                lines.append("#### ⚠️ 团队级异常")
                lines.append("")
                for anomaly in summary.anomalies:
                    icon = {"CRITICAL": "🔴", "ERROR": "🟠", "WARNING": "🟡", "INFO": "🔵"}[anomaly.level.value]
                    lines.append(f"- {icon} **{anomaly.rule_name}**: {anomaly.message}")
                lines.append("")

            if summary.topics:
                lines.append("#### Topic 列表")
                lines.append("")
                lines.append("| Topic | 分区 | 保留时间 | 异常数 |")
                lines.append("|-------|------|----------|--------|")
                for topic in sorted(summary.topics, key=lambda t: t.name):
                    retention = RetentionParser.format(topic.retention)
                    anomaly_count = len(topic.anomalies)
                    lines.append(f"| {topic.name} | {topic.partitions} | {retention} | {anomaly_count} |")
                lines.append("")

        if report.prefix_conflicts:
            lines.append("## 🔀 前缀冲突")
            lines.append("")
            for conflict in report.prefix_conflicts:
                teams_str = ", ".join(t.name for t in conflict.teams)
                lines.append(f"### 前缀: `{conflict.prefix}`")
                lines.append("")
                lines.append(f"- **匹配团队**: {teams_str}")
                topics_str = ", ".join(f"`{t.name}`" for t in conflict.topics)
                lines.append(f"- **影响Topic**: {topics_str}")
                lines.append("")

        if report.owner_merge_issues:
            lines.append("## 👤 负责人归并问题")
            lines.append("")
            for issue in report.owner_merge_issues:
                lines.append(f"- **{issue['team']}**: 未配置的负责人 - {', '.join(issue['unconfigured_owners'])}")
            lines.append("")

        if report.unassigned_topics:
            lines.append("## ❓ 未分配团队的Topic")
            lines.append("")
            for topic in sorted(report.unassigned_topics, key=lambda t: t.name):
                retention = RetentionParser.format(topic.retention)
                lines.append(f"- `{topic.name}` (分区: {topic.partitions}, 保留: {retention})")
            lines.append("")

        lines.append("## 📋 异常详情")
        lines.append("")
        for level in [AnomalyLevel.CRITICAL, AnomalyLevel.ERROR, AnomalyLevel.WARNING, AnomalyLevel.INFO]:
            level_anomalies = []
            for topic in report.all_topics:
                for a in topic.anomalies:
                    if a.level == level:
                        level_anomalies.append((topic.name, a))

            if level_anomalies:
                icon = {"CRITICAL": "🔴", "ERROR": "🟠", "WARNING": "🟡", "INFO": "🔵"}[level.value]
                lines.append(f"### {icon} {level.value}")
                lines.append("")
                for topic_name, anomaly in level_anomalies:
                    lines.append(f"- **{topic_name}** - `{anomaly.rule_name}`: {anomaly.message}")
                lines.append("")

        with open(file_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
