from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Text, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base
import enum


class VersionStatus(str, enum.Enum):
    draft = "draft"
    reviewed = "reviewed"
    approved = "approved"
    superseded = "superseded"


class AnomalySeverity(str, enum.Enum):
    info = "info"
    warning = "warning"
    error = "error"


class AuditAction(str, enum.Enum):
    create = "create"
    update = "update"
    delete = "delete"
    verify = "verify"
    compare = "compare"
    annotate = "annotate"
    export = "export"


class Score(Base):
    __tablename__ = "scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    composer: Mapped[Optional[str]] = mapped_column(String(100))
    tuning: Mapped[Optional[str]] = mapped_column(String(50))
    mode: Mapped[Optional[str]] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    versions: Mapped[List["ScoreVersion"]] = relationship(back_populates="score", order_by="ScoreVersion.version_number")
    fingering_annotations: Mapped[List["FingeringAnnotation"]] = relationship(back_populates="score")
    measures: Mapped[List["Measure"]] = relationship(back_populates="score", order_by="Measure.measure_number")
    student_annotations: Mapped[List["StudentAnnotation"]] = relationship(back_populates="score")


class ScoreVersion(Base):
    __tablename__ = "score_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    score_id: Mapped[int] = mapped_column(ForeignKey("scores.id"))
    version_number: Mapped[int] = mapped_column(Integer)
    content_json: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default=VersionStatus.draft)
    change_note: Mapped[Optional[str]] = mapped_column(Text)
    superseded_by: Mapped[Optional[int]] = mapped_column(ForeignKey("score_versions.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    score: Mapped["Score"] = relationship(back_populates="versions")


class FingeringAnnotation(Base):
    __tablename__ = "fingering_annotations"

    id: Mapped[int] = mapped_column(primary_key=True)
    score_id: Mapped[int] = mapped_column(ForeignKey("scores.id"))
    version_id: Mapped[int] = mapped_column(ForeignKey("score_versions.id"))
    measure_number: Mapped[int] = mapped_column(Integer)
    position_in_measure: Mapped[Optional[float]] = mapped_column(Float)
    jianzi_char: Mapped[str] = mapped_column(String(20))
    fingering_type: Mapped[str] = mapped_column(String(50))
    hand: Mapped[Optional[str]] = mapped_column(String(10))
    string_number: Mapped[Optional[int]] = mapped_column(Integer)
    technique_detail: Mapped[Optional[str]] = mapped_column(Text)
    is_manual_correction: Mapped[bool] = mapped_column(default=False)
    correction_reason: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    score: Mapped["Score"] = relationship(back_populates="fingering_annotations")


class Measure(Base):
    __tablename__ = "measures"

    id: Mapped[int] = mapped_column(primary_key=True)
    score_id: Mapped[int] = mapped_column(ForeignKey("scores.id"))
    version_id: Mapped[int] = mapped_column(ForeignKey("score_versions.id"))
    measure_number: Mapped[int] = mapped_column(Integer)
    start_position: Mapped[Optional[float]] = mapped_column(Float)
    end_position: Mapped[Optional[float]] = mapped_column(Float)
    beat_count: Mapped[Optional[float]] = mapped_column(Float)
    time_signature: Mapped[Optional[str]] = mapped_column(String(20))
    is_manually_adjusted: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    score: Mapped["Score"] = relationship(back_populates="measures")


class StudentAnnotation(Base):
    __tablename__ = "student_annotations"

    id: Mapped[int] = mapped_column(primary_key=True)
    score_id: Mapped[int] = mapped_column(ForeignKey("scores.id"))
    version_id: Mapped[Optional[int]] = mapped_column(ForeignKey("score_versions.id"))
    measure_number: Mapped[Optional[int]] = mapped_column(Integer)
    student_name: Mapped[str] = mapped_column(String(100))
    content: Mapped[str] = mapped_column(Text)
    annotation_type: Mapped[Optional[str]] = mapped_column(String(50))
    is_resolved: Mapped[bool] = mapped_column(default=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    score: Mapped["Score"] = relationship(back_populates="student_annotations")


class ProofreadReport(Base):
    __tablename__ = "proofread_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    score_id: Mapped[int] = mapped_column(ForeignKey("scores.id"))
    version_id: Mapped[int] = mapped_column(ForeignKey("score_versions.id"))
    report_type: Mapped[str] = mapped_column(String(50))
    summary: Mapped[str] = mapped_column(Text)
    anomaly_count: Mapped[int] = mapped_column(Integer, default=0)
    detail_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Anomaly(Base):
    __tablename__ = "anomalies"

    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("proofread_reports.id"))
    anomaly_type: Mapped[str] = mapped_column(String(50))
    severity: Mapped[str] = mapped_column(String(20), default=AnomalySeverity.warning)
    measure_number: Mapped[Optional[int]] = mapped_column(Integer)
    description: Mapped[str] = mapped_column(Text)
    cause_analysis: Mapped[Optional[str]] = mapped_column(Text)
    affected_data_json: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    action: Mapped[str] = mapped_column(String(30))
    entity_type: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[Optional[int]] = mapped_column(Integer)
    version_id: Mapped[Optional[int]] = mapped_column(Integer)
    operator: Mapped[Optional[str]] = mapped_column(String(100))
    before_json: Mapped[Optional[str]] = mapped_column(Text)
    after_json: Mapped[Optional[str]] = mapped_column(Text)
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
