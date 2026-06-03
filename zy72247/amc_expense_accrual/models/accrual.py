import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from .evidence import EvidenceRecord


@dataclass
class AccrualLine:
    line_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    business_no: str = ""
    line_type: str = ""
    amount: float = 0.0
    tax_rate: float = 0.0
    tax_amount: float = 0.0
    net_amount: float = 0.0
    evidence: Optional[EvidenceRecord] = None
    is_split_line: bool = False
    split_line_role: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "line_id": self.line_id,
            "business_no": self.business_no,
            "line_type": self.line_type,
            "amount": self.amount,
            "tax_rate": self.tax_rate,
            "tax_amount": self.tax_amount,
            "net_amount": self.net_amount,
            "evidence": self.evidence.to_dict() if self.evidence else None,
            "is_split_line": self.is_split_line,
            "split_line_role": self.split_line_role,
        }


@dataclass
class AccrualResult:
    result_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    plan_name: str = ""
    accrual_date: str = ""
    lines: List[AccrualLine] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "result_id": self.result_id,
            "plan_name": self.plan_name,
            "accrual_date": self.accrual_date,
            "lines": [line.to_dict() for line in self.lines],
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    def get_lines_by_business_no(self, business_no: str) -> List[AccrualLine]:
        return [l for l in self.lines if l.business_no == business_no]

    def total_amount(self) -> float:
        return sum(l.amount for l in self.lines)

    def total_tax(self) -> float:
        return sum(l.tax_amount for l in self.lines)

    def total_net(self) -> float:
        return sum(l.net_amount for l in self.lines)
