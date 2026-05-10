import enum
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class ReviewStatus(enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class Review(BaseModel):
    """裁判复核记录"""

    __tablename__ = "reviews"

    appeal_id = Column(Integer, ForeignKey("appeals.id"), nullable=True, index=True)
    result_version_id = Column(Integer, ForeignKey("result_versions.id"), nullable=True, index=True)
    reviewer_id = Column(String(50), nullable=False)
    reviewer_name = Column(String(100), nullable=False)
    status = Column(String(20), nullable=False, default=ReviewStatus.DRAFT.value)
    review_type = Column(String(50), nullable=True)
    findings = Column(Text, nullable=False)
    recommended_action = Column(Text, nullable=True)
    evidence_sources = Column(Text, nullable=True)
    decision = Column(Text, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    approved_by = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    appeal = relationship("Appeal", back_populates="reviews")
    result_version = relationship("ResultVersion", back_populates="reviews")
