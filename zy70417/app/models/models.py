from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import hashlib
import json


class Rule(Base):
    __tablename__ = "rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    code = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    risk_type = Column(String(100))
    condition = Column(JSON, nullable=False)
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(100), unique=True, index=True)
    data_hash = Column(String(64), index=True)
    operator = Column(String(100))
    status = Column(String(50))
    total_count = Column(Integer)
    risk_count = Column(Integer, default=0)
    rule_version_snapshot = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))

    results = relationship("CheckResult", back_populates="batch")
    nodes = relationship("EdgeNode", back_populates="batch")

    def generate_data_hash(self, nodes_data):
        sorted_data = sorted(nodes_data, key=lambda x: json.dumps(x, sort_keys=True))
        return hashlib.sha256(json.dumps(sorted_data, sort_keys=True).encode()).hexdigest()


class EdgeNode(Base):
    __tablename__ = "edge_nodes"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    node_id = Column(String(100), index=True)
    node_name = Column(String(200))
    region = Column(String(100))
    group = Column(String(100))
    hardware_model = Column(String(100))
    software_version = Column(String(100))
    ip_address = Column(String(100))
    deployment_time = Column(DateTime)
    responsible_team = Column(String(100))
    extra_data = Column(JSON)

    batch = relationship("Batch", back_populates="nodes")
    results = relationship("CheckResult", back_populates="node")
    iot_receipts = relationship("IoTReceipt", back_populates="node")


class CheckResult(Base):
    __tablename__ = "check_results"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    node_id = Column(Integer, ForeignKey("edge_nodes.id"))
    rule_id = Column(Integer, ForeignKey("rules.id"))
    rule_code = Column(String(100))
    rule_name = Column(String(200))
    risk_type = Column(String(100))
    is_blocked = Column(Boolean, default=False)
    block_reason = Column(Text)
    details = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("Batch", back_populates="results")
    node = relationship("EdgeNode", back_populates="results")
    manual_changes = relationship("ManualChange", back_populates="result")


class IoTReceipt(Base):
    __tablename__ = "iot_receipts"

    id = Column(Integer, primary_key=True, index=True)
    node_id = Column(Integer, ForeignKey("edge_nodes.id"))
    receipt_id = Column(String(100), unique=True)
    device_status = Column(String(100))
    receipt_time = Column(DateTime)
    raw_data = Column(JSON)
    received_at = Column(DateTime(timezone=True), server_default=func.now())

    node = relationship("EdgeNode", back_populates="iot_receipts")


class ManualChange(Base):
    __tablename__ = "manual_changes"

    id = Column(Integer, primary_key=True, index=True)
    result_id = Column(Integer, ForeignKey("check_results.id"))
    changed_by = Column(String(100))
    change_type = Column(String(50))
    old_value = Column(JSON)
    new_value = Column(JSON)
    reason = Column(Text)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())

    result = relationship("CheckResult", back_populates="manual_changes")
