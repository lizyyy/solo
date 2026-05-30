import json
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base


class CreditLedger(Base):
    __tablename__ = "credit_ledger"

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(String(64), nullable=False, index=True)
    customer_name = Column(String(128), nullable=False)
    credit_type = Column(String(64), nullable=False)
    credit_amount = Column(Float, nullable=False)
    used_amount = Column(Float, default=0.0)
    frozen_amount = Column(Float, default=0.0)
    available_amount = Column(Float, default=0.0)
    status = Column(String(32), default="active")
    effective_date = Column(String(32), nullable=True)
    expiry_date = Column(String(32), nullable=True)
    source = Column(String(128), nullable=True)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    alerts = relationship("CreditAlert", back_populates="credit", cascade="all, delete-orphan")
    writeoffs = relationship("OccupationWriteoff", back_populates="credit", cascade="all, delete-orphan")


class TransactionFlow(Base):
    __tablename__ = "transaction_flow"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_no = Column(String(128), nullable=False, unique=True)
    customer_id = Column(String(64), nullable=False, index=True)
    customer_name = Column(String(128), nullable=False)
    transaction_type = Column(String(64), nullable=False)
    amount = Column(Float, nullable=False)
    occupation_type = Column(String(64), nullable=True)
    transaction_date = Column(String(32), nullable=True)
    credit_id = Column(Integer, ForeignKey("credit_ledger.id"), nullable=True)
    version = Column(Integer, default=1)
    batch_no = Column(String(128), nullable=True)
    is_supplementary = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class OccupationWriteoff(Base):
    __tablename__ = "occupation_writeoff"

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(String(64), nullable=False, index=True)
    customer_name = Column(String(128), nullable=False)
    occupation_amount = Column(Float, nullable=False)
    writeoff_amount = Column(Float, default=0.0)
    occupation_type = Column(String(64), nullable=True)
    status = Column(String(32), default="pending_confirmation")
    credit_id = Column(Integer, ForeignKey("credit_ledger.id"), nullable=True)
    transaction_ids = Column(Text, default="[]")
    conclusion = Column(Text, nullable=True)
    evidence_refs = Column(Text, default="{}")
    risk_tags = Column(Text, default="[]")
    remarks = Column(Text, nullable=True)
    reviewer = Column(String(64), nullable=True)
    review_date = Column(DateTime, nullable=True)
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    credit = relationship("CreditLedger", back_populates="writeoffs")
    change_logs = relationship("WriteoffChangeLog", back_populates="writeoff", cascade="all, delete-orphan")

    def get_transaction_ids(self):
        return json.loads(self.transaction_ids) if self.transaction_ids else []

    def set_transaction_ids(self, val):
        self.transaction_ids = json.dumps(val, ensure_ascii=False)

    def get_evidence_refs(self):
        return json.loads(self.evidence_refs) if self.evidence_refs else {}

    def set_evidence_refs(self, val):
        self.evidence_refs = json.dumps(val, ensure_ascii=False)

    def get_risk_tags(self):
        return json.loads(self.risk_tags) if self.risk_tags else []

    def set_risk_tags(self, val):
        self.risk_tags = json.dumps(val, ensure_ascii=False)


class WriteoffChangeLog(Base):
    __tablename__ = "writeoff_change_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    writeoff_id = Column(Integer, ForeignKey("occupation_writeoff.id"), nullable=False, index=True)
    change_type = Column(String(32), nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    change_description = Column(Text, nullable=True)
    alert_level = Column(String(16), default="info")
    operator = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    writeoff = relationship("OccupationWriteoff", back_populates="change_logs")


class CreditAlert(Base):
    __tablename__ = "credit_alert"

    id = Column(Integer, primary_key=True, autoincrement=True)
    credit_id = Column(Integer, ForeignKey("credit_ledger.id"), nullable=False, index=True)
    alert_type = Column(String(64), nullable=False)
    alert_detail = Column(Text, nullable=True)
    status = Column(String(32), default="active")
    resolved_by = Column(String(64), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    credit = relationship("CreditLedger", back_populates="alerts")
