from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Node(Base):
    __tablename__ = "nodes"
    
    id = Column(Integer, primary_key=True, index=True)
    node_id = Column(String(64), unique=True, index=True, nullable=False)
    host = Column(String(255), nullable=False)
    port = Column(Integer, nullable=False)
    role = Column(String(20), default="master")
    master_id = Column(String(64), nullable=True)
    state = Column(String(50), default="connected")
    is_alive = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    slots = relationship("Slot", back_populates="owner_node")


class Slot(Base):
    __tablename__ = "slots"
    
    id = Column(Integer, primary_key=True, index=True)
    slot_number = Column(Integer, unique=True, index=True, nullable=False)
    owner_node_id = Column(String(64), ForeignKey("nodes.node_id"), nullable=True)
    importing_node_id = Column(String(64), nullable=True)
    migrating_node_id = Column(String(64), nullable=True)
    state = Column(String(20), default="stable")
    is_migrating = Column(Boolean, default=False)
    is_importing = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    owner_node = relationship("Node", back_populates="slots", foreign_keys=[owner_node_id])


class Request(Base):
    __tablename__ = "requests"
    
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(64), unique=True, index=True)
    command = Column(String(50), nullable=False)
    key = Column(String(255), nullable=True)
    key_slot = Column(Integer, nullable=True)
    is_read = Column(Boolean, default=True)
    is_write = Column(Boolean, default=False)
    is_lua = Column(Boolean, default=False)
    is_transaction = Column(Boolean, default=False)
    timestamp = Column(DateTime, nullable=False)
    original_data = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)


class FailureEvent(Base):
    __tablename__ = "failure_events"
    
    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(50), nullable=False)
    node_id = Column(String(64), nullable=True)
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime, nullable=False)
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)


class DrillTask(Base):
    __tablename__ = "drill_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="pending")
    
    enable_moved_redirect = Column(Boolean, default=True)
    enable_ask_redirect = Column(Boolean, default=True)
    enable_read_write_routing = Column(Boolean, default=True)
    enable_replication_lag = Column(Boolean, default=False)
    enable_sentinel_failover = Column(Boolean, default=False)
    enable_client_retry = Column(Boolean, default=True)
    enable_lua_transaction_failure = Column(Boolean, default=False)
    
    replication_lag_ms = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    seed = Column(Integer, default=42)
    
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    results = relationship("DrillResult", back_populates="task")
    diagnoses = relationship("Diagnosis", back_populates="task")


class DrillResult(Base):
    __tablename__ = "drill_results"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("drill_tasks.id"), nullable=False)
    result_type = Column(String(50), nullable=False)
    request_id = Column(String(64), nullable=True)
    slot_number = Column(Integer, nullable=True)
    node_id = Column(String(64), nullable=True)
    
    status = Column(String(20), default="success")
    redirect_type = Column(String(10), nullable=True)
    redirect_count = Column(Integer, default=0)
    retry_count = Column(Integer, default=0)
    latency_ms = Column(Float, default=0)
    error_type = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)
    
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    task = relationship("DrillTask", back_populates="results")


class Diagnosis(Base):
    __tablename__ = "diagnoses"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("drill_tasks.id"), nullable=False)
    diagnosis_type = Column(String(50), nullable=False)
    severity = Column(String(20), default="info")
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    recommendation = Column(Text, nullable=True)
    
    affected_slots = Column(JSON, nullable=True)
    affected_nodes = Column(JSON, nullable=True)
    affected_requests = Column(JSON, nullable=True)
    
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    task = relationship("DrillTask", back_populates="diagnoses")


class SlotEvent(Base):
    __tablename__ = "slot_events"
    
    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(50), nullable=False)
    slot_number = Column(Integer, nullable=True)
    from_node_id = Column(String(64), nullable=True)
    to_node_id = Column(String(64), nullable=True)
    timestamp = Column(DateTime, nullable=False)
    original_data = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
