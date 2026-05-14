from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class TranscodeTask(Base):
    __tablename__ = "transcode_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(100), unique=True, index=True, nullable=False)
    original_image_url = Column(String(500))
    original_image_name = Column(String(200))
    original_width = Column(Integer)
    original_height = Column(Integer)
    original_size = Column(Integer)
    original_format = Column(String(20))
    
    target_width = Column(Integer)
    target_height = Column(Integer)
    target_format = Column(String(20))
    target_quality = Column(Integer, default=85)
    
    watermark_config = Column(JSON)
    watermark_confirmed = Column(Boolean, default=False)
    
    status = Column(String(50), default="pending")
    queue_position = Column(Integer)
    priority = Column(Integer, default=0)
    
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    last_error = Column(Text)
    
    output_url = Column(String(500))
    output_size = Column(Integer)
    output_width = Column(Integer)
    output_height = Column(Integer)
    
    product_list = Column(JSON)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True))
    
    created_by = Column(String(100))
    approved_by = Column(String(100))
    approved_at = Column(DateTime(timezone=True))
    
    version = Column(Integer, default=1)
    parent_task_id = Column(Integer, ForeignKey("transcode_tasks.id"))
    
    parent_task = relationship("TranscodeTask", remote_side=[id], backref="versions")
    error_logs = relationship("ErrorLog", back_populates="task")


class ErrorLog(Base):
    __tablename__ = "error_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("transcode_tasks.id"))
    error_message = Column(Text, nullable=False)
    error_stack = Column(Text)
    retry_attempt = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    task = relationship("TranscodeTask", back_populates="error_logs")


class ExportRecord(Base):
    __tablename__ = "export_records"
    
    id = Column(Integer, primary_key=True, index=True)
    export_type = Column(String(50))
    filters = Column(JSON)
    file_path = Column(String(500))
    file_name = Column(String(200))
    record_count = Column(Integer)
    file_size = Column(Integer)
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    task_id = Column(Integer)
    response_data = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True))