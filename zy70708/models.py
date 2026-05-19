from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class DNSPreviewTask(Base):
    __tablename__ = "dns_preview_tasks"

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String, index=True, nullable=False)
    record_type = Column(String, nullable=False)
    old_target = Column(Text, nullable=False)
    new_target = Column(Text, nullable=False)
    ttl_strategy = Column(Integer, nullable=False, default=300)
    current_ttl = Column(Integer)
    status = Column(String, default="draft", index=True)
    conclusion = Column(Text)
    risk_level = Column(String)
    risk_reason = Column(Text)
    
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    is_deleted = Column(Boolean, default=False)
    rollback_target = Column(Text)
    
    records = relationship("DNSRecordDiff", back_populates="task")
    operations = relationship("TaskOperationLog", back_populates="task")


class DNSRecordDiff(Base):
    __tablename__ = "dns_record_diffs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("dns_preview_tasks.id"))
    record_name = Column(String, nullable=False)
    record_type = Column(String, nullable=False)
    old_value = Column(Text)
    new_value = Column(Text, nullable=False)
    old_ttl = Column(Integer)
    new_ttl = Column(Integer, nullable=False)
    diff_status = Column(String)
    ttl_risk = Column(Boolean, default=False)
    ttl_risk_reason = Column(Text)
    
    task = relationship("DNSPreviewTask", back_populates="records")


class TaskOperationLog(Base):
    __tablename__ = "task_operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("dns_preview_tasks.id"))
    operation = Column(String, nullable=False)
    operator = Column(String, nullable=False)
    original_input = Column(Text)
    conclusion = Column(Text)
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    task = relationship("DNSPreviewTask", back_populates="operations")
