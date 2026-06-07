from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class TodoExtract(Base):
    __tablename__ = "todo_extracts"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(String(100), index=True)
    meeting_title = Column(String(255))
    todo_content = Column(Text)
    assignee = Column(String(100))
    deadline = Column(String(50))
    priority = Column(String(20))
    status = Column(String(20), default="pending")
    desensitization_level = Column(String(20))
    desensitization_note = Column(Text)
    gray_batch_id = Column(Integer, ForeignKey("gray_batches.id"))
    is_manual_judgment = Column(Boolean, default=False)
    manual_judgment_by = Column(String(100))
    manual_judgment_at = Column(DateTime)
    manual_judgment_reason = Column(Text)
    is_overridden_by_batch = Column(Boolean, default=False)
    overridden_by_batch_id = Column(Integer, ForeignKey("gray_batches.id"))
    needs_security_review = Column(Boolean, default=False)
    security_review_status = Column(String(20), default="pending")
    security_review_by = Column(String(100))
    security_review_at = Column(DateTime)
    security_review_note = Column(Text)
    source_version = Column(String(50))
    import_batch_id = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    gray_batch = relationship("GrayBatch", foreign_keys=[gray_batch_id], back_populates="todos")
    overridden_batch = relationship("GrayBatch", foreign_keys=[overridden_by_batch_id])
    judgments = relationship("ManualJudgment", back_populates="todo")
    audit_logs = relationship("AuditLog", back_populates="todo")


class DesensitizationRule(Base):
    __tablename__ = "desensitization_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String(255))
    rule_type = Column(String(50))
    match_pattern = Column(Text)
    desensitization_level = Column(String(20))
    note = Column(Text)
    version = Column(String(50))
    import_batch_id = Column(String(100))
    is_active = Column(Boolean, default=True)
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    conflicts = relationship("ConflictRecord", back_populates="rule")


class GrayBatch(Base):
    __tablename__ = "gray_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_name = Column(String(255))
    batch_code = Column(String(100), unique=True)
    model_version = Column(String(100))
    gray_ratio = Column(Float)
    expected_desensitization_level = Column(String(20))
    note = Column(Text)
    status = Column(String(20), default="draft")
    reviewed_by = Column(String(100))
    reviewed_at = Column(DateTime)
    review_note = Column(Text)
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    todos = relationship("TodoExtract", foreign_keys="[TodoExtract.gray_batch_id]", back_populates="gray_batch")
    conflicts = relationship("ConflictRecord", back_populates="batch")
    eval_report = relationship("EvaluationReport", back_populates="batch", uselist=False)


class ConflictRecord(Base):
    __tablename__ = "conflict_records"

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("desensitization_rules.id"))
    batch_id = Column(Integer, ForeignKey("gray_batches.id"))
    todo_id = Column(Integer, ForeignKey("todo_extracts.id"))
    conflict_type = Column(String(50))
    rule_value = Column(String(255))
    batch_value = Column(String(255))
    description = Column(Text)
    evidence = Column(JSON)
    status = Column(String(20), default="pending")
    resolved_by = Column(String(100))
    resolved_at = Column(DateTime)
    resolution = Column(String(20))
    resolution_note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    rule = relationship("DesensitizationRule", back_populates="conflicts")
    batch = relationship("GrayBatch", back_populates="conflicts")


class ManualJudgment(Base):
    __tablename__ = "manual_judgments"

    id = Column(Integer, primary_key=True, index=True)
    todo_id = Column(Integer, ForeignKey("todo_extracts.id"))
    judge_by = Column(String(100))
    judge_at = Column(DateTime, default=datetime.utcnow)
    original_value = Column(JSON)
    new_value = Column(JSON)
    changed_fields = Column(JSON)
    reason = Column(Text)
    is_overridden = Column(Boolean, default=False)
    overridden_by_batch_id = Column(Integer, ForeignKey("gray_batches.id"))
    impact_analysis = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    todo = relationship("TodoExtract", back_populates="judgments")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    todo_id = Column(Integer, ForeignKey("todo_extracts.id"))
    action = Column(String(50))
    actor = Column(String(100))
    old_value = Column(JSON)
    new_value = Column(JSON)
    changed_fields = Column(JSON)
    reason = Column(Text)
    ip_address = Column(String(50))
    user_agent = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)

    todo = relationship("TodoExtract", back_populates="audit_logs")


class SelfCheckResult(Base):
    __tablename__ = "self_check_results"

    id = Column(Integer, primary_key=True, index=True)
    check_type = Column(String(50))
    check_name = Column(String(255))
    status = Column(String(20))
    issues_found = Column(Integer, default=0)
    details = Column(JSON)
    checked_by = Column(String(100))
    checked_at = Column(DateTime, default=datetime.utcnow)


class ExportRecord(Base):
    __tablename__ = "export_records"

    id = Column(Integer, primary_key=True, index=True)
    export_type = Column(String(50))
    export_format = Column(String(20))
    source_query = Column(JSON)
    record_count = Column(Integer)
    data_hash = Column(String(255))
    exported_by = Column(String(100))
    exported_at = Column(DateTime, default=datetime.utcnow)
    file_path = Column(String(500))


class EvaluationReport(Base):
    __tablename__ = "evaluation_reports"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("gray_batches.id"))
    report_content = Column(JSON)
    accuracy_rate = Column(Float)
    recall_rate = Column(Float)
    f1_score = Column(Float)
    conflict_count = Column(Integer, default=0)
    manual_judgment_count = Column(Integer, default=0)
    status = Column(String(20), default="draft")
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    batch = relationship("GrayBatch", back_populates="eval_report")


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(100), unique=True)
    import_type = Column(String(50))
    source_file = Column(String(500))
    record_count = Column(Integer)
    duplicate_count = Column(Integer, default=0)
    imported_by = Column(String(100))
    imported_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default="completed")
    note = Column(Text)
