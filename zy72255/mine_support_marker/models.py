from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class ProcessingStatus(Enum):
    IMPORTED = "imported"
    CAD_LAYER_REVIEWED = "cad_layer_reviewed"
    PATH_REPLAY_UPDATED = "path_replay_updated"
    Z_AXIS_FLAGGED = "z_axis_flagged"
    FIELD_TEAM_CONFIRMED = "field_team_confirmed"
    FIELD_TEAM_REJECTED = "field_team_rejected"


class ZAxisConvention(Enum):
    STANDARD = "standard"
    OLD_REVERSED = "old_reversed"


@dataclass
class ChangeEntry:
    field_name: str
    old_value: Any
    new_value: Any
    changed_by: str
    changed_at: datetime = field(default_factory=datetime.now)
    reason: str = ""

    def to_dict(self) -> dict:
        return {
            "field_name": self.field_name,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "changed_by": self.changed_by,
            "changed_at": self.changed_at.isoformat(),
            "reason": self.reason,
        }


@dataclass
class MarkerRecord:
    marker_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    photo_number: str = ""
    original_line_number: int = 0
    cad_layer_name: str = ""
    z_axis_value: float = 0.0
    z_axis_convention: ZAxisConvention = ZAxisConvention.STANDARD
    z_axis_flagged_for_review: bool = False
    conclusion: str = ""
    remark: str = ""
    status: ProcessingStatus = ProcessingStatus.IMPORTED
    import_batch_id: str = ""
    confirmed_fields: set = field(default_factory=set)
    change_history: list[ChangeEntry] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    @property
    def identity_key(self) -> str:
        return f"{self.photo_number}::{self.import_batch_id}"

    def apply_change(
        self,
        field_name: str,
        new_value: Any,
        changed_by: str,
        reason: str = "",
    ) -> ChangeEntry:
        old_value = getattr(self, field_name)
        entry = ChangeEntry(
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            changed_by=changed_by,
            reason=reason,
        )
        self.change_history.append(entry)
        setattr(self, field_name, new_value)
        self.updated_at = datetime.now()
        return entry

    def get_history_for_field(self, field_name: str) -> list[ChangeEntry]:
        return [e for e in self.change_history if e.field_name == field_name]

    def is_field_confirmed(self, field_name: str) -> bool:
        return field_name in self.confirmed_fields

    def confirm_field(self, field_name: str) -> None:
        self.confirmed_fields.add(field_name)

    def to_dict(self) -> dict:
        return {
            "marker_id": self.marker_id,
            "photo_number": self.photo_number,
            "original_line_number": self.original_line_number,
            "cad_layer_name": self.cad_layer_name,
            "z_axis_value": self.z_axis_value,
            "z_axis_convention": self.z_axis_convention.value,
            "z_axis_flagged_for_review": self.z_axis_flagged_for_review,
            "conclusion": self.conclusion,
            "remark": self.remark,
            "status": self.status.value,
            "import_batch_id": self.import_batch_id,
            "confirmed_fields": list(self.confirmed_fields),
            "change_history": [e.to_dict() for e in self.change_history],
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
