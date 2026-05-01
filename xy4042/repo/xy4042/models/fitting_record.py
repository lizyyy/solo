from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional


@dataclass
class FittingRecord:
    id: Optional[int] = None
    order_id: int = 0
    fitting_date: Optional[date] = None
    technician: Optional[str] = None
    feedback: Optional[str] = None
    adjustments: Optional[str] = None
    next_follow_up: Optional[date] = None
    created_at: Optional[datetime] = None
    
    @classmethod
    def from_row(cls, row):
        return cls(
            id=row['id'],
            order_id=row['order_id'],
            fitting_date=row['fitting_date'],
            technician=row['technician'],
            feedback=row['feedback'],
            adjustments=row['adjustments'],
            next_follow_up=row['next_follow_up'],
            created_at=row['created_at']
        )
    
    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'fitting_date': self.fitting_date,
            'technician': self.technician,
            'feedback': self.feedback,
            'adjustments': self.adjustments,
            'next_follow_up': self.next_follow_up,
            'created_at': self.created_at
        }
