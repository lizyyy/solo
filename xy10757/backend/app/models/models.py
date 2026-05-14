from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class PointBatch(Base):
    __tablename__ = "point_batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, index=True, nullable=False)
    member_id = Column(String(50), index=True, nullable=False)
    points = Column(Integer, nullable=False)
    source = Column(String(100))
    expire_date = Column(DateTime)
    status = Column(String(20), default="active")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    remark = Column(Text)
    
    transactions = relationship("PointTransaction", back_populates="batch")

class FrozenBalance(Base):
    __tablename__ = "frozen_balances"
    
    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(String(50), index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("point_batches.id"))
    frozen_points = Column(Integer, nullable=False)
    reason = Column(String(200))
    status = Column(String(20), default="frozen")
    created_at = Column(DateTime, server_default=func.now())
    unfrozen_at = Column(DateTime)
    operator = Column(String(50))

class PointTransaction(Base):
    __tablename__ = "point_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    tx_no = Column(String(50), unique=True, index=True, nullable=False)
    member_id = Column(String(50), index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("point_batches.id"))
    tx_type = Column(String(30), nullable=False)
    points = Column(Integer, nullable=False)
    before_balance = Column(Integer)
    after_balance = Column(Integer)
    related_tx_id = Column(Integer)
    status = Column(String(20), default="completed")
    is_reviewed = Column(Boolean, default=False)
    reviewed_by = Column(String(50))
    reviewed_at = Column(DateTime)
    is_manual = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    operator = Column(String(50))
    remark = Column(Text)
    
    batch = relationship("PointBatch", back_populates="transactions")

class BalanceSnapshot(Base):
    __tablename__ = "balance_snapshots"
    
    id = Column(Integer, primary_key=True, index=True)
    snapshot_date = Column(DateTime, index=True, nullable=False)
    member_id = Column(String(50), index=True, nullable=False)
    total_points = Column(Integer, nullable=False)
    available_points = Column(Integer, nullable=False)
    frozen_points = Column(Integer, nullable=False)
    expired_points = Column(Integer, nullable=False)
    consumed_points = Column(Integer, nullable=False)
    refunded_points = Column(Integer, nullable=False)
    batch_count = Column(Integer)
    tx_count = Column(Integer)
    is_consistent = Column(Boolean, default=True)
    inconsistency_reason = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    
    __table_args__ = ()

class ReviewRecord(Base):
    __tablename__ = "review_records"
    
    id = Column(Integer, primary_key=True, index=True)
    review_type = Column(String(30), nullable=False)
    target_id = Column(Integer, nullable=False)
    target_type = Column(String(30))
    before_data = Column(Text)
    after_data = Column(Text)
    comparison_result = Column(Text)
    status = Column(String(20), default="pending")
    reviewer = Column(String(50))
    reviewed_at = Column(DateTime)
    remark = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
