from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

from .models import CompatibilityReport, CompatEntry, Author, RiskLevel


_RISK_ACTIONS = {
    RiskLevel.critical: "必须迁移API才能在新版本运行",
    RiskLevel.high: "建议尽快迁移已弃用API",
    RiskLevel.medium: "关注弃用通知并计划迁移",
}

_NOTIFIABLE_RISK_LEVELS = {RiskLevel.critical, RiskLevel.high, RiskLevel.medium}


@dataclass
class AffectedPlugin:
    plugin_id: str
    risk_level: RiskLevel
    broken_apis: List[str] = field(default_factory=list)
    required_actions: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "plugin_id": self.plugin_id,
            "risk_level": self.risk_level.value,
            "broken_apis": list(self.broken_apis),
            "required_actions": list(self.required_actions),
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "AffectedPlugin":
        risk_level = d["risk_level"]
        if isinstance(risk_level, str):
            risk_level = RiskLevel(risk_level)
        return cls(
            plugin_id=d["plugin_id"],
            risk_level=risk_level,
            broken_apis=d.get("broken_apis", []),
            required_actions=d.get("required_actions", []),
        )


@dataclass
class AuthorNotification:
    author_id: str
    author_name: str
    author_email: str
    affected_plugins: List[AffectedPlugin] = field(default_factory=list)
    notification_id: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "author_id": self.author_id,
            "author_name": self.author_name,
            "author_email": self.author_email,
            "affected_plugins": [ap.to_dict() for ap in self.affected_plugins],
            "notification_id": self.notification_id,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "AuthorNotification":
        affected = []
        for ap in d.get("affected_plugins", []):
            if isinstance(ap, dict):
                affected.append(AffectedPlugin.from_dict(ap))
            elif isinstance(ap, AffectedPlugin):
                affected.append(ap)
        return cls(
            author_id=d["author_id"],
            author_name=d["author_name"],
            author_email=d["author_email"],
            affected_plugins=affected,
            notification_id=d.get("notification_id", ""),
        )


class AuthorNotifier:
    def generate_notifications(
        self, report: CompatibilityReport, authors: List[Author]
    ) -> List[AuthorNotification]:
        author_map: Dict[str, Author] = {}
        for a in authors:
            author_map[a.author_id] = a

        plugin_author_map: Dict[str, str] = {}
        for a in authors:
            for pid in a.plugin_ids:
                plugin_author_map[pid] = a.author_id

        author_entries: Dict[str, List[CompatEntry]] = {}
        for entry in report.entries:
            if entry.risk_level not in _NOTIFIABLE_RISK_LEVELS:
                continue
            author_id = plugin_author_map.get(entry.plugin_id)
            if author_id is None:
                continue
            if author_id not in author_entries:
                author_entries[author_id] = []
            author_entries[author_id].append(entry)

        notifications: List[AuthorNotification] = []
        for author_id, entries in author_entries.items():
            author = author_map.get(author_id)
            if author is None:
                continue

            affected_plugins: List[AffectedPlugin] = []
            for entry in entries:
                actions: List[str] = []
                if entry.risk_level in _RISK_ACTIONS:
                    actions.append(_RISK_ACTIONS[entry.risk_level])
                if not entry.test_coverage:
                    actions.append("建议补充测试覆盖")
                affected_plugins.append(
                    AffectedPlugin(
                        plugin_id=entry.plugin_id,
                        risk_level=entry.risk_level,
                        broken_apis=entry.broken_apis,
                        required_actions=actions,
                    )
                )

            notification_id = f"{report.report_id}__{author_id}"
            notifications.append(
                AuthorNotification(
                    author_id=author.author_id,
                    author_name=author.name,
                    author_email=author.email,
                    affected_plugins=affected_plugins,
                    notification_id=notification_id,
                )
            )

        return notifications
