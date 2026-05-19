from datetime import datetime, timedelta
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class TrialStatus(str, PyEnum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    EXPIRING = "EXPIRING"
    EXPIRED = "EXPIRED"
    RECYCLING = "RECYCLING"
    RECYCLED = "RECYCLED"
    CLOSED = "CLOSED"


class SourceType(str, PyEnum):
    SALES_PRESALE = "SALES_PRESALE"
    CUSTOMER_SUCCESS = "CUSTOMER_SUCCESS"
    MARKETING_CAMPAIGN = "MARKETING_CAMPAIGN"
    SELF_REGISTER = "SELF_REGISTER"
    OTHER = "OTHER"


class FeaturePackage(str, PyEnum):
    AI_ANALYTICS = "AI_ANALYTICS"
    DATA_EXPORT = "DATA_EXPORT"
    ADVANCED_REPORT = "ADVANCED_REPORT"
    API_ACCESS = "API_ACCESS"
    TEAM_COLLAB = "TEAM_COLLAB"


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, unique=True, index=True, nullable=False)
    tenant_name = Column(String)
    contact_email = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    trials = relationship("TrialRecord", back_populates="tenant", cascade="all, delete-orphan")


class TrialRecord(Base):
    __tablename__ = "trial_records"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.tenant_id"), nullable=False)
    feature_package = Column(String, nullable=False)
    status = Column(String, default=TrialStatus.PENDING.value)
    trial_days = Column(Integer, nullable=False)
    start_date = Column(DateTime, default=datetime.utcnow)
    end_date = Column(DateTime)
    source = Column(String, nullable=False)
    source_id = Column(String, index=True)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    remarks = Column(Text)

    tenant = relationship("Tenant", back_populates="trials")
    recycle_tasks = relationship("RecycleTask", back_populates="trial", cascade="all, delete-orphan")
    snapshots = relationship("EquitySnapshot", back_populates="trial", cascade="all, delete-orphan")
    operation_logs = relationship("OperationLog", back_populates="trial", cascade="all, delete-orphan")

    def calculate_end_date(self):
        if self.start_date and self.trial_days:
            self.end_date = self.start_date + timedelta(days=self.trial_days)

    def is_expired(self):
        if not self.end_date:
            return False
        return datetime.utcnow() > self.end_date

    def is_expiring_soon(self, days_threshold=3):
        if not self.end_date:
            return False
        return datetime.utcnow() + timedelta(days=days_threshold) > self.end_date and not self.is_expired()


class RecycleTask(Base):
    __tablename__ = "recycle_tasks"

    id = Column(Integer, primary_key=True, index=True)
    trial_id = Column(Integer, ForeignKey("trial_records.id"), nullable=False)
    task_status = Column(String, default="PENDING")
    scheduled_time = Column(DateTime)
    executed_time = Column(DateTime)
    executed_by = Column(String)
    result = Column(Text)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    trial = relationship("TrialRecord", back_populates="recycle_tasks")


class EquitySnapshot(Base):
    __tablename__ = "equity_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    trial_id = Column(Integer, ForeignKey("trial_records.id"), nullable=False)
    snapshot_type = Column(String)
    snapshot_data = Column(JSON)
    generated_by = Column(String)
    generated_at = Column(DateTime, default=datetime.utcnow)
    file_path = Column(String)

    trial = relationship("TrialRecord", back_populates="snapshots")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    trial_id = Column(Integer, ForeignKey("trial_records.id"), nullable=False)
    operation_type = Column(String, nullable=False)
    old_status = Column(String)
    new_status = Column(String)
    original_input = Column(JSON)
    operated_by = Column(String, nullable=False)
    conclusion = Column(Text)
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    trial = relationship("TrialRecord", back_populates="operation_logs")
