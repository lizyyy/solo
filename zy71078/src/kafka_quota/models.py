from __future__ import annotations

from dataclasses import dataclass, field
from datetime import timedelta
from enum import Enum
from typing import Dict, List, Optional


class AnomalyLevel(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


@dataclass
class Team:
    name: str
    aliases: List[str] = field(default_factory=list)
    owners: List[str] = field(default_factory=list)
    topic_prefixes: List[str] = field(default_factory=list)
    default_partitions: int = 6
    default_retention: timedelta = field(default_factory=lambda: timedelta(days=7))
    max_partitions_per_topic: int = 24
    max_total_partitions: int = 1000
    max_retention: timedelta = field(default_factory=lambda: timedelta(days=30))

    def matches_alias(self, alias: str) -> bool:
        alias_lower = alias.lower()
        return (
            alias_lower == self.name.lower()
            or alias_lower in [a.lower() for a in self.aliases]
        )

    def matches_topic_prefix(self, topic_name: str) -> bool:
        return any(topic_name.startswith(prefix) for prefix in self.topic_prefixes)


@dataclass
class Topic:
    name: str
    partitions: int
    retention: timedelta
    team_hint: Optional[str] = None
    owner_hint: Optional[str] = None
    assigned_team: Optional[Team] = None
    anomalies: List[Anomaly] = field(default_factory=list)

    @property
    def retention_hours(self) -> float:
        return self.retention.total_seconds() / 3600

    @property
    def retention_days(self) -> float:
        return self.retention.total_seconds() / 86400


@dataclass
class QuotaRule:
    name: str
    description: str
    level: AnomalyLevel
    check_fn: str


@dataclass
class Anomaly:
    rule_name: str
    level: AnomalyLevel
    message: str
    details: Dict = field(default_factory=dict)


@dataclass
class TeamQuotaSummary:
    team: Team
    topics: List[Topic] = field(default_factory=list)
    total_partitions: int = 0
    partition_quota_used: float = 0.0
    over_partition_quota: bool = False
    anomalies: List[Anomaly] = field(default_factory=list)

    @property
    def topic_count(self) -> int:
        return len(self.topics)


@dataclass
class PrefixConflict:
    prefix: str
    teams: List[Team]
    topics: List[Topic]


@dataclass
class QuotaReport:
    all_topics: List[Topic] = field(default_factory=list)
    assigned_topics: List[Topic] = field(default_factory=list)
    unassigned_topics: List[Topic] = field(default_factory=list)
    team_summaries: Dict[str, TeamQuotaSummary] = field(default_factory=dict)
    prefix_conflicts: List[PrefixConflict] = field(default_factory=list)
    owner_merge_issues: List[Dict] = field(default_factory=list)
    total_partitions: int = 0
    generated_at: str = ""
    input_files: Dict = field(default_factory=dict)

    @property
    def anomaly_counts(self) -> Dict[AnomalyLevel, int]:
        counts = {level: 0 for level in AnomalyLevel}
        for topic in self.all_topics:
            for anomaly in topic.anomalies:
                counts[anomaly.level] += 1
        for summary in self.team_summaries.values():
            for anomaly in summary.anomalies:
                counts[anomaly.level] += 1
        return counts

    @property
    def has_errors(self) -> bool:
        counts = self.anomaly_counts
        return counts[AnomalyLevel.ERROR] > 0 or counts[AnomalyLevel.CRITICAL] > 0
