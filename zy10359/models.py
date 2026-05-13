import enum
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Enum, Text
from database import Base


class TaskStatus(str, enum.Enum):
    PENDING = "PENDING"
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    GENERATING_PREVIEW = "GENERATING_PREVIEW"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ConversionStage(str, enum.Enum):
    UPLOAD = "upload"
    VALIDATION = "validation"
    TRANSFORMATION = "transformation"
    PREVIEW_GENERATION = "preview_generation"
    FINALIZATION = "finalization"


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False, index=True)
    file_hash = Column(String(64), index=True)
    file_size = Column(Integer)
    file_path = Column(String(512))
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING, index=True)
    handler = Column(String(100), default="system")
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    error_message = Column(Text)
    failed_stage = Column(Enum(ConversionStage))
    preview_url = Column(String(512))
    preview_path = Column(String(512))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime)

    def to_dict(self):
        return {
            "id": self.id,
            "filename": self.filename,
            "file_size": self.file_size,
            "status": self.status.value if self.status else None,
            "handler": self.handler,
            "retry_count": self.retry_count,
            "max_retries": self.max_retries,
            "error_message": self.error_message,
            "failed_stage": self.failed_stage.value if self.failed_stage else None,
            "preview_url": self.preview_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }
