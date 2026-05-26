from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Waybill(Base):
    __tablename__ = "waybills"

    id = Column(Integer, primary_key=True, index=True)
    waybill_no = Column(String, unique=True, index=True, nullable=False)
    order_no = Column(String, index=True)
    sender = Column(String)
    receiver = Column(String)
    origin_city = Column(String)
    dest_city = Column(String)
    product_name = Column(String)
    weight = Column(Float)
    volume = Column(Float)
    quantity = Column(Integer)
    declared_value = Column(Float)
    freight = Column(Float)
    planned_departure_time = Column(DateTime)
    planned_arrival_time = Column(DateTime)
    actual_departure_time = Column(DateTime)
    actual_arrival_time = Column(DateTime)
    transport_type = Column(String)
    carrier = Column(String)
    route_code = Column(String)
    status = Column(String, default="pending")
    damage_status = Column(String)
    damage_description = Column(Text)
    is_reconciled = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    batch_id = Column(String, index=True)

    tracking_records = relationship("TrackingRecord", back_populates="waybill")
    reconciliation = relationship("ReconciliationResult", back_populates="waybill", uselist=False)


class TrackingRecord(Base):
    __tablename__ = "tracking_records"

    id = Column(Integer, primary_key=True, index=True)
    waybill_id = Column(Integer, ForeignKey("waybills.id"))
    waybill_no = Column(String, index=True)
    timestamp = Column(DateTime, nullable=False)
    location = Column(String)
    city = Column(String)
    status = Column(String)
    status_code = Column(String)
    description = Column(Text)
    operator = Column(String)
    transfer_station = Column(String)
    is_transfer_point = Column(Boolean, default=False)
    scan_type = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    waybill = relationship("Waybill", back_populates="tracking_records")


class PenaltyRule(Base):
    __tablename__ = "penalty_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_code = Column(String, unique=True, index=True)
    rule_name = Column(String, nullable=False)
    rule_type = Column(String, nullable=False)
    penalty_type = Column(String)
    calculation_method = Column(String)
    base_value = Column(Float)
    percentage = Column(Float)
    min_penalty = Column(Float)
    max_penalty = Column(Float)
    threshold_hours = Column(Float)
    conditions = Column(JSON)
    exempt_conditions = Column(JSON)
    priority = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    version = Column(String, default="v1.0")
    effective_date = Column(DateTime)
    expiry_date = Column(DateTime)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ReconciliationResult(Base):
    __tablename__ = "reconciliation_results"

    id = Column(Integer, primary_key=True, index=True)
    waybill_id = Column(Integer, ForeignKey("waybills.id"), unique=True)
    waybill_no = Column(String, unique=True, index=True)
    batch_id = Column(String, index=True)
    delay_hours = Column(Float, default=0)
    delay_level = Column(String)
    is_delayed = Column(Boolean, default=False)
    is_damaged = Column(Boolean, default=False)
    damage_type = Column(String)
    damage_severity = Column(String)
    transfer_responsibility = Column(JSON)
    is_transfer_issue = Column(Boolean, default=False)
    total_penalty = Column(Float, default=0)
    delay_penalty = Column(Float, default=0)
    damage_penalty = Column(Float, default=0)
    transfer_penalty = Column(Float, default=0)
    exempt_reason = Column(String)
    is_exempt = Column(Boolean, default=False)
    is_duplicate_penalty = Column(Boolean, default=False)
    duplicate_source = Column(String)
    weather_exempt = Column(Boolean, default=False)
    weather_info = Column(JSON)
    penalty_details = Column(JSON)
    discrepancy_explanation = Column(Text)
    status = Column(String, default="auto_verified")
    review_status = Column(String, default="pending")
    reviewer = Column(String)
    review_comment = Column(Text)
    reviewed_at = Column(DateTime)
    auto_calculation_details = Column(JSON)
    manual_adjustment = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    waybill = relationship("Waybill", back_populates="reconciliation")
    review_records = relationship("ReviewRecord", back_populates="reconciliation")
    penalty_histories = relationship("PenaltyHistory", back_populates="reconciliation")


class ReviewRecord(Base):
    __tablename__ = "review_records"

    id = Column(Integer, primary_key=True, index=True)
    reconciliation_id = Column(Integer, ForeignKey("reconciliation_results.id"))
    waybill_no = Column(String, index=True)
    reviewer = Column(String)
    action = Column(String)
    old_status = Column(String)
    new_status = Column(String)
    old_total_penalty = Column(Float)
    new_total_penalty = Column(Float)
    adjustment_reason = Column(Text)
    evidence = Column(JSON)
    comment = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    reconciliation = relationship("ReconciliationResult", back_populates="review_records")


class PenaltyHistory(Base):
    __tablename__ = "penalty_histories"

    id = Column(Integer, primary_key=True, index=True)
    reconciliation_id = Column(Integer, ForeignKey("reconciliation_results.id"))
    waybill_no = Column(String, index=True)
    penalty_type = Column(String)
    rule_id = Column(Integer, ForeignKey("penalty_rules.id"))
    rule_code = Column(String)
    rule_name = Column(String)
    calculation_basis = Column(JSON)
    original_value = Column(Float)
    penalty_amount = Column(Float)
    source_type = Column(String)
    source_batch = Column(String)
    traceability_path = Column(JSON)
    is_adjusted = Column(Boolean, default=False)
    adjustment_reason = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    reconciliation = relationship("ReconciliationResult", back_populates="penalty_histories")


class ReconciliationBatch(Base):
    __tablename__ = "reconciliation_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, unique=True, index=True)
    batch_name = Column(String)
    period = Column(String)
    total_waybills = Column(Integer, default=0)
    reconciled_count = Column(Integer, default=0)
    pending_count = Column(Integer, default=0)
    exempt_count = Column(Integer, default=0)
    total_penalty = Column(Float, default=0)
    status = Column(String, default="processing")
    generated_by = Column(String)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime)
    summary = Column(JSON)


class WeatherExemption(Base):
    __tablename__ = "weather_exemptions"

    id = Column(Integer, primary_key=True, index=True)
    city = Column(String, index=True)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    weather_type = Column(String)
    severity = Column(String)
    description = Column(Text)
    affected_routes = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
