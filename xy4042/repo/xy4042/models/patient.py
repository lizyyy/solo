from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class Patient:
    id: Optional[int] = None
    name: str = ""
    phone: Optional[str] = None
    id_card: Optional[str] = None
    diagnosis: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    @classmethod
    def from_row(cls, row):
        return cls(
            id=row['id'],
            name=row['name'],
            phone=row['phone'],
            id_card=row['id_card'],
            diagnosis=row['diagnosis'],
            notes=row['notes'],
            created_at=row['created_at'],
            updated_at=row['updated_at']
        )
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'phone': self.phone,
            'id_card': self.id_card,
            'diagnosis': self.diagnosis,
            'notes': self.notes,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }
