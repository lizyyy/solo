from dataclasses import dataclass, asdict, field
from typing import List, Optional
from datetime import datetime
import uuid


@dataclass
class SaleItem:
    product_name: str
    unit: str
    quantity: float
    unit_price: float
    amount: float

    @classmethod
    def from_dict(cls, data: dict) -> 'SaleItem':
        return cls(
            product_name=data['product_name'],
            unit=data.get('unit', '件'),
            quantity=float(data['quantity']),
            unit_price=float(data['unit_price']),
            amount=float(data.get('amount') or (float(data['quantity']) * float(data['unit_price'])))
        )

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Sale:
    id: str
    farmer_id: str
    sale_date: str
    due_date: Optional[str]
    items: List[SaleItem]
    total_amount: float
    remark: str = ''
    created_at: str = ''

    @classmethod
    def from_dict(cls, data: dict) -> 'Sale':
        items = [SaleItem.from_dict(item) for item in data.get('items', [])]
        total_amount = float(data.get('total_amount') or sum(item.amount for item in items))
        return cls(
            id=data.get('id') or str(uuid.uuid4()),
            farmer_id=data['farmer_id'],
            sale_date=data['sale_date'],
            due_date=data.get('due_date'),
            items=items,
            total_amount=total_amount,
            remark=data.get('remark', ''),
            created_at=data.get('created_at', datetime.now().isoformat())
        )

    def to_dict(self) -> dict:
        result = asdict(self)
        result['items'] = [item.to_dict() for item in self.items]
        return result
