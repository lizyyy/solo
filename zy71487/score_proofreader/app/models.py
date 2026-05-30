import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class IssueType(str, enum.Enum):
    MEASURE_MISMATCH = "measure_mismatch"
    MISSING_PAGES = "missing_pages"
    VERSION_CONFLICT = "version_conflict"


class RecordStatus(str, enum.Enum):
    PROCESSED = "processed"
    PENDING_CONFIRM = "pending_confirm"
    RETURNED_FOR_MATERIALS = "returned_for_materials"


VALID_TRANSITIONS: dict[RecordStatus, set[RecordStatus]] = {
    RecordStatus.PENDING_CONFIRM: {
        RecordStatus.PROCESSED,
        RecordStatus.RETURNED_FOR_MATERIALS,
    },
    RecordStatus.RETURNED_FOR_MATERIALS: {
        RecordStatus.PENDING_CONFIRM,
    },
    RecordStatus.PROCESSED: set(),
}


class FullScore(Base):
    __tablename__ = "full_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    composer: Mapped[str] = mapped_column(String(128), nullable=False)
    version: Mapped[str] = mapped_column(String(32), nullable=False)
    measure_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    part_scores: Mapped[list["PartScore"]] = relationship(
        back_populates="full_score", cascade="all, delete-orphan"
    )
    records: Mapped[list["ProofreadRecord"]] = relationship(
        back_populates="full_score", cascade="all, delete-orphan"
    )


class PartScore(Base):
    __tablename__ = "part_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    full_score_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("full_scores.id"), nullable=False
    )
    voice_part: Mapped[str] = mapped_column(String(64), nullable=False)
    version: Mapped[str] = mapped_column(String(32), nullable=False)
    measure_start: Mapped[int] = mapped_column(Integer, nullable=False)
    measure_end: Mapped[int] = mapped_column(Integer, nullable=False)
    page_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    full_score: Mapped["FullScore"] = relationship(back_populates="part_scores")
    records: Mapped[list["ProofreadRecord"]] = relationship(
        back_populates="part_score", cascade="all, delete-orphan"
    )


class ProofreadRecord(Base):
    __tablename__ = "proofread_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    full_score_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("full_scores.id"), nullable=False
    )
    part_score_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("part_scores.id"), nullable=False
    )
    issue_type: Mapped[IssueType] = mapped_column(
        Enum(IssueType), nullable=False
    )
    status: Mapped[RecordStatus] = mapped_column(
        Enum(RecordStatus), nullable=False, default=RecordStatus.PENDING_CONFIRM
    )
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    full_score: Mapped["FullScore"] = relationship(back_populates="records")
    part_score: Mapped["PartScore"] = relationship(back_populates="records")
