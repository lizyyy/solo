from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text,
    ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class EvaluationSlice(Base):
    __tablename__ = "evaluation_slices"

    id = Column(Integer, primary_key=True, index=True)
    original_row_number = Column(Integer, nullable=False, comment="评测切片原始行号")
    main_process_data = Column(JSON, nullable=False, comment="主流程数据")
    import_batch_id = Column(String, index=True, comment="导入批次号")
    import_time = Column(DateTime(timezone=True), server_default=func.now())
    current_status = Column(String, default="pending", comment="当前处理状态：pending/reviewing/confirmed/abnormal")
    remarks = Column(Text, comment="备注")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    feature_snapshots = relationship("FeatureSnapshot", back_populates="evaluation_slice")
    check_results = relationship("CheckResult", back_populates="evaluation_slice")
    manual_changes = relationship("ManualChange", back_populates="evaluation_slice")
    workflow_steps = relationship("WorkflowStep", back_populates="evaluation_slice")


class FeatureSnapshot(Base):
    __tablename__ = "feature_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_number = Column(String, nullable=False, index=True, comment="特征快照编号")
    on_site_statement = Column(Text, comment="现场说法")
    feature_data = Column(JSON, comment="特征数据")
    evaluation_slice_id = Column(Integer, ForeignKey("evaluation_slices.id"))
    supplemented_by = Column(String, comment="补录人，如：老唐")
    supplement_time = Column(DateTime(timezone=True), server_default=func.now())
    is_resupplemented = Column(Boolean, default=False, comment="是否补录后重算")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    evaluation_slice = relationship("EvaluationSlice", back_populates="feature_snapshots")
    check_results = relationship("CheckResult", back_populates="feature_snapshot")


class CheckResult(Base):
    __tablename__ = "check_results"

    id = Column(Integer, primary_key=True, index=True)
    evaluation_slice_id = Column(Integer, ForeignKey("evaluation_slices.id"))
    feature_snapshot_id = Column(Integer, ForeignKey("feature_snapshots.id"), nullable=True)
    check_type = Column(String, nullable=False, comment="检查类型：duplicate_import/threshold_mismatch/resupplement/export_consistency/cross_leak")
    check_status = Column(String, default="normal", comment="检查状态：normal/abnormal/pending_review")
    severity = Column(String, default="low", comment="严重程度：low/medium/high")
    result_detail = Column(JSON, comment="详细结果，统一存储，接口、页面、导出都从此读取")
    evidence_chain = Column(JSON, comment="证据链，包含原始行号、数据来源等")
    threshold_old_value = Column(Float, comment="阈值旧值")
    threshold_new_value = Column(Float, comment="阈值新值")
    report_threshold_value = Column(Float, comment="报告中写的阈值")
    needs_data_scientist_review = Column(Boolean, default=False, comment="是否需要数据科学家复核")
    reviewer = Column(String, comment="复核人")
    review_time = Column(DateTime(timezone=True))
    review_comment = Column(Text, comment="复核意见")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    evaluation_slice = relationship("EvaluationSlice", back_populates="check_results")
    feature_snapshot = relationship("FeatureSnapshot", back_populates="check_results")


class ThresholdRecord(Base):
    __tablename__ = "threshold_records"

    id = Column(Integer, primary_key=True, index=True)
    threshold_name = Column(String, nullable=False, index=True)
    old_value = Column(Float)
    new_value = Column(Float, nullable=False)
    changed_by = Column(String)
    change_time = Column(DateTime(timezone=True), server_default=func.now())
    is_applied_in_report = Column(Boolean, default=False, comment="是否已在报告中更新")
    related_check_result_id = Column(Integer, ForeignKey("check_results.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class WorkflowStep(Base):
    __tablename__ = "workflow_steps"

    id = Column(Integer, primary_key=True, index=True)
    evaluation_slice_id = Column(Integer, ForeignKey("evaluation_slices.id"))
    step_number = Column(Integer, nullable=False, comment="步骤：1-导入评测切片 2-补看特征快照 3-分层指标更新")
    step_name = Column(String, nullable=False)
    step_status = Column(String, default="pending", comment="pending/in_progress/completed/skipped")
    operator = Column(String)
    operation_time = Column(DateTime(timezone=True))
    step_data = Column(JSON, comment="步骤相关数据")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    evaluation_slice = relationship("EvaluationSlice", back_populates="workflow_steps")


class ExportRecord(Base):
    __tablename__ = "export_records"

    id = Column(Integer, primary_key=True, index=True)
    export_type = Column(String, comment="导出类型：detail/summary")
    export_time = Column(DateTime(timezone=True), server_default=func.now())
    exported_by = Column(String)
    check_result_ids = Column(JSON, comment="包含的检查结果ID，用于一致性校验")
    export_hash = Column(String, comment="导出内容哈希，用于一致性校验")
    file_path = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ManualChange(Base):
    __tablename__ = "manual_changes"

    id = Column(Integer, primary_key=True, index=True)
    evaluation_slice_id = Column(Integer, ForeignKey("evaluation_slices.id"))
    field_name = Column(String, nullable=False, comment="改动的字段名")
    old_value = Column(Text, comment="旧值")
    new_value = Column(Text, comment="新值")
    changed_by = Column(String)
    change_time = Column(DateTime(timezone=True), server_default=func.now())
    change_reason = Column(Text, comment="改动原因")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    evaluation_slice = relationship("EvaluationSlice", back_populates="manual_changes")
