from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Coverage(Base):
    __tablename__ = "coverages"

    id = Column(Integer, primary_key=True, index=True)
    policy_id = Column(Integer, ForeignKey("policies.id"), nullable=False)
    coverage_type = Column(String(50), nullable=False)
    coverage_limit = Column(Numeric(10, 2), nullable=False)
    deductible = Column(Numeric(10, 2), nullable=True)
    reimbursement_ratio = Column(Numeric(5, 4), default=1.0)
    waiting_period_days = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
