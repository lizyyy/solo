import os
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, Enum,
    ForeignKey, JSON, Float
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from sqlalchemy import create_engine

Base = declarative_base()


class OperationStatus(str, PyEnum):
    DRAFT = "draft"
    IMPORTED = "imported"
    COMPARED = "compared"
    CHECKED = "checked"
    APPROVED = "approved"
    SIMULATED = "simulated"
    ISSUED = "issued"
    ROLLED_BACK = "rolled_back"
    CANCELLED = "cancelled"


class Operation(Base):
    __tablename__ = "operations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(OperationStatus), default=OperationStatus.DRAFT)
    bay_id = Column(String(100), nullable=False, index=True)
    bay_name = Column(String(255), nullable=False)
    current_version_id = Column(Integer, ForeignKey("setting_versions.id"), nullable=True)
    target_version_id = Column(Integer, ForeignKey("setting_versions.id"), nullable=True)
    topology_id = Column(Integer, ForeignKey("topologies.id"), nullable=True)
    plate_status_id = Column(Integer, ForeignKey("plate_statuses.id"), nullable=True)
    approval_ticket_id = Column(Integer, ForeignKey("approval_tickets.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    current_version = relationship("SettingVersion", foreign_keys=[current_version_id], back_populates="operations_as_current")
    target_version = relationship("SettingVersion", foreign_keys=[target_version_id], back_populates="operations_as_target")
    topology = relationship("Topology", back_populates="operations")
    plate_status = relationship("PlateStatus", back_populates="operations")
    approval_ticket = relationship("ApprovalTicket", foreign_keys=[approval_ticket_id])
    check_results = relationship("CheckResult", back_populates="operation")
    simulation_logs = relationship("SimulationLog", back_populates="operation")


class SettingVersion(Base):
    __tablename__ = "setting_versions"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(100), nullable=False, index=True)
    bay_id = Column(String(100), nullable=False, index=True)
    bay_name = Column(String(255), nullable=False)
    device_type = Column(String(100), nullable=False)
    device_model = Column(String(100), nullable=False)
    manufacturer = Column(String(255), nullable=True)
    effective_date = Column(String(50), nullable=True)
    source_file = Column(String(500), nullable=True)
    source_type = Column(String(50), nullable=False, default="excel")
    created_at = Column(DateTime, default=datetime.utcnow)

    values = relationship("SettingValue", back_populates="version")
    operations_as_current = relationship("Operation", foreign_keys="Operation.current_version_id", back_populates="current_version")
    operations_as_target = relationship("Operation", foreign_keys="Operation.target_version_id", back_populates="target_version")


class SettingValue(Base):
    __tablename__ = "setting_values"

    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("setting_versions.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    value = Column(Text, nullable=False)
    unit = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True, index=True)
    group_name = Column(String(100), nullable=True)
    is_unchanged = Column(Boolean, default=False)
    old_value = Column(Text, nullable=True)

    version = relationship("SettingVersion", back_populates="values")


class Topology(Base):
    __tablename__ = "topologies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    source_file = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    nodes = relationship("TopologyNode", back_populates="topology")
    relations = relationship("TopologyRelation", back_populates="topology")
    operations = relationship("Operation", back_populates="topology")


class TopologyNode(Base):
    __tablename__ = "topology_nodes"

    id = Column(Integer, primary_key=True, index=True)
    topology_id = Column(Integer, ForeignKey("topologies.id"), nullable=False, index=True)
    node_id = Column(String(100), nullable=False, index=True)
    node_type = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    parent_id = Column(String(100), nullable=True, index=True)
    properties = Column(JSON, nullable=True)

    topology = relationship("Topology", back_populates="nodes")


class TopologyRelation(Base):
    __tablename__ = "topology_relations"

    id = Column(Integer, primary_key=True, index=True)
    topology_id = Column(Integer, ForeignKey("topologies.id"), nullable=False, index=True)
    from_node = Column(String(100), nullable=False, index=True)
    to_node = Column(String(100), nullable=False, index=True)
    relation_type = Column(String(100), nullable=False)
    properties = Column(JSON, nullable=True)

    topology = relationship("Topology", back_populates="relations")


class PlateStatus(Base):
    __tablename__ = "plate_statuses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    bay_id = Column(String(100), nullable=False, index=True)
    bay_name = Column(String(255), nullable=False)
    source_file = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    plates = relationship("PlateState", back_populates="plate_status")
    operations = relationship("Operation", back_populates="plate_status")


class PlateState(Base):
    __tablename__ = "plate_states"

    id = Column(Integer, primary_key=True, index=True)
    plate_status_id = Column(Integer, ForeignKey("plate_statuses.id"), nullable=False, index=True)
    plate_id = Column(String(100), nullable=False, index=True)
    plate_name = Column(String(255), nullable=False)
    plate_type = Column(String(100), nullable=False)
    current_state = Column(String(50), nullable=False)
    target_state = Column(String(50), nullable=True)
    sequence = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    bay_id = Column(String(100), nullable=True, index=True)

    plate_status = relationship("PlateStatus", back_populates="plates")


class ApprovalTicket(Base):
    __tablename__ = "approval_tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_no = Column(String(100), nullable=False, unique=True, index=True)
    title = Column(String(255), nullable=False)
    status = Column(String(50), default="pending")
    source_file = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    signatures = relationship("ApprovalSignature", back_populates="ticket")


class ApprovalSignature(Base):
    __tablename__ = "approval_signatures"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("approval_tickets.id"), nullable=False, index=True)
    role = Column(String(100), nullable=False)
    signatory = Column(String(100), nullable=False)
    signed = Column(Boolean, default=False)
    signed_at = Column(String(50), nullable=True)
    comment = Column(Text, nullable=True)
    sequence = Column(Integer, nullable=False)

    ticket = relationship("ApprovalTicket", back_populates="signatures")


class CheckResult(Base):
    __tablename__ = "check_results"

    id = Column(Integer, primary_key=True, index=True)
    operation_id = Column(Integer, ForeignKey("operations.id"), nullable=False, index=True)
    check_type = Column(String(100), nullable=False, index=True)
    passed = Column(Boolean, nullable=False)
    message = Column(Text, nullable=False)
    details = Column(JSON, nullable=True)
    risk_level = Column(String(50), default="medium")
    created_at = Column(DateTime, default=datetime.utcnow)

    operation = relationship("Operation", back_populates="check_results")


class SimulationLog(Base):
    __tablename__ = "simulation_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation_id = Column(Integer, ForeignKey("operations.id"), nullable=False, index=True)
    step = Column(Integer, nullable=False)
    action = Column(String(255), nullable=False)
    target = Column(String(255), nullable=True)
    result = Column(String(50), nullable=False)
    message = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    operation = relationship("Operation", back_populates="simulation_logs")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(100), nullable=False, index=True)
    resource_id = Column(Integer, nullable=True, index=True)
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    user = Column(String(100), nullable=True)


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./relay_protection.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
