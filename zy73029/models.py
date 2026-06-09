from datetime import datetime
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field, asdict
import uuid
import json


def _now_iso() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


@dataclass
class WeChatNote:
    raw_text: str
    has_retract: bool = False
    retract_snippet: str = ""
    recorded_at: str = field(default_factory=_now_iso)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "WeChatNote":
        return cls(**d)


@dataclass
class DosageRecord:
    drug_name: str
    dose: str
    frequency: str
    recorded_at: str = field(default_factory=_now_iso)
    source: str = "original"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "DosageRecord":
        return cls(**d)


FLAG_LEVEL_INFO = "info"
FLAG_LEVEL_WARNING = "warning"
FLAG_LEVEL_BLOCKER = "blocker"

FLAG_TYPE_NOTE_ALIGNMENT = "note_alignment"
FLAG_TYPE_DOSAGE_CHANGED = "dosage_changed"
FLAG_TYPE_RETRACT_IN_NOTE = "retract_in_note"
FLAG_TYPE_MANUAL_OVERRIDE = "manual_override"


@dataclass
class Flag:
    flag_id: str = field(default_factory=_new_id)
    flag_type: str = FLAG_LEVEL_INFO
    level: str = FLAG_LEVEL_INFO
    title: str = ""
    detail: str = ""
    blocked_fields: List[str] = field(default_factory=list)
    created_at: str = field(default_factory=_now_iso)
    resolved: bool = False
    resolved_by: str = ""
    resolved_at: str = ""
    resolution_note: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Flag":
        return cls(**d)


@dataclass
class OverrideRecord:
    override_id: str = field(default_factory=_new_id)
    operator: str = ""
    old_status: str = ""
    new_status: str = ""
    reason: str = ""
    created_at: str = field(default_factory=_now_iso)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "OverrideRecord":
        return cls(**d)


STATUS_PENDING = "pending"
STATUS_ALIGNED = "aligned"
STATUS_FLAGGED = "flagged"
STATUS_BLOCKED = "blocked"
STATUS_CLOSED = "closed"


@dataclass
class TempControlRecord:
    record_id: str = field(default_factory=_new_id)
    pet_name: str = ""
    pet_type: str = ""
    owner_name: str = ""
    owner_contact: str = ""

    original_temp: float = 0.0
    target_temp_min: float = 0.0
    target_temp_max: float = 0.0
    current_temp: float = 0.0

    status: str = STATUS_PENDING

    wechat_notes: List[WeChatNote] = field(default_factory=list)
    dosages: List[DosageRecord] = field(default_factory=list)
    flags: List[Flag] = field(default_factory=list)
    overrides: List[OverrideRecord] = field(default_factory=list)

    timeline: List[Dict[str, Any]] = field(default_factory=list)

    created_at: str = field(default_factory=_now_iso)
    updated_at: str = field(default_factory=_now_iso)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "pet_name": self.pet_name,
            "pet_type": self.pet_type,
            "owner_name": self.owner_name,
            "owner_contact": self.owner_contact,
            "original_temp": self.original_temp,
            "target_temp_min": self.target_temp_min,
            "target_temp_max": self.target_temp_max,
            "current_temp": self.current_temp,
            "status": self.status,
            "wechat_notes": [n.to_dict() for n in self.wechat_notes],
            "dosages": [d.to_dict() for d in self.dosages],
            "flags": [f.to_dict() for f in self.flags],
            "overrides": [o.to_dict() for o in self.overrides],
            "timeline": self.timeline,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "TempControlRecord":
        rec = cls(
            record_id=d["record_id"],
            pet_name=d.get("pet_name", ""),
            pet_type=d.get("pet_type", ""),
            owner_name=d.get("owner_name", ""),
            owner_contact=d.get("owner_contact", ""),
            original_temp=d.get("original_temp", 0.0),
            target_temp_min=d.get("target_temp_min", 0.0),
            target_temp_max=d.get("target_temp_max", 0.0),
            current_temp=d.get("current_temp", 0.0),
            status=d.get("status", STATUS_PENDING),
            created_at=d.get("created_at", _now_iso()),
            updated_at=d.get("updated_at", _now_iso()),
        )
        rec.wechat_notes = [WeChatNote.from_dict(n) for n in d.get("wechat_notes", [])]
        rec.dosages = [DosageRecord.from_dict(x) for x in d.get("dosages", [])]
        rec.flags = [Flag.from_dict(f) for f in d.get("flags", [])]
        rec.overrides = [OverrideRecord.from_dict(o) for o in d.get("overrides", [])]
        rec.timeline = d.get("timeline", [])
        return rec

    def append_timeline(self, event_type: str, message: str, operator: str = "system", extra: Optional[Dict[str, Any]] = None):
        evt = {
            "event_id": _new_id(),
            "event_type": event_type,
            "message": message,
            "operator": operator,
            "timestamp": _now_iso(),
        }
        if extra:
            evt.update(extra)
        self.timeline.append(evt)
        self.updated_at = _now_iso()
