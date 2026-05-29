from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime
from .base import BaseModel


class IssueSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class IssueCategory(str, Enum):
    RATIO_ISSUE = "ratio_issue"
    MEDLEY_SPLIT = "medley_split"
    CROSS_PERIOD_FEE = "cross_period_fee"
    DATA_MISSING = "data_missing"
    MANUAL_CORRECTION = "manual_correction"


@dataclass
class Issue:
    category: IssueCategory
    severity: IssueSeverity
    message: str
    reason: str = ""
    affected_items: List[str] = field(default_factory=list)
    impact: str = ""
    next_steps: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "category": self.category.value,
            "severity": self.severity.value,
            "message": self.message,
            "reason": self.reason,
            "affected_items": self.affected_items,
            "impact": self.impact,
            "next_steps": self.next_steps,
        }


@dataclass
class Warning(Issue):
    pass


@dataclass
class SettlementItem:
    track_id: str
    track_name: str
    author_id: str
    author_name: str
    author_role: str
    track_duration_seconds: int
    track_ratio: float
    author_ratio: float
    final_ratio: float
    gross_amount: float
    fee_deduction: float
    net_amount: float
    is_medley: bool = False
    medley_parent: Optional[str] = None
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "track_id": self.track_id,
            "track_name": self.track_name,
            "author_id": self.author_id,
            "author_name": self.author_name,
            "author_role": self.author_role,
            "track_duration_seconds": self.track_duration_seconds,
            "track_ratio": self.track_ratio,
            "author_ratio": self.author_ratio,
            "final_ratio": self.final_ratio,
            "gross_amount": round(self.gross_amount, 2),
            "fee_deduction": round(self.fee_deduction, 2),
            "net_amount": round(self.net_amount, 2),
            "is_medley": self.is_medley,
            "medley_parent": self.medley_parent,
            "notes": self.notes,
        }


@dataclass
class SettlementResult(BaseModel):
    performance_id: str = ""
    performance_name: str = ""
    performance_date: Optional[str] = None
    total_box_office: float = 0.0
    total_fees: float = 0.0
    net_distributable: float = 0.0
    total_duration_seconds: int = 0
    items: List[SettlementItem] = field(default_factory=list)
    issues: List[Issue] = field(default_factory=list)
    warnings: List[Warning] = field(default_factory=list)
    fee_breakdown: Dict[str, float] = field(default_factory=dict)
    author_summary: Dict[str, Dict[str, float]] = field(default_factory=dict)
    generated_at: datetime = field(default_factory=datetime.now)
    operator: str = ""
    notes: str = ""

    def to_dict(self):
        data = super().to_dict()
        data["performance_date"] = self.performance_date
        data["total_box_office"] = round(self.total_box_office, 2)
        data["total_fees"] = round(self.total_fees, 2)
        data["net_distributable"] = round(self.net_distributable, 2)
        data["items"] = [item.to_dict() for item in self.items]
        data["issues"] = [i.to_dict() for i in self.issues]
        data["warnings"] = [w.to_dict() for w in self.warnings]
        data["fee_breakdown"] = {k: round(v, 2) for k, v in self.fee_breakdown.items()}
        data["author_summary"] = {
            k: {kk: round(vv, 2) for kk, vv in v.items()}
            for k, v in self.author_summary.items()
        }
        data["generated_at"] = self.generated_at.isoformat()
        data["notes"] = self.notes
        return data
