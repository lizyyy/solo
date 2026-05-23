from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Boolean, Float, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class Batch(Base):
    __tablename__ = "batches"

    id = Column(String(36), primary_key=True)
    batch_no = Column(String(64), unique=True, index=True)
    source = Column(String(32), index=True)
    strategy = Column(String(16), default="ignore")
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    status = Column(String(32), default="pending")
    created_by = Column(String(64))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    remark = Column(Text)

    work_orders = relationship("WorkOrder", back_populates="batch")
    audit_logs = relationship("AuditLog", primaryjoin="Batch.id == AuditLog.batch_id")


class WorkOrder(Base):
    __tablename__ = "work_orders"

    id = Column(String(36), primary_key=True)
    order_no = Column(String(64), unique=True, index=True)
    batch_id = Column(String(36), ForeignKey("batches.id"))
    pile_no = Column(String(64), index=True)
    area = Column(String(64), index=True)
    source = Column(String(32), index=True)
    alarm_type = Column(String(128))
    alarm_level = Column(String(32))
    alarm_time = Column(DateTime)
    alarm_content = Column(Text)
    status = Column(String(32), index=True)
    status_before_freeze = Column(String(32))
    fault_duration = Column(Float)
    fault_duration_before = Column(Float)
    handler = Column(String(64))
    reviewer = Column(String(64))
    review_reason = Column(Text)
    manual_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    frozen_at = Column(DateTime)
    archived_at = Column(DateTime)
    extra_data = Column(JSON)

    batch = relationship("Batch", back_populates="work_orders")
    status_transitions = relationship("StatusTransition", back_populates="work_order")
    attachments = relationship("Attachment", back_populates="work_order")
    audit_logs = relationship("AuditLog", back_populates="work_order")


class StatusTransition(Base):
    __tablename__ = "status_transitions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    work_order_id = Column(String(36), ForeignKey("work_orders.id"))
    from_status = Column(String(32))
    to_status = Column(String(32))
    transition_time = Column(DateTime, default=datetime.utcnow)
    operator = Column(String(64))
    reason = Column(Text)
    remark = Column(Text)

    work_order = relationship("WorkOrder", back_populates="status_transitions")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(String(36), primary_key=True)
    work_order_id = Column(String(36), ForeignKey("work_orders.id"))
    file_name = Column(String(255))
    file_path = Column(String(512))
    file_type = Column(String(32))
    file_size = Column(Integer)
    uploaded_by = Column(String(64))
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    remark = Column(Text)

    work_order = relationship("WorkOrder", back_populates="attachments")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(String(36), ForeignKey("batches.id"))
    work_order_id = Column(String(36), ForeignKey("work_orders.id"))
    operation_type = Column(String(32), index=True)
    operator = Column(String(64), index=True)
    operation_time = Column(DateTime, default=datetime.utcnow)
    before_data = Column(JSON)
    after_data = Column(JSON)
    remark = Column(Text)
    ip_address = Column(String(64))

    work_order = relationship("WorkOrder", back_populates="audit_logs")


class AsyncTask(Base):
    __tablename__ = "async_tasks"

    id = Column(String(36), primary_key=True)
    task_type = Column(String(32), index=True)
    status = Column(String(32), index=True)
    batch_id = Column(String(36))
    work_order_id = Column(String(36))
    retry_count = Column(Integer, default=0)
    max_retry = Column(Integer, default=3)
    last_error = Column(Text)
    next_run_time = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    params = Column(JSON)
    result = Column(JSON)


def init_db():
    Base.metadata.create_all(bind=engine)
