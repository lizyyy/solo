from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class AdPlan(Base):
    __tablename__ = "ad_plans"

    id = Column(Integer, primary_key=True, index=True)
    plan_name = Column(String(255), nullable=False)
    channel = Column(String(100), nullable=False)
    budget = Column(Float, nullable=False)
    version = Column(Integer, default=1)
    original_input = Column(Text, nullable=False)
    processed_result = Column(Text, nullable=True)
    review_status = Column(String(50), default="待审核")
    spend_status = Column(String(50), default="未开始")
    actual_spend = Column(Float, default=0)
    is_paused = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    status_logs = relationship("StatusLog", back_populates="ad_plan")
    pause_rules = relationship("PauseRule", back_populates="ad_plan")
    reports = relationship("DeliveryReport", back_populates="ad_plan")

class StatusLog(Base):
    __tablename__ = "status_logs"

    id = Column(Integer, primary_key=True, index=True)
    ad_plan_id = Column(Integer, ForeignKey("ad_plans.id"))
    field_name = Column(String(100), nullable=False)
    old_value = Column(Text)
    new_value = Column(Text)
    change_reason = Column(Text)
    operator = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ad_plan = relationship("AdPlan", back_populates="status_logs")

class PauseRule(Base):
    __tablename__ = "pause_rules"

    id = Column(Integer, primary_key=True, index=True)
    ad_plan_id = Column(Integer, ForeignKey("ad_plans.id"))
    rule_type = Column(String(100), nullable=False)
    rule_value = Column(String(255))
    reason = Column(Text, nullable=False)
    operator = Column(String(100))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ad_plan = relationship("AdPlan", back_populates="pause_rules")

class DeliveryReport(Base):
    __tablename__ = "delivery_reports"

    id = Column(Integer, primary_key=True, index=True)
    ad_plan_id = Column(Integer, ForeignKey("ad_plans.id"))
    report_date = Column(String(20))
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    spend = Column(Float, default=0)
    ctr = Column(Float, default=0)
    cpc = Column(Float, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ad_plan = relationship("AdPlan", back_populates="reports")
