from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Enum as SAEnum, Boolean, Index
)
from sqlalchemy.sql import func
import enum

from .database import Base


class TaskStatus(str, enum.Enum):
    PROCESSING = "processing"
    FAILED = "failed"
    MANUAL_CONFIRM = "manual_confirm"
    EXPORTED = "exported"


class Conclusion(str, enum.Enum):
    PENDING = "pending"
    PENDING_EVIDENCE = "pending_evidence"
    PASSED = "passed"
    REWORK_REQUIRED = "rework_required"


class Node(str, enum.Enum):
    HYDRO_ELECTRIC = "hydro_electric"
    MASONRY_CARPENTRY = "masonry_carpentry"
    PAINTING = "painting"


class AcceptanceBatch(Base):
    __tablename__ = "acceptance_batches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_no = Column(String(64), unique=True, nullable=False)
    project_name = Column(String(128), nullable=False)
    supervisor = Column(String(64), nullable=False)
    node = Column(SAEnum(Node), nullable=False)
    status = Column(SAEnum(TaskStatus), default=TaskStatus.PROCESSING, nullable=False)
    conclusion = Column(SAEnum(Conclusion), default=Conclusion.PENDING, nullable=False)
    raw_payload = Column(Text, nullable=False)
    payload_hash = Column(String(64), unique=True, nullable=False)
    photos = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_batch_status", "status"),
        Index("ix_batch_node_status", "node", "status"),
    )


class ReworkStat(Base):
    __tablename__ = "rework_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    node = Column(SAEnum(Node), unique=True, nullable=False)
    rework_count = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(Integer, nullable=False, index=True)
    batch_no = Column(String(64), nullable=False)
    field_name = Column(String(64), nullable=False)
    old_value = Column(String(256), nullable=True)
    new_value = Column(String(256), nullable=True)
    operator = Column(String(64), nullable=False)
    reason = Column(String(256), nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class ExportRecord(Base):
    __tablename__ = "export_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(Integer, unique=True, nullable=False, index=True)
    operator = Column(String(64), nullable=False)
    report_path = Column(String(256), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
