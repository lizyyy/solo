from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, Numeric, JSON, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class ClaimCalculationResult(Base):
    __tablename__ = "claim_calculation_results"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    policy_id = Column(Integer, ForeignKey("policies.id"), nullable=False)
    calculated_at = Column(DateTime(timezone=True), server_default=func.now())
    is_coverable = Column(Boolean, default=True)
    risk_reasons = Column(JSON, nullable=True)
    to_do_items = Column(JSON, nullable=True)
    estimated_claimable_amount = Column(Numeric(10, 2), nullable=True)
    waiting_period_status = Column(String(20), default="not_started")
    deductible_status = Column(String(20), default="not_reached")
    report_deadline_status = Column(String(20), default="ok")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
