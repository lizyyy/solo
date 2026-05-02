from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Dataset(Base):
    __tablename__ = "datasets"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    fields = relationship("Field", back_populates="dataset", cascade="all, delete-orphan")
    budget_ledger = relationship("BudgetLedger", uselist=False, back_populates="dataset", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="dataset", cascade="all, delete-orphan")
    query_caches = relationship("QueryCache", back_populates="dataset", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Dataset {self.id}: {self.name}>"


class Field(Base):
    __tablename__ = "fields"
    
    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    name = Column(String(255), nullable=False)
    field_type = Column(String(50), nullable=False)  # 'dimension', 'metric', 'sensitive'
    description = Column(Text, nullable=True)
    is_nullable = Column(Boolean, default=True)
    sample_values = Column(Text, nullable=True)  # JSON string of sample values
    
    dataset = relationship("Dataset", back_populates="fields")
    
    def __repr__(self):
        return f"<Field {self.id}: {self.name} ({self.field_type})>"


class BudgetLedger(Base):
    __tablename__ = "budget_ledgers"
    
    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False, unique=True)
    total_epsilon = Column(Float, nullable=False)
    remaining_epsilon = Column(Float, nullable=False)
    delta = Column(Float, nullable=False, default=1e-5)
    suppression_threshold = Column(Integer, nullable=False, default=5)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    dataset = relationship("Dataset", back_populates="budget_ledger")
    transactions = relationship("BudgetTransaction", back_populates="ledger", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<BudgetLedger {self.id}: remaining={self.remaining_epsilon}>"


class BudgetTransaction(Base):
    __tablename__ = "budget_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    ledger_id = Column(Integer, ForeignKey("budget_ledgers.id"), nullable=False)
    epsilon_used = Column(Float, nullable=False)
    epsilon_before = Column(Float, nullable=False)
    epsilon_after = Column(Float, nullable=False)
    reason = Column(String(500), nullable=False)
    query_id = Column(Integer, ForeignKey("audit_logs.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    ledger = relationship("BudgetLedger", back_populates="transactions")
    audit_log = relationship("AuditLog", back_populates="budget_transaction")
    
    def __repr__(self):
        return f"<BudgetTransaction {self.id}: used={self.epsilon_used}>"


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    query_type = Column(String(50), nullable=False)  # 'count', 'sum', 'avg', 'aggregate'
    query_parameters = Column(Text, nullable=False)  # JSON string of query params
    epsilon_used = Column(Float, nullable=False)
    result_hash = Column(String(64), nullable=True)  # SHA256 hash of result
    client_info = Column(String(500), nullable=True)
    status = Column(String(20), default="success")  # 'success', 'failed', 'rejected'
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    dataset = relationship("Dataset", back_populates="audit_logs")
    budget_transaction = relationship("BudgetTransaction", uselist=False, back_populates="audit_log")
    
    def __repr__(self):
        return f"<AuditLog {self.id}: {self.query_type}>"


class QueryCache(Base):
    __tablename__ = "query_caches"
    
    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    query_hash = Column(String(64), nullable=False, unique=True)  # SHA256 of query params
    query_type = Column(String(50), nullable=False)
    query_parameters = Column(Text, nullable=False)
    result = Column(Text, nullable=False)  # JSON string of result
    epsilon_used = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    hit_count = Column(Integer, default=0)
    
    dataset = relationship("Dataset", back_populates="query_caches")
    
    def __repr__(self):
        return f"<QueryCache {self.id}: {self.query_hash}>"
