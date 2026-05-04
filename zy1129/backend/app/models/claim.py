from sqlalchemy import Column, Integer, String, Date, DateTime, Text, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    policy_id = Column(Integer, ForeignKey("policies.id"), nullable=False)
    coverage_id = Column(Integer, ForeignKey("coverages.id"), nullable=True)
    claim_number = Column(String(50), unique=True, nullable=False)
    submit_date = Column(Date, nullable=True)
    claim_amount = Column(Numeric(10, 2), nullable=True)
    approved_amount = Column(Numeric(10, 2), nullable=True)
    deductible_applied = Column(Numeric(10, 2), nullable=True)
    status = Column(String(20), default="draft")
    rejection_reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    policy = relationship("Policy")
    coverage = relationship("Coverage")
    status_timeline = relationship("ClaimStatusTimeline", backref="claim", cascade="all, delete-orphan")
    documents = relationship("ClaimDocument", backref="claim", cascade="all, delete-orphan")
