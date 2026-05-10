from dataclasses import dataclass, asdict
from typing import Optional
from datetime import datetime
import uuid


@dataclass
class Payment:
    id: str
    farmer_id: str
    payment_date: str
    amount: float
    receipt_no: str
    payment_method: str = '现金'
    remark: str = ''
    created_at: str = ''

    @classmethod
    def from_dict(cls, data: dict) -> 'Payment':
        return cls(
            id=data.get('id') or str(uuid.uuid4()),
            farmer_id=data['farmer_id'],
            payment_date=data['payment_date'],
            amount=float(data['amount']),
            receipt_no=data.get('receipt_no', ''),
            payment_method=data.get('payment_method', '现金'),
            remark=data.get('remark', ''),
            created_at=data.get('created_at', datetime.now().isoformat())
        )

    def to_dict(self) -> dict:
        return asdict(self)
