from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class RiskType(str, enum.Enum):
    NORMAL = "normal"
    TIMEZONE_OFFSET = "timezone_offset"
    SUSPICIOUS = "suspicious"
    HIGH_RISK = "high_risk"


class OperationType(str, enum.Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    MANUAL_CORRECT = "manual_correct"
    ROLLBACK = "rollback"
    BATCH_CLEAN = "batch_clean"


class SourceSystem(str, enum.Enum):
    CUSTOMER_SERVICE = "customer_service"
    CLOUD_RESOURCE = "cloud_resource"
    ADMIN_PORTAL = "admin_portal"


class RuleVersion(Base):
    __tablename__ = "rule_versions"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(50), unique=True, index=True, nullable=False)
    rule_content = Column(JSON, nullable=False)
    description = Column(Text)
    effective_time = Column(DateTime, nullable=False)
    expire_time = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_by = Column(String(100))
    created_at = Column(DateTime, server_default=func.now())

    work_orders = relationship("WorkOrder", back_populates="rule_version")


class WorkOrder(Base):
    __tablename__ = "work_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(100), unique=True, index=True, nullable=False)
    batch_no = Column(String(100), index=True)
    source_system = Column(String(50), default=SourceSystem.CUSTOMER_SERVICE)
    source_order_id = Column(String(100))

    customer_id = Column(String(100), index=True)
    customer_name = Column(String(200))
    service_type = Column(String(100))
    priority = Column(String(50))
    title = Column(String(500))
    description = Column(Text)

    original_input = Column(JSON, nullable=False)

    risk_type = Column(String(50), index=True)
    risk_score = Column(Float)
    is_abnormal = Column(Boolean, default=False)
    timezone_offset = Column(Integer)
    timezone_abnormal = Column(Boolean, default=False)

    system_judgment = Column(String(500))
    manual_judgment = Column(String(500))
    judgment_remark = Column(Text)
    final_judgment = Column(String(500))
    judged_by = Column(String(100))
    judged_at = Column(DateTime)

    rule_version_id = Column(Integer, ForeignKey("rule_versions.id"))
    rule_snapshot = Column(JSON)

    status = Column(String(50), default="pending")
    created_by = Column(String(100))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    rule_version = relationship("RuleVersion", back_populates="work_orders")
    operation_logs = relationship("OperationLog", back_populates="work_order")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"))
    batch_no = Column(String(100), index=True)
    operation_type = Column(String(50), index=True)
    operator = Column(String(100), index=True)
    operation_remark = Column(Text)
    before_data = Column(JSON)
    after_data = Column(JSON)
    source_system = Column(String(50))
    change_reason = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    work_order = relationship("WorkOrder", back_populates="operation_logs")


class CleanCandidate(Base):
    __tablename__ = "clean_candidates"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(100), index=True, unique=True)
    candidate_ids = Column(JSON, nullable=False)
    filters = Column(JSON)
    total_count = Column(Integer)
    generated_by = Column(String(100))
    is_executed = Column(Boolean, default=False)
    executed_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
