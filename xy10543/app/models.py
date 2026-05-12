from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    member_no = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), index=True, nullable=False)
    balance = Column(Float, default=0.0)
    points = Column(Integer, default=0)
    points_expire_at = Column(DateTime, nullable=True)
    store_id = Column(String(50), nullable=True)
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    transactions = relationship("Transaction", back_populates="member")
    source_merges = relationship("MergeRecord", back_populates="source_member", foreign_keys="MergeRecord.source_member_id")
    target_merges = relationship("MergeRecord", back_populates="target_member", foreign_keys="MergeRecord.target_member_id")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    type = Column(String(20), nullable=False)
    amount = Column(Float, default=0.0)
    points = Column(Integer, default=0)
    description = Column(Text, nullable=True)
    ref_no = Column(String(50), nullable=True)
    operator = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    member = relationship("Member", back_populates="transactions")

class DuplicateCandidate(Base):
    __tablename__ = "duplicate_candidates"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(20), index=True, nullable=False)
    member_ids = Column(Text, nullable=False)
    reason = Column(String(200), nullable=True)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

class MergeRecord(Base):
    __tablename__ = "merge_records"

    id = Column(Integer, primary_key=True, index=True)
    merge_no = Column(String(50), unique=True, index=True, nullable=False)
    source_member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    target_member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    source_member_no = Column(String(50), nullable=False)
    target_member_no = Column(String(50), nullable=False)
    status = Column(String(20), default="pending")
    phase = Column(String(30), default="initiated")
    operator = Column(String(50), nullable=True)
    reason = Column(Text, nullable=True)
    remark = Column(Text, nullable=True)
    balance_before = Column(Float, default=0.0)
    points_before = Column(Integer, default=0)
    balance_moved = Column(Float, default=0.0)
    points_moved = Column(Integer, default=0)
    balance_after = Column(Float, default=0.0)
    points_after = Column(Integer, default=0)
    target_balance_before = Column(Float, default=0.0)
    target_points_before = Column(Integer, default=0)
    target_balance_after = Column(Float, default=0.0)
    target_points_after = Column(Integer, default=0)
    idempotency_key = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    source_member = relationship("Member", back_populates="source_merges", foreign_keys=[source_member_id])
    target_member = relationship("Member", back_populates="target_merges", foreign_keys=[target_member_id])
    histories = relationship("MergeHistory", back_populates="merge")
    reviews = relationship("ManualReview", back_populates="merge")

class MergeHistory(Base):
    __tablename__ = "merge_histories"

    id = Column(Integer, primary_key=True, index=True)
    merge_record_id = Column(Integer, ForeignKey("merge_records.id"), nullable=False)
    phase = Column(String(30), nullable=False)
    old_status = Column(String(20), nullable=True)
    new_status = Column(String(20), nullable=False)
    operator = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    change_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    merge = relationship("MergeRecord", back_populates="histories")

class ManualReview(Base):
    __tablename__ = "manual_reviews"

    id = Column(Integer, primary_key=True, index=True)
    merge_record_id = Column(Integer, ForeignKey("merge_records.id"), nullable=False)
    conflict_type = Column(String(50), nullable=False)
    before_value = Column(Text, nullable=True)
    after_value = Column(Text, nullable=True)
    decision = Column(String(20), nullable=False)
    operator = Column(String(50), nullable=True)
    explanation = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    merge = relationship("MergeRecord", back_populates="reviews")

class MergeReport(Base):
    __tablename__ = "merge_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_no = Column(String(50), unique=True, index=True, nullable=False)
    merge_record_id = Column(Integer, ForeignKey("merge_records.id"), nullable=True)
    report_type = Column(String(20), nullable=False)
    status = Column(String(20), default="generating")
    content = Column(Text, nullable=True)
    operator = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
