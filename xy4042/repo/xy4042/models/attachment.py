from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from pathlib import Path


@dataclass
class Attachment:
    id: Optional[int] = None
    order_id: int = 0
    file_name: str = ""
    original_name: str = ""
    file_path: str = ""
    file_type: str = ""
    file_size: int = 0
    sha256_hash: str = ""
    category: Optional[str] = None
    notes: Optional[str] = None
    is_missing: bool = False
    created_at: Optional[datetime] = None
    
    def is_image(self) -> bool:
        ext = Path(self.original_name).suffix.lower()
        return ext in ['.jpg', '.jpeg', '.png', '.bmp', '.gif']
    
    def is_scan(self) -> bool:
        ext = Path(self.original_name).suffix.lower()
        return ext in ['.stl', '.obj', '.ply']
    
    def get_absolute_path(self) -> Path:
        return Path(self.file_path)
    
    @classmethod
    def from_row(cls, row):
        return cls(
            id=row['id'],
            order_id=row['order_id'],
            file_name=row['file_name'],
            original_name=row['original_name'],
            file_path=row['file_path'],
            file_type=row['file_type'],
            file_size=row['file_size'],
            sha256_hash=row['sha256_hash'],
            category=row['category'],
            notes=row['notes'],
            is_missing=bool(row['is_missing']),
            created_at=row['created_at']
        )
    
    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'file_name': self.file_name,
            'original_name': self.original_name,
            'file_path': self.file_path,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'sha256_hash': self.sha256_hash,
            'category': self.category,
            'notes': self.notes,
            'is_missing': self.is_missing,
            'created_at': self.created_at
        }
