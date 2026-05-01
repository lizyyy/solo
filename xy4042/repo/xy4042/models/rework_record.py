from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional


@dataclass
class ReworkRecord:
    id: Optional[int] = None
    order_id: int = 0
    fitting_record_id: int = 0
    rework_reason: str = ""
    rework_details: Optional[str] = None
    technician: Optional[str] = None
    rework_date: Optional[date] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    
    @classmethod
    def from_row(cls, row):
        return cls(
            id=row['id'],
            order_id=row['order_id'],
            fitting_record_id=row['fitting_record_id'],
            rework_reason=row['rework_reason'],
            rework_details=row['rework_details'],
            technician=row['technician'],
            rework_date=row['rework_date'],
            completed_at=row['completed_at'],
            created_at=row['created_at']
        )
    
    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'fitting_record_id': self.fitting_record_id,
            'rework_reason': self.rework_reason,
            'rework_details': self.rework_details,
            'technician': self.technician,
            'rework_date': self.rework_date,
            'completed_at': self.completed_at,
            'created_at': self.created_at
        }
