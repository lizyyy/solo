from sqlalchemy import Column, Integer, String, Enum, Text, Boolean
from .base import Base, TimestampMixin
from .exceptions import AnomalyType

class ImportError(Base, TimestampMixin):
    __tablename__ = "import_errors"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    import_batch_id = Column(String(100), nullable=False, index=True)
    source_file = Column(String(500))
    source_line = Column(Integer)
    raw_data = Column(Text, nullable=False)
    error_type = Column(Enum(AnomalyType), nullable=False)
    error_message = Column(Text, nullable=False)
    suggestion = Column(Text)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(String(100))
    resolved_at = Column(Integer)
    remarks = Column(Text)
    
    def __repr__(self):
        return f"<ImportError {self.source_file}:{self.source_line} - {self.error_type}>"
    
    def to_dict(self):
        return {
            "id": self.id,
            "import_batch_id": self.import_batch_id,
            "source_file": self.source_file,
            "source_line": self.source_line,
            "raw_data": self.raw_data,
            "error_type": self.error_type.value,
            "error_message": self.error_message,
            "suggestion": self.suggestion,
            "is_resolved": self.is_resolved,
            "resolved_by": self.resolved_by,
            "resolved_at": self.resolved_at,
            "remarks": self.remarks,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
