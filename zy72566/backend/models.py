from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class ReconciliationStatus:
    STEP1_IMPORTED = "step1_imported"
    STEP2_FEATURE_ADDED = "step2_feature_added"
    STEP3_THRESHOLD_UPDATED = "step3_threshold_updated"
    PENDING_REVIEW = "pending_review"
    CONFIRMED_NORMAL = "confirmed_normal"
    CONFIRMED_ABNORMAL = "confirmed_abnormal"
    ROLLBACK = "rollback"


class EvaluationSlice(Base):
    __tablename__ = "evaluation_slices"

    id = Column(Integer, primary_key=True, index=True)
    slice_name = Column(String(255), nullable=False, comment="评测切片名称")
    import_time = Column(DateTime(timezone=True), server_default=func.now())
    imported_by = Column(String(100), default="system")
    total_count = Column(Integer, default=0)
    abnormal_count = Column(Integer, default=0)
    description = Column(Text, nullable=True)

    records = relationship("ReconciliationRecord", back_populates="slice")


class ReconciliationRecord(Base):
    __tablename__ = "reconciliation_records"

    id = Column(Integer, primary_key=True, index=True)
    slice_id = Column(Integer, ForeignKey("evaluation_slices.id"), nullable=False)

    original_row_number = Column(Integer, nullable=False, comment="原始行号")
    sample_id = Column(String(100), nullable=True, comment="样本ID")
    sample_type = Column(String(50), nullable=True, comment="样本类型（少数类/多数类）")
    is_minority = Column(Boolean, default=False, comment="是否少数类样本")

    recall_rate = Column(Float, nullable=True, comment="召回率")
    precision_rate = Column(Float, nullable=True, comment="准确率")
    total_metric = Column(Float, nullable=True, comment="总指标")

    feature_snapshot_id = Column(String(100), nullable=True, comment="特征快照编号")
    feature_snapshot_added_by = Column(String(100), nullable=True)
    feature_snapshot_added_time = Column(DateTime(timezone=True), nullable=True)

    threshold_value = Column(Float, nullable=True, comment="回放阈值")
    threshold_replay_result = Column(String(50), nullable=True, comment="阈值回放结果")
    threshold_updated_by = Column(String(100), nullable=True)
    threshold_updated_time = Column(DateTime(timezone=True), nullable=True)

    is_masked_by_total = Column(Boolean, default=False, comment="是否被总指标盖住")
    status = Column(String(50), default=ReconciliationStatus.STEP1_IMPORTED, comment="当前处理状态")

    manual_note = Column(Text, nullable=True, comment="人工备注/改动")
    reviewed_by = Column(String(100), nullable=True, comment="复核人")
    reviewed_time = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    slice = relationship("EvaluationSlice", back_populates="records")
    audit_logs = relationship("AuditLog", back_populates="record")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("reconciliation_records.id"), nullable=False)
    action = Column(String(50), nullable=False, comment="操作类型")
    previous_value = Column(Text, nullable=True, comment="变更前值")
    new_value = Column(Text, nullable=True, comment="变更后值")
    operator = Column(String(100), nullable=False, comment="操作人")
    operation_time = Column(DateTime(timezone=True), server_default=func.now())
    remark = Column(Text, nullable=True)

    record = relationship("ReconciliationRecord", back_populates="audit_logs")
