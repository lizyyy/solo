from dataclasses import dataclass, asdict
from typing import Optional
from datetime import datetime
import uuid


@dataclass
class Deduction:
    id: str
    farmer_id: str
    deduction_date: str
    amount: float
    evidence: str
    reason: str
    remark: str = ''
    created_at: str = ''

    @classmethod
    def from_dict(cls, data: dict) -> 'Deduction':
        return cls(
            id=data.get('id') or str(uuid.uuid4()),
            farmer_id=data['farmer_id'],
            deduction_date=data['deduction_date'],
            amount=float(data['amount']),
            evidence=data.get('evidence', ''),
            reason=data.get('reason', ''),
            remark=data.get('remark', ''),
            created_at=data.get('created_at', datetime.now().isoformat())
        )

    def to_dict(self) -> dict:
        return asdict(self)
