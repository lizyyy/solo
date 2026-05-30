from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List
import uuid

from src.config import REVIEW_STATUS, SOURCE_TYPE


@dataclass
class SourceReference:
    source_type: str
    source_id: str
    source_field: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "source_type": self.source_type,
            "source_type_name": SOURCE_TYPE.get(self.source_type, self.source_type),
            "source_id": self.source_id,
            "source_field": self.source_field
        }


@dataclass
class MarginRecord:
    margin_id: str
    counterparty: str
    calculation_date: str
    required_margin: float
    actual_margin: float
    margin_shortfall: float
    margin_excess: float
    review_status: str
    source_references: List[SourceReference] = field(default_factory=list)
    manual_override: bool = False
    override_reason: Optional[str] = None
    override_source: Optional[str] = None
    next_follow_up: Optional[str] = None
    calculated_by: str = "system"
    calculated_at: datetime = field(default_factory=datetime.now)
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    remarks: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "MarginRecord":
        source_refs = []
        if data.get("source_references"):
            for ref in data["source_references"]:
                source_refs.append(SourceReference(
                    source_type=ref["source_type"],
                    source_id=ref["source_id"],
                    source_field=ref.get("source_field")
                ))

        return cls(
            margin_id=data.get("margin_id", str(uuid.uuid4())),
            counterparty=data["counterparty"],
            calculation_date=data["calculation_date"],
            required_margin=float(data["required_margin"]),
            actual_margin=float(data.get("actual_margin", 0)),
            margin_shortfall=float(data.get("margin_shortfall", 0)),
            margin_excess=float(data.get("margin_excess", 0)),
            review_status=data.get("review_status", "PENDING"),
            source_references=source_refs,
            manual_override=bool(data.get("manual_override", False)),
            override_reason=data.get("override_reason"),
            override_source=data.get("override_source"),
            next_follow_up=data.get("next_follow_up"),
            calculated_by=data.get("calculated_by", "system"),
            calculated_at=datetime.fromisoformat(data["calculated_at"]) if data.get("calculated_at") else datetime.now(),
            reviewed_by=data.get("reviewed_by"),
            reviewed_at=datetime.fromisoformat(data["reviewed_at"]) if data.get("reviewed_at") else None,
            remarks=data.get("remarks")
        )

    def to_dict(self) -> dict:
        return {
            "margin_id": self.margin_id,
            "counterparty": self.counterparty,
            "calculation_date": self.calculation_date,
            "required_margin": self.required_margin,
            "actual_margin": self.actual_margin,
            "margin_shortfall": self.margin_shortfall,
            "margin_excess": self.margin_excess,
            "review_status": self.review_status,
            "review_status_name": REVIEW_STATUS.get(self.review_status, self.review_status),
            "source_references": [ref.to_dict() for ref in self.source_references],
            "manual_override": self.manual_override,
            "override_reason": self.override_reason,
            "override_source": self.override_source,
            "next_follow_up": self.next_follow_up,
            "calculated_by": self.calculated_by,
            "calculated_at": self.calculated_at.isoformat(),
            "reviewed_by": self.reviewed_by,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "remarks": self.remarks
        }

    def add_source_reference(self, source_type: str, source_id: str, source_field: Optional[str] = None):
        self.source_references.append(SourceReference(
            source_type=source_type,
            source_id=source_id,
            source_field=source_field
        ))
