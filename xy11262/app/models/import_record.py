import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, JSON, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class ImportStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"


class ImportType(str, enum.Enum):
    HAZARD_CSV = "hazard_csv"
    PHOTO_JSON = "photo_json"
    REVIEW_RECORD = "review_record"


class ImportRecord(Base):
    __tablename__ = "import_records"

    id = Column(Integer, primary_key=True, index=True)
    import_type = Column(Enum(ImportType), nullable=False)
    status = Column(Enum(ImportStatus), default=ImportStatus.PENDING)
    
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500))
    file_size = Column(Integer)
    
    total_records = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    imported_by = Column(String(100))
    remarks = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    bad_records = relationship("BadRecord", back_populates="import_record", cascade="all, delete-orphan")


class BadRecord(Base):
    __tablename__ = "bad_records"

    id = Column(Integer, primary_key=True, index=True)
    import_record_id = Column(Integer, ForeignKey("import_records.id"), nullable=False)
    
    row_number = Column(Integer)
    original_data = Column(JSON, nullable=False)
    
    error_type = Column(String(100))
    error_message = Column(Text, nullable=False)
    
    suggested_fix = Column(Text)
    field_errors = Column(JSON)
    
    corrected = Column(Integer, default=0)
    correction_notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    import_record = relationship("ImportRecord", back_populates="bad_records")
