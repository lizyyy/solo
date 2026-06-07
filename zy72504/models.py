from datetime import datetime
from enum import Enum
from sqlalchemy import (
    create_engine, Column, Integer, String, Text, DateTime,
    ForeignKey, Boolean, JSON
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

Base = declarative_base()


class MatchStatus(str, Enum):
    NORMAL = "normal"
    PENDING_REVIEW = "pending_review"
    MANUAL_OVERRIDDEN = "manual_overridden"
    OVERRIDDEN_BY_BATCH = "overridden_by_batch"
    REVIEW_APPROVED = "review_approved"
    REVIEW_REJECTED = "review_rejected"
    ROLLED_BACK = "rolled_back"


class ChangeType(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    OVERRIDE = "override"
    ROLLBACK = "rollback"
    BATCH_RUN = "batch_run"
    REMARK_CHANGE = "remark_change"


class PromptVersion(Base):
    __tablename__ = "prompt_versions"

    id = Column(Integer, primary_key=True)
    version_number = Column(String(50), unique=True, nullable=False)
    content = Column(Text, nullable=False)
    description = Column(Text)
    imported_by = Column(String(100), nullable=False)
    imported_at = Column(DateTime, default=datetime.now, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    match_explanations = relationship(
        "MatchExplanation", back_populates="prompt_version"
    )
    history_records = relationship(
        "ChangeHistory", back_populates="prompt_version"
    )


class KnowledgeBaseRef(Base):
    __tablename__ = "knowledge_base_refs"

    id = Column(Integer, primary_key=True)
    ref_link = Column(String(500), nullable=False)
    title = Column(String(200))
    remark = Column(Text)
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)

    match_explanations = relationship(
        "MatchExplanation", back_populates="knowledge_ref"
    )


class MatchExplanation(Base):
    __tablename__ = "match_explanations"

    id = Column(Integer, primary_key=True)
    resume_id = Column(String(100), nullable=False)
    job_id = Column(String(100), nullable=False)
    explanation = Column(Text, nullable=False)
    match_score = Column(Integer)
    status = Column(String(50), default=MatchStatus.NORMAL, nullable=False)

    prompt_version_id = Column(Integer, ForeignKey("prompt_versions.id"))
    knowledge_ref_id = Column(Integer, ForeignKey("knowledge_base_refs.id"))

    created_at = Column(DateTime, default=datetime.now, nullable=False)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)
    last_batch_run_at = Column(DateTime)
    needs_review = Column(Boolean, default=False, nullable=False)

    prompt_version = relationship(
        "PromptVersion", back_populates="match_explanations"
    )
    knowledge_ref = relationship(
        "KnowledgeBaseRef", back_populates="match_explanations"
    )
    manual_override = relationship(
        "ManualOverride",
        back_populates="match_explanation",
        uselist=False,
        foreign_keys="ManualOverride.match_explanation_id"
    )
    history_records = relationship(
        "ChangeHistory", back_populates="match_explanation"
    )
    evaluation_items = relationship(
        "EvaluationItem", back_populates="match_explanation"
    )


class ManualOverride(Base):
    __tablename__ = "manual_overrides"

    id = Column(Integer, primary_key=True)
    match_explanation_id = Column(Integer, ForeignKey("match_explanations.id"), unique=True)
    original_explanation = Column(Text, nullable=False)
    original_status = Column(String(50), nullable=False)
    new_explanation = Column(Text, nullable=False)
    new_status = Column(String(50), nullable=False)
    reason = Column(Text)
    overridden_by = Column(String(100), nullable=False)
    overridden_at = Column(DateTime, default=datetime.now, nullable=False)
    is_overridden_by_batch = Column(Boolean, default=False, nullable=False)
    batch_overridden_at = Column(DateTime)

    match_explanation = relationship(
        "MatchExplanation",
        back_populates="manual_override",
        foreign_keys=[match_explanation_id]
    )
    rollback_records = relationship(
        "RollbackRecord", back_populates="manual_override"
    )


class RollbackRecord(Base):
    __tablename__ = "rollback_records"

    id = Column(Integer, primary_key=True)
    manual_override_id = Column(Integer, ForeignKey("manual_overrides.id"))
    rolled_back_by = Column(String(100), nullable=False)
    rolled_back_at = Column(DateTime, default=datetime.now, nullable=False)
    reason = Column(Text)
    rollback_type = Column(String(50))

    manual_override = relationship(
        "ManualOverride", back_populates="rollback_records"
    )


class ChangeHistory(Base):
    __tablename__ = "change_history"

    id = Column(Integer, primary_key=True)
    match_explanation_id = Column(Integer, ForeignKey("match_explanations.id"))
    prompt_version_id = Column(Integer, ForeignKey("prompt_versions.id"))
    change_type = Column(String(50), nullable=False)
    changed_by = Column(String(100), nullable=False)
    changed_at = Column(DateTime, default=datetime.now, nullable=False)
    field_name = Column(String(100))
    old_value = Column(Text)
    new_value = Column(Text)
    diff_summary = Column(Text)
    metadata_ = Column("metadata", JSON)

    match_explanation = relationship(
        "MatchExplanation", back_populates="history_records"
    )
    prompt_version = relationship(
        "PromptVersion", back_populates="history_records"
    )


class EvaluationReport(Base):
    __tablename__ = "evaluation_reports"

    id = Column(Integer, primary_key=True)
    report_date = Column(DateTime, default=datetime.now, nullable=False)
    generated_by = Column(String(100), nullable=False)
    total_records = Column(Integer, default=0, nullable=False)
    changed_records = Column(Integer, default=0, nullable=False)
    pending_review_count = Column(Integer, default=0, nullable=False)
    remark_change_count = Column(Integer, default=0, nullable=False)
    summary = Column(Text)

    items = relationship("EvaluationItem", back_populates="report")


class EvaluationItem(Base):
    __tablename__ = "evaluation_items"

    id = Column(Integer, primary_key=True)
    report_id = Column(Integer, ForeignKey("evaluation_reports.id"))
    match_explanation_id = Column(Integer, ForeignKey("match_explanations.id"))
    change_type = Column(String(50))
    field_changed = Column(String(100))
    old_value = Column(Text)
    new_value = Column(Text)
    needs_review = Column(Boolean, default=False, nullable=False)
    note = Column(Text)

    report = relationship("EvaluationReport", back_populates="items")
    match_explanation = relationship(
        "MatchExplanation", back_populates="evaluation_items"
    )


DATABASE_URL = "sqlite:///./resume_matching.db"
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)
