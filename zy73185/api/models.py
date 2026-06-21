import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.sqlite import JSON

from .database import Base


def _new_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"


def _now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


class ParamVersion(Base):
    __tablename__ = "param_versions"

    id = Column(String, primary_key=True, default=lambda: _new_id("pv-"))
    name = Column(String, nullable=False)
    created_at = Column(Integer, nullable=False, default=_now_ms)
    tolerance = Column(Float, nullable=False, default=0.05)
    rounding_rule = Column(String, nullable=False, default="round")
    sig_figs = Column(Integer, nullable=False, default=3)
    is_active = Column(Boolean, nullable=False, default=False)

    runs = relationship("CalculationRun", back_populates="param_version")


class DraftEntry(Base):
    __tablename__ = "drafts"

    id = Column(String, primary_key=True, default=lambda: _new_id("dft-"))
    question_no = Column(String, nullable=False)
    answer_content = Column(Text, nullable=False)
    answer_version = Column(String, nullable=True)
    supplementary_note = Column(Text, nullable=True)
    raw_source = Column(Text, nullable=False)
    submitted_at = Column(Integer, nullable=False, default=_now_ms)
    submission_fingerprint = Column(String, nullable=False, index=True)
    batch_id = Column(String, nullable=True, index=True)

    __table_args__ = (
        UniqueConstraint("submission_fingerprint", name="uq_draft_fingerprint"),
        Index("ix_drafts_question_no", "question_no"),
    )

    anomalies = relationship(
        "Anomaly", secondary="anomaly_drafts", back_populates="drafts"
    )


class CalculationRun(Base):
    __tablename__ = "runs"

    id = Column(String, primary_key=True, default=lambda: _new_id("run-"))
    param_version_id = Column(
        String, ForeignKey("param_versions.id"), nullable=False
    )
    started_at = Column(Integer, nullable=False, default=_now_ms)
    finished_at = Column(Integer, nullable=False, default=_now_ms)
    valid_draft_ids = Column(JSON, nullable=False, default=list)
    all_draft_ids = Column(JSON, nullable=False, default=list)
    summary = Column(Text, nullable=False)
    editor_note = Column(Text, nullable=True)
    batch_id = Column(String, nullable=True, index=True)

    param_version = relationship("ParamVersion", back_populates="runs")
    anomalies = relationship("Anomaly", back_populates="run", cascade="all, delete-orphan")


class Anomaly(Base):
    __tablename__ = "anomalies"

    id = Column(String, primary_key=True, default=lambda: _new_id("anm-"))
    run_id = Column(String, ForeignKey("runs.id"), nullable=False)
    type = Column(String, nullable=False)
    source_description = Column(Text, nullable=False)
    impact_scope = Column(Text, nullable=False)
    explanation = Column(Text, nullable=False)
    resolved = Column(Boolean, nullable=False, default=False)
    resolver_note = Column(Text, nullable=True)

    run = relationship("CalculationRun", back_populates="anomalies")
    drafts = relationship(
        "DraftEntry", secondary="anomaly_drafts", back_populates="anomalies"
    )


class AnomalyDraft(Base):
    __tablename__ = "anomaly_drafts"

    anomaly_id = Column(
        String, ForeignKey("anomalies.id", ondelete="CASCADE"), primary_key=True
    )
    draft_id = Column(
        String, ForeignKey("drafts.id", ondelete="CASCADE"), primary_key=True
    )
