from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class AuditLog:
    id: Optional[int] = None
    order_id: Optional[int] = None
    action: str = ""
    details: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    created_at: Optional[datetime] = None
    
    @classmethod
    def from_row(cls, row):
        return cls(
            id=row['id'],
            order_id=row['order_id'],
            action=row['action'],
            details=row['details'],
            old_value=row['old_value'],
            new_value=row['new_value'],
            created_at=row['created_at']
        )
    
    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'action': self.action,
            'details': self.details,
            'old_value': self.old_value,
            'new_value': self.new_value,
            'created_at': self.created_at
        }
