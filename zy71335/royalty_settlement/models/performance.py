from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import date, datetime
from .base import BaseModel, AuditLog, Attachment, Correction
from .track import Track
from .fee import PlatformFee


@dataclass
class PerformanceSheet(BaseModel):
    performance_name: str = ""
    performance_date: Optional[date] = None
    venue: str = ""
    total_box_office: float = 0.0
    tracks: List[Track] = field(default_factory=list)
    platform_fees: List[PlatformFee] = field(default_factory=list)
    audit_logs: List[AuditLog] = field(default_factory=list)
    attachments: List[Attachment] = field(default_factory=list)
    corrections: List[Correction] = field(default_factory=list)
    operator: str = ""
    notes: str = ""

    def total_duration(self) -> int:
        return sum(t.total_duration() for t in self.tracks)

    def validate(self) -> List[str]:
        errors = []
        if not self.performance_name:
            errors.append("演出名称不能为空")
        if not self.performance_date:
            errors.append("演出日期不能为空")
        if self.total_box_office < 0:
            errors.append("票房收入不能为负数")
        if not self.tracks:
            errors.append("演出曲目列表不能为空")
        for track in self.tracks:
            errors.extend(track.validate())
        for fee in self.platform_fees:
            errors.extend(fee.validate())
        return errors

    def add_audit_log(self, action: str, operator: str, details: str = "",
                      before: Optional[Dict[str, Any]] = None,
                      after: Optional[Dict[str, Any]] = None):
        self.audit_logs.append(AuditLog(
            action=action,
            operator=operator,
            details=details,
            before=before,
            after=after,
        ))
        self.updated_at = datetime.now()

    def to_dict(self):
        data = super().to_dict()
        data["performance_date"] = self.performance_date.isoformat() if self.performance_date else None
        data["tracks"] = [t.to_dict() for t in self.tracks]
        data["platform_fees"] = [f.to_dict() for f in self.platform_fees]
        data["audit_logs"] = [a.to_dict() for a in self.audit_logs]
        data["attachments"] = [a.to_dict() for a in self.attachments]
        data["corrections"] = [c.to_dict() for c in self.corrections]
        return data

    @classmethod
    def from_dict(cls, data: dict) -> "PerformanceSheet":
        from datetime import date as date_cls
        return cls(
            id=data.get("id", cls.id.default_factory()),
            performance_name=data.get("performance_name", ""),
            performance_date=date_cls.fromisoformat(data["performance_date"]) if data.get("performance_date") else None,
            venue=data.get("venue", ""),
            total_box_office=float(data.get("total_box_office", 0.0)),
            tracks=[Track.from_dict(t) for t in data.get("tracks", [])],
            platform_fees=[PlatformFee.from_dict(f) for f in data.get("platform_fees", [])],
            audit_logs=[AuditLog(**a) for a in data.get("audit_logs", [])],
            attachments=[Attachment(**a) for a in data.get("attachments", [])],
            corrections=[Correction(**c) for c in data.get("corrections", [])],
            operator=data.get("operator", ""),
            notes=data.get("notes", ""),
        )
