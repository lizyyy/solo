from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List

from .base import BaseEntity
from .enums import CheckStatus


@dataclass
class Violation(BaseEntity):
    violation_type: str = ""
    check_status: CheckStatus = CheckStatus.ERROR
    severity: str = "high"
    description: str = ""
    prop_id: Optional[str] = None
    prop_name: Optional[str] = None
    scene_id: Optional[str] = None
    scene_title: Optional[str] = None
    handover_id: Optional[str] = None
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None
    related_entities: List[str] = field(default_factory=list)
    detected_at: datetime = field(default_factory=datetime.now)
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    resolved_by: str = ""
    resolution_notes: str = ""
    metadata: dict = field(default_factory=dict)

    def __post_init__(self):
        super().__post_init__()

    def resolve(self, resolved_by: str, notes: str = "") -> None:
        self.resolved = True
        self.resolved_at = datetime.now()
        self.resolved_by = resolved_by
        self.resolution_notes = notes
        self.updated_at = datetime.now()

    @property
    def summary(self) -> str:
        parts = [f"[{self.severity.upper()}] {self.violation_type}"]
        if self.prop_name:
            parts.append(f"道具: {self.prop_name}")
        if self.scene_title:
            parts.append(f"场次: {self.scene_title}")
        if self.actor_name:
            parts.append(f"演员: {self.actor_name}")
        parts.append(f"描述: {self.description}")
        return " | ".join(parts)
