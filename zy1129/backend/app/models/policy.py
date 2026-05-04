from sqlalchemy import Column, Integer, String, Date, DateTime, Text, Boolean, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Policy(Base):
    __tablename__ = "policies"

    id = Column(Integer, primary_key=True, index=True)
    policy_number = Column(String(100), unique=True, nullable=False)
    insurance_company = Column(String(100), nullable=False)
    policy_type = Column(String(50), nullable=False)
    insured_member_id = Column(Integer, ForeignKey("members.id"), nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    waiting_period_days = Column(Integer, default=0)
    deductible_amount = Column(Numeric(10, 2), default=0)
    deductible_period = Column(String(20), default="annual")
    premium_amount = Column(Numeric(10, 2), nullable=True)
    payment_frequency = Column(String(20), nullable=True)
    next_renewal_date = Column(Date, nullable=True)
    policy_file_path = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    member = relationship("Member", backref="policies")
    coverages = relationship("Coverage", backref="policy", cascade="all, delete-orphan")
