from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional


@dataclass
class Order:
    id: Optional[int] = None
    patient_id: int = 0
    order_number: str = ""
    body_part: str = ""
    side: str = ""
    status: str = "待取模"
    impression_date: Optional[date] = None
    technician: Optional[str] = None
    follow_up_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    STATUS_FLOW = {
        "待取模": ["待设计"],
        "待设计": ["待取模", "制作中"],
        "制作中": ["待设计", "待试穿"],
        "待试穿": ["制作中", "需返修", "已交付"],
        "需返修": ["待试穿", "已交付"],
        "已交付": []
    }
    
    def can_transition_to(self, new_status: str) -> bool:
        if self.status == new_status:
            return False
        return new_status in self.STATUS_FLOW.get(self.status, [])
    
    @classmethod
    def from_row(cls, row):
        return cls(
            id=row['id'],
            patient_id=row['patient_id'],
            order_number=row['order_number'],
            body_part=row['body_part'],
            side=row['side'],
            status=row['status'],
            impression_date=row['impression_date'],
            technician=row['technician'],
            follow_up_date=row['follow_up_date'],
            notes=row['notes'],
            created_at=row['created_at'],
            updated_at=row['updated_at']
        )
    
    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'order_number': self.order_number,
            'body_part': self.body_part,
            'side': self.side,
            'status': self.status,
            'impression_date': self.impression_date,
            'technician': self.technician,
            'follow_up_date': self.follow_up_date,
            'notes': self.notes,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }
