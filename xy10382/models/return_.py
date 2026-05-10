from dataclasses import dataclass, asdict
from typing import Optional
from datetime import datetime
import uuid


@dataclass
class ReturnItem:
    id: str
    farmer_id: str
    sale_id: str
    return_date: str
    product_name: str
    quantity: float
    unit_price: float
    amount: float
    reason: str = ''
    remark: str = ''
    created_at: str = ''

    @classmethod
    def from_dict(cls, data: dict) -> 'ReturnItem':
        quantity = float(data['quantity'])
        unit_price = float(data['unit_price'])
        amount = float(data.get('amount') or (quantity * unit_price))
        return cls(
            id=data.get('id') or str(uuid.uuid4()),
            farmer_id=data['farmer_id'],
            sale_id=data['sale_id'],
            return_date=data['return_date'],
            product_name=data['product_name'],
            quantity=quantity,
            unit_price=unit_price,
            amount=amount,
            reason=data.get('reason', ''),
            remark=data.get('remark', ''),
            created_at=data.get('created_at', datetime.now().isoformat())
        )

    def to_dict(self) -> dict:
        return asdict(self)
