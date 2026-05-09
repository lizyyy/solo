from sqlalchemy import Column, Integer, String, Float, DateTime, Date, Boolean, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class PriceWindow(Base):
    __tablename__ = "price_windows"

    id = Column(Integer, primary_key=True, index=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    price_per_kwh = Column(Float, nullable=False)
    window_type = Column(String(50), nullable=False)
    is_charge_window = Column(Boolean, default=False)
    is_discharge_window = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    segments = relationship("PlanSegment", back_populates="price_window")

class SOCConstraint(Base):
    __tablename__ = "soc_constraints"

    id = Column(Integer, primary_key=True, index=True)
    plan_date = Column(Date, nullable=False)
    min_soc = Column(Float, nullable=False)
    max_soc = Column(Float, nullable=False)
    initial_soc = Column(Float, nullable=False)
    target_soc = Column(Float, nullable=True)
    station_id = Column(String(100), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    plans = relationship("ChargePlan", back_populates="soc_constraint")

class ChargePlan(Base):
    __tablename__ = "charge_plans"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(String(100), nullable=False, index=True)
    plan_date = Column(Date, nullable=False, index=True)
    plan_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    version = Column(Integer, default=1)
    status = Column(String(50), nullable=False, default="draft")
    soc_constraint_id = Column(Integer, ForeignKey("soc_constraints.id"), nullable=False)
    load_forecast_data = Column(JSON, nullable=True)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    soc_constraint = relationship("SOCConstraint", back_populates="plans")
    segments = relationship("PlanSegment", back_populates="plan", cascade="all, delete-orphan")
    versions = relationship("PlanVersion", back_populates="plan", cascade="all, delete-orphan")
    execution_receipts = relationship("ExecutionReceipt", back_populates="plan", cascade="all, delete-orphan")
    alerts = relationship("DeviationAlert", back_populates="plan", cascade="all, delete-orphan")
    revenue_reports = relationship("RevenueReport", back_populates="plan", cascade="all, delete-orphan")
    history = relationship("PlanHistory", back_populates="plan", cascade="all, delete-orphan")

class PlanSegment(Base):
    __tablename__ = "plan_segments"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("charge_plans.id"), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    operation_type = Column(String(20), nullable=False)
    power_kw = Column(Float, nullable=False)
    energy_kwh = Column(Float, nullable=False)
    expected_soc = Column(Float, nullable=False)
    price_window_id = Column(Integer, ForeignKey("price_windows.id"), nullable=True)

    plan = relationship("ChargePlan", back_populates="segments")
    price_window = relationship("PriceWindow", back_populates="segments")
    execution_receipts = relationship("ExecutionReceipt", back_populates="segment", cascade="all, delete-orphan")
    alerts = relationship("DeviationAlert", back_populates="segment")

class PlanVersion(Base):
    __tablename__ = "plan_versions"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("charge_plans.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    status = Column(String(50), nullable=False)
    change_reason = Column(Text, nullable=True)
    changed_by = Column(String(100), nullable=True)
    snapshot_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    plan = relationship("ChargePlan", back_populates="versions")

class ExecutionReceipt(Base):
    __tablename__ = "execution_receipts"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("charge_plans.id"), nullable=False, index=True)
    segment_id = Column(Integer, ForeignKey("plan_segments.id"), nullable=False, index=True)
    actual_start_time = Column(DateTime, nullable=False)
    actual_end_time = Column(DateTime, nullable=False)
    actual_power_kw = Column(Float, nullable=False)
    actual_energy_kwh = Column(Float, nullable=False)
    actual_soc = Column(Float, nullable=False)
    equipment_status = Column(String(50), nullable=False)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    plan = relationship("ChargePlan", back_populates="execution_receipts")
    segment = relationship("PlanSegment", back_populates="execution_receipts")

class DeviationAlert(Base):
    __tablename__ = "deviation_alerts"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("charge_plans.id"), nullable=False, index=True)
    segment_id = Column(Integer, ForeignKey("plan_segments.id"), nullable=True, index=True)
    alert_type = Column(String(100), nullable=False)
    alert_level = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    deviation_value = Column(Float, nullable=True)
    threshold_value = Column(Float, nullable=True)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(String(100), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    plan = relationship("ChargePlan", back_populates="alerts")
    segment = relationship("PlanSegment", back_populates="alerts")

class RevenueReport(Base):
    __tablename__ = "revenue_reports"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("charge_plans.id"), nullable=False, index=True)
    station_id = Column(String(100), nullable=False, index=True)
    report_date = Column(Date, nullable=False, index=True)
    total_charge_kwh = Column(Float, nullable=False, default=0)
    total_discharge_kwh = Column(Float, nullable=False, default=0)
    charge_cost = Column(Float, nullable=False, default=0)
    discharge_revenue = Column(Float, nullable=False, default=0)
    net_profit = Column(Float, nullable=False, default=0)
    efficiency_rate = Column(Float, nullable=False, default=0)
    deviation_rate = Column(Float, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    plan = relationship("ChargePlan", back_populates="revenue_reports")

class PlanHistory(Base):
    __tablename__ = "plan_history"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("charge_plans.id"), nullable=False, index=True)
    action = Column(String(100), nullable=False)
    old_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=False)
    operator = Column(String(100), nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    plan = relationship("ChargePlan", back_populates="history")
