from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from .models import (
    AuditLogEntry,
    BladeReport,
    JudgmentChange,
    SupplementaryMaterial,
)


@dataclass
class VersionSnapshot:
    material_id: str = ""
    version: int = 1
    name: str = ""
    content: str = ""
    captured_at: datetime = field(default_factory=datetime.now)


class VersionTracker:
    def __init__(self) -> None:
        self._history: dict[str, list[VersionSnapshot]] = {}

    def capture(self, material: SupplementaryMaterial) -> VersionSnapshot:
        snapshot = VersionSnapshot(
            material_id=material.material_id,
            version=material.version,
            name=material.current_name,
            content=material.content,
        )
        if material.material_id not in self._history:
            self._history[material.material_id] = []
        self._history[material.material_id].append(snapshot)
        return snapshot

    def detect_stance_change(
        self,
        material: SupplementaryMaterial,
    ) -> Optional[JudgmentChange]:
        history = self._history.get(material.material_id, [])
        if len(history) < 1:
            return None
        latest = history[-1]
        changes: list[JudgmentChange] = []
        if latest.name != material.current_name:
            changes.append(
                JudgmentChange(
                    field_name="current_name",
                    old_value=latest.name,
                    new_value=material.current_name,
                    changed_by="",
                    reason="name_renamed",
                )
            )
        if latest.content != material.content:
            changes.append(
                JudgmentChange(
                    field_name="content",
                    old_value=latest.content,
                    new_value=material.content,
                    changed_by="",
                    reason="stance_changed",
                )
            )
        if not changes:
            return None
        primary = changes[0]
        return primary

    def apply_update(
        self,
        material: SupplementaryMaterial,
        new_name: Optional[str] = None,
        new_content: Optional[str] = None,
        operator: str = "",
    ) -> list[JudgmentChange]:
        changes: list[JudgmentChange] = []
        if new_name is not None and new_name != material.current_name:
            changes.append(
                JudgmentChange(
                    field_name="current_name",
                    old_value=material.current_name,
                    new_value=new_name,
                    changed_by=operator,
                )
            )
            material.original_name = material.current_name
            material.current_name = new_name
            material.name_changed = True
        if new_content is not None and new_content != material.content:
            changes.append(
                JudgmentChange(
                    field_name="content",
                    old_value=material.content,
                    new_value=new_content,
                    changed_by=operator,
                )
            )
            material.previous_stance = material.content
            material.content = new_content
            material.stance_changed = True
        if changes:
            material.version += 1
            material.compute_hash()
        self.capture(material)
        return changes

    def get_history(self, material_id: str) -> list[VersionSnapshot]:
        return list(self._history.get(material_id, []))

    def diff_versions(
        self, material_id: str, version_a: int, version_b: int
    ) -> list[JudgmentChange]:
        history = self._history.get(material_id, [])
        snap_a = next((s for s in history if s.version == version_a), None)
        snap_b = next((s for s in history if s.version == version_b), None)
        if not snap_a or not snap_b:
            return []
        changes: list[JudgmentChange] = []
        if snap_a.name != snap_b.name:
            changes.append(
                JudgmentChange(
                    field_name="current_name",
                    old_value=snap_a.name,
                    new_value=snap_b.name,
                )
            )
        if snap_a.content != snap_b.content:
            changes.append(
                JudgmentChange(
                    field_name="content",
                    old_value=snap_a.content,
                    new_value=snap_b.content,
                )
            )
        return changes
