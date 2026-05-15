from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class RuleVersion(Base):
    __tablename__ = "rule_versions"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(50), unique=True, index=True)
    rule_content = Column(JSON)
    description = Column(String(500))
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(100), unique=True, index=True)
    name = Column(String(200))
    rule_version = Column(String(50), ForeignKey("rule_versions.version"))
    operator = Column(String(100))
    status = Column(String(50))
    source_type = Column(String(100))
    total_count = Column(Integer, default=0)
    abnormal_count = Column(Integer, default=0)
    summary = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    rule = relationship("RuleVersion")


class BusReservation(Base):
    __tablename__ = "bus_reservations"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(100), index=True)
    reservation_id = Column(String(100), index=True)
    employee_id = Column(String(100))
    employee_name = Column(String(100))
    department = Column(String(100))
    bus_route = Column(String(100))
    reservation_date = Column(String(20))
    time_slot = Column(String(50))
    submit_time = Column(DateTime)
    status = Column(String(50))
    is_duplicate = Column(Boolean, default=False)
    raw_data = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


class ComparisonResult(Base):
    __tablename__ = "comparison_results"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(100), index=True)
    record_id = Column(String(100), index=True)
    risk_type = Column(String(100), index=True)
    is_abnormal = Column(Boolean, default=False)
    is_success = Column(Boolean, default=True)
    original_response = Column(JSON)
    replay_response = Column(JSON)
    diff_fields = Column(JSON)
    before_value = Column(Text)
    after_value = Column(Text)
    correction = Column(Text)
    conclusion = Column(Text)
    operator = Column(String(100))
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CandidateList(Base):
    __tablename__ = "candidate_lists"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(100), index=True)
    candidate_type = Column(String(50))
    record_ids = Column(JSON)
    reason = Column(String(500))
    operator = Column(String(100))
    status = Column(String(50), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(100), index=True)
    operation_type = Column(String(100))
    operator = Column(String(100))
    detail = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
