from dataclasses import dataclass
from datetime import datetime
from typing import Optional
import json


@dataclass
class Measurement:
    id: Optional[int] = None
    order_id: int = 0
    version: int = 1
    dimensions: str = "{}"
    technician: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    
    def get_dimensions_dict(self) -> dict:
        try:
            return json.loads(self.dimensions)
        except (json.JSONDecodeError, TypeError):
            return {}
    
    def set_dimensions_dict(self, dims: dict) -> None:
        self.dimensions = json.dumps(dims, ensure_ascii=False, indent=2)
    
    @classmethod
    def from_row(cls, row):
        return cls(
            id=row['id'],
            order_id=row['order_id'],
            version=row['version'],
            dimensions=row['dimensions'],
            technician=row['technician'],
            notes=row['notes'],
            created_at=row['created_at']
        )
    
    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'version': self.version,
            'dimensions': self.dimensions,
            'technician': self.technician,
            'notes': self.notes,
            'created_at': self.created_at
        }
