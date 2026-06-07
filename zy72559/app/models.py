from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class EvalSlice(Base):
    __tablename__ = "eval_slices"

    id = Column(Integer, primary_key=True, index=True)
    slice_id = Column(String(64), unique=True, index=True, nullable=False)
    slice_name = Column(String(128), nullable=False)
    feature_snapshot_id = Column(String(64), nullable=True)
    import_time = Column(DateTime, default=datetime.now)
    imported_by = Column(String(64), default="小孟")
    status = Column(String(32), default="pending")
    time_window_start = Column(DateTime, nullable=True)
    time_window_end = Column(DateTime, nullable=True)
    total_users = Column(Integer, default=0)
    remark = Column(Text, nullable=True)
    raw_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    conflicts = relationship("ConflictRecord", back_populates="eval_slice")
    expand_results = relationship("ExpandResult", back_populates="eval_slice")
    self_checks = relationship("SelfCheckRecord", back_populates="eval_slice")


class FeatureSnapshot(Base):
    __tablename__ = "feature_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(String(64), unique=True, index=True, nullable=False)
    snapshot_name = Column(String(128), nullable=False)
    snapshot_time = Column(DateTime, nullable=False)
    feature_version = Column(String(32), nullable=True)
    total_users = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)


class ConflictRecord(Base):
    __tablename__ = "conflict_records"

    id = Column(Integer, primary_key=True, index=True)
    eval_slice_id = Column(Integer, ForeignKey("eval_slices.id"))
    conflict_type = Column(String(64), nullable=False)
    description = Column(Text, nullable=False)
    evidence = Column(JSON, nullable=False)
    status = Column(String(32), default="pending")
    resolved_by = Column(String(64), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution = Column(String(32), nullable=True)
    created_at = Column(DateTime, default=datetime.now)

    eval_slice = relationship("EvalSlice", back_populates="conflicts")


class ExpandResult(Base):
    __tablename__ = "expand_results"

    id = Column(Integer, primary_key=True, index=True)
    eval_slice_id = Column(Integer, ForeignKey("eval_slices.id"))
    user_id = Column(String(64), index=True, nullable=False)
    seed_user_id = Column(String(64), nullable=True)
    similarity_score = Column(Float, default=0.0)
    is_abnormal = Column(Boolean, default=False)
    abnormal_type = Column(String(64), nullable=True)
    abnormal_reason = Column(Text, nullable=True)
    need_review = Column(Boolean, default=False)
    reviewed_by = Column(String(64), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_status = Column(String(32), default="pending")
    feature_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

    eval_slice = relationship("EvalSlice", back_populates="expand_results")


class SelfCheckRecord(Base):
    __tablename__ = "self_check_records"

    id = Column(Integer, primary_key=True, index=True)
    eval_slice_id = Column(Integer, ForeignKey("eval_slices.id"))
    check_type = Column(String(64), nullable=False)
    check_name = Column(String(128), nullable=False)
    passed = Column(Boolean, default=False)
    details = Column(JSON, nullable=True)
    error_count = Column(Integer, default=0)
    checked_at = Column(DateTime, default=datetime.now)

    eval_slice = relationship("EvalSlice", back_populates="self_checks")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    operator = Column(String(64), nullable=False)
    operation = Column(String(128), nullable=False)
    target_type = Column(String(64), nullable=True)
    target_id = Column(String(64), nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
