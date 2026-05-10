import enum
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class AppealStatus(enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    REVIEWING = "REVIEWING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    RESOLVED = "RESOLVED"


class Appeal(BaseModel):
    """申诉任务"""

    __tablename__ = "appeals"

    race_id = Column(Integer, ForeignKey("races.id"), nullable=False, index=True)
    appeal_number = Column(String(50), nullable=False, unique=True, index=True)
    athlete_id = Column(String(50), nullable=True, index=True)
    athlete_name = Column(String(100), nullable=True)
    bib_number = Column(String(20), nullable=True, index=True)
    status = Column(String(20), nullable=False, default=AppealStatus.PENDING.value)
    appeal_type = Column(String(50), nullable=True)
    description = Column(Text, nullable=False)
    supporting_documents = Column(Text, nullable=True)
    submitted_by = Column(String(100), nullable=False)
    submitted_at = Column(DateTime, nullable=False)
    assigned_to = Column(String(100), nullable=True)
    priority = Column(String(20), default="MEDIUM")  # LOW, MEDIUM, HIGH, CRITICAL
    deadline = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(100), nullable=True)

    race = relationship("Race", back_populates="appeals")
    reviews = relationship("Review", back_populates="appeal")
