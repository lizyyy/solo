import json
import hashlib
from datetime import datetime
from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any, List


@dataclass
class PromptVersion:
    template_name: str
    version_id: str
    content: str
    publisher: str
    publish_time: str
    description: str = ""
    is_active: bool = True
    traffic_weight: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def content_hash(self) -> str:
        return hashlib.md5(self.content.encode()).hexdigest()[:8]


@dataclass
class TrafficAllocation:
    template_name: str
    allocations: Dict[str, int]
    update_time: str
    operator: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def validate(self) -> bool:
        total = sum(self.allocations.values())
        return total == 100 or total == 0


@dataclass
class HitRecord:
    request_id: str
    template_name: str
    version_id: str
    hit_time: str
    request_hash: str
    metadata: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class RollbackEvent:
    template_name: str
    from_version: str
    to_version: str
    rollback_time: str
    operator: str
    reason: str
    rollback_id: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class VersionSummary:
    def __init__(self, template_name: str):
        self.template_name = template_name
        self.versions: List[PromptVersion] = []
        self.traffic_history: List[TrafficAllocation] = []
        self.hit_records: List[HitRecord] = []
        self.rollback_events: List[RollbackEvent] = []
        self.created_at = datetime.now().isoformat()

    def add_version(self, version: PromptVersion) -> None:
        self.versions.append(version)

    def add_traffic_allocation(self, allocation: TrafficAllocation) -> None:
        self.traffic_history.append(allocation)

    def add_hit_record(self, hit: HitRecord) -> None:
        self.hit_records.append(hit)

    def add_rollback_event(self, rollback: RollbackEvent) -> None:
        self.rollback_events.append(rollback)

    def get_version_hits(self, version_id: str) -> List[HitRecord]:
        return [h for h in self.hit_records if h.version_id == version_id]

    def get_active_versions(self) -> List[PromptVersion]:
        return [v for v in self.versions if v.is_active]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "template_name": self.template_name,
            "versions": [v.to_dict() for v in self.versions],
            "traffic_history": [t.to_dict() for t in self.traffic_history],
            "hit_records": [h.to_dict() for h in self.hit_records],
            "rollback_events": [r.to_dict() for r in self.rollback_events],
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "VersionSummary":
        summary = cls(data["template_name"])
        summary.created_at = data.get("created_at", datetime.now().isoformat())
        return summary
