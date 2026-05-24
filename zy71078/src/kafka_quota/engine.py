from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .models import (
    Anomaly,
    AnomalyLevel,
    PrefixConflict,
    QuotaReport,
    Team,
    TeamQuotaSummary,
    Topic,
)
from .parser import RetentionParser


class QuotaEngine:
    def __init__(self, teams: List[Team]):
        self.teams = teams
        self._team_by_name = {t.name.lower(): t for t in teams}
        self._build_prefix_index()

    def _build_prefix_index(self):
        self._prefix_to_teams: Dict[str, List[Team]] = defaultdict(list)
        for team in self.teams:
            for prefix in team.topic_prefixes:
                self._prefix_to_teams[prefix].append(team)

    def calculate(self, topics: List[Topic], input_files: Dict[str, str]) -> QuotaReport:
        report = QuotaReport()
        report.input_files = input_files
        report.generated_at = datetime.now().isoformat()
        report.all_topics = topics

        self._assign_teams(topics, report)
        self._detect_prefix_conflicts(topics, report)
        self._merge_owners(topics, report)
        self._apply_topic_rules(topics)
        self._build_team_summaries(report)

        report.total_partitions = sum(t.partitions for t in topics)
        report.unassigned_topics = [t for t in topics if t.assigned_team is None]
        report.assigned_topics = [t for t in topics if t.assigned_team is not None]

        return report

    def _assign_teams(self, topics: List[Topic], report: QuotaReport):
        for topic in topics:
            team = self._find_team_for_topic(topic)
            topic.assigned_team = team

    def _find_team_for_topic(self, topic: Topic) -> Optional[Team]:
        if topic.team_hint:
            hint_lower = topic.team_hint.lower()
            for team in self.teams:
                if team.matches_alias(hint_lower):
                    return team

        matching_teams = []
        for prefix, teams in self._prefix_to_teams.items():
            if topic.name.startswith(prefix):
                matching_teams.extend(teams)

        if matching_teams:
            longest_prefix = ""
            best_team = None
            for team in matching_teams:
                for prefix in team.topic_prefixes:
                    if topic.name.startswith(prefix) and len(prefix) > len(longest_prefix):
                        longest_prefix = prefix
                        best_team = team
            return best_team

        return None

    def _detect_prefix_conflicts(self, topics: List[Topic], report: QuotaReport):
        for prefix, teams in self._prefix_to_teams.items():
            if len(teams) > 1:
                affected_topics = [t for t in topics if t.name.startswith(prefix)]
                if affected_topics:
                    conflict = PrefixConflict(
                        prefix=prefix,
                        teams=teams,
                        topics=affected_topics,
                    )
                    report.prefix_conflicts.append(conflict)

                    for topic in affected_topics:
                        topic.anomalies.append(
                            Anomaly(
                                rule_name="PREFIX_CONFLICT",
                                level=AnomalyLevel.WARNING,
                                message=f"Topic前缀 '{prefix}' 匹配多个团队",
                                details={
                                    "prefix": prefix,
                                    "teams": [t.name for t in teams],
                                },
                            )
                        )

    def _merge_owners(self, topics: List[Topic], report: QuotaReport):
        team_owners: Dict[str, set] = defaultdict(set)
        for topic in topics:
            if topic.assigned_team and topic.owner_hint:
                team_owners[topic.assigned_team.name].add(topic.owner_hint)

        for team_name, owners in team_owners.items():
            team = self._team_by_name.get(team_name.lower())
            if team:
                configured_owners = set(o.lower() for o in team.owners)
                hint_owners_lower = set(o.lower() for o in owners)
                extra_owners = hint_owners_lower - configured_owners
                if extra_owners:
                    issue = {
                        "team": team_name,
                        "unconfigured_owners": list(extra_owners),
                        "source": "topic_owner_hints",
                    }
                    report.owner_merge_issues.append(issue)

    def _apply_topic_rules(self, topics: List[Topic]):
        for topic in topics:
            if topic.assigned_team is None:
                topic.anomalies.append(
                    Anomaly(
                        rule_name="NO_TEAM_ASSIGNED",
                        level=AnomalyLevel.WARNING,
                        message="无法匹配所属团队",
                        details={"topic": topic.name},
                    )
                )
                continue

            team = topic.assigned_team
            if topic.partitions > team.max_partitions_per_topic:
                topic.anomalies.append(
                    Anomaly(
                        rule_name="PARTITIONS_EXCEED_PER_TOPIC",
                        level=AnomalyLevel.ERROR,
                        message=f"分区数 {topic.partitions} 超过单Topic限制 {team.max_partitions_per_topic}",
                        details={
                            "actual": topic.partitions,
                            "limit": team.max_partitions_per_topic,
                        },
                    )
                )

            if topic.retention > team.max_retention:
                actual = RetentionParser.format(topic.retention)
                limit = RetentionParser.format(team.max_retention)
                topic.anomalies.append(
                    Anomaly(
                        rule_name="RETENTION_EXCEED_LIMIT",
                        level=AnomalyLevel.WARNING,
                        message=f"保留时间 {actual} 超过团队限制 {limit}",
                        details={
                            "actual_seconds": topic.retention.total_seconds(),
                            "limit_seconds": team.max_retention.total_seconds(),
                        },
                    )
                )

            if topic.partitions != team.default_partitions:
                topic.anomalies.append(
                    Anomaly(
                        rule_name="NON_STANDARD_PARTITIONS",
                        level=AnomalyLevel.INFO,
                        message=f"分区数 {topic.partitions} 不符合团队默认值 {team.default_partitions}",
                        details={
                            "actual": topic.partitions,
                            "standard": team.default_partitions,
                        },
                    )
                )

            if topic.retention != team.default_retention:
                actual = RetentionParser.format(topic.retention)
                standard = RetentionParser.format(team.default_retention)
                topic.anomalies.append(
                    Anomaly(
                        rule_name="NON_STANDARD_RETENTION",
                        level=AnomalyLevel.INFO,
                        message=f"保留时间 {actual} 不符合团队默认值 {standard}",
                        details={
                            "actual_seconds": topic.retention.total_seconds(),
                            "standard_seconds": team.default_retention.total_seconds(),
                        },
                    )
                )

    def _build_team_summaries(self, report: QuotaReport):
        for team in self.teams:
            team_topics = [t for t in report.all_topics if t.assigned_team == team]
            total_partitions = sum(t.partitions for t in team_topics)

            summary = TeamQuotaSummary(
                team=team,
                topics=team_topics,
                total_partitions=total_partitions,
                partition_quota_used=(total_partitions / team.max_total_partitions * 100)
                if team.max_total_partitions > 0
                else 0,
                over_partition_quota=total_partitions > team.max_total_partitions,
            )

            if summary.over_partition_quota:
                summary.anomalies.append(
                    Anomaly(
                        rule_name="TOTAL_PARTITIONS_EXCEED_QUOTA",
                        level=AnomalyLevel.CRITICAL,
                        message=f"团队总分区数 {total_partitions} 超过配额 {team.max_total_partitions}",
                        details={
                            "actual": total_partitions,
                            "quota": team.max_total_partitions,
                            "used_percent": summary.partition_quota_used,
                        },
                    )
                )
            elif summary.partition_quota_used >= 80:
                summary.anomalies.append(
                    Anomaly(
                        rule_name="PARTITION_QUOTA_WARNING",
                        level=AnomalyLevel.WARNING,
                        message=f"团队分区配额已使用 {summary.partition_quota_used:.1f}%",
                        details={
                            "used_percent": summary.partition_quota_used,
                        },
                    )
                )

            report.team_summaries[team.name] = summary
