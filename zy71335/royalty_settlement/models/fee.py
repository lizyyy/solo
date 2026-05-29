from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum
from datetime import date
from .base import BaseModel, Correction, Attachment


class FeePeriod(str, Enum):
    CURRENT = "current"
    PREVIOUS = "previous"
    NEXT = "next"
    CROSS = "cross"


@dataclass
class PlatformFee(BaseModel):
    fee_type: str = ""
    amount: float = 0.0
    period: FeePeriod = FeePeriod.CURRENT
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    deductions: List["PlatformFee"] = field(default_factory=list)
    corrections: List[Correction] = field(default_factory=list)
    attachments: List[Attachment] = field(default_factory=list)
    notes: str = ""

    def validate(self) -> List[str]:
        errors = []
        if not self.fee_type:
            errors.append("扣费类型不能为空")
        if self.amount < 0:
            errors.append(f"扣费[{self.fee_type}]金额不能为负数")
        if self.period == FeePeriod.CROSS and (not self.period_start or not self.period_end):
            errors.append(f"跨期扣费[{self.fee_type}]必须指定起止日期")
        return errors

    def to_dict(self):
        data = super().to_dict()
        data["period"] = self.period.value
        data["period_start"] = self.period_start.isoformat() if self.period_start else None
        data["period_end"] = self.period_end.isoformat() if self.period_end else None
        data["deductions"] = [d.to_dict() for d in self.deductions]
        data["corrections"] = [c.to_dict() for c in self.corrections]
        data["attachments"] = [a.to_dict() for a in self.attachments]
        return data

    @classmethod
    def from_dict(cls, data: dict) -> "PlatformFee":
        from datetime import date as date_cls
        return cls(
            id=data.get("id", cls.id.default_factory()),
            fee_type=data.get("fee_type", ""),
            amount=float(data.get("amount", 0.0)),
            period=FeePeriod(data.get("period", "current")),
            period_start=date_cls.fromisoformat(data["period_start"]) if data.get("period_start") else None,
            period_end=date_cls.fromisoformat(data["period_end"]) if data.get("period_end") else None,
            deductions=[cls.from_dict(d) for d in data.get("deductions", [])],
            corrections=[Correction(**c) for c in data.get("corrections", [])],
            attachments=[Attachment(**a) for a in data.get("attachments", [])],
            notes=data.get("notes", ""),
        )
