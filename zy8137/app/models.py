from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Machinery(Base):
    __tablename__ = "machinery"
    
    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String, unique=True, index=True, nullable=False)
    machine_type = Column(String, nullable=False)
    machine_name = Column(String)
    driver_name = Column(String)
    driver_phone = Column(String)
    working_width = Column(Float)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    
    trajectories = relationship("GPSTrajectory", back_populates="machinery")
    work_sessions = relationship("WorkSession", back_populates="machinery")
    settlements = relationship("SettlementRecord", back_populates="machinery")


class GPSTrajectory(Base):
    __tablename__ = "gps_trajectory"
    
    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String, ForeignKey("machinery.machine_id"), index=True)
    timestamp = Column(DateTime, index=True, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    speed = Column(Float)
    direction = Column(Float)
    working_status = Column(String)
    raw_data = Column(Text)
    cross_midnight = Column(Boolean, default=False)
    
    machinery = relationship("Machinery", back_populates="trajectories")


class PlotContract(Base):
    __tablename__ = "plot_contract"
    
    id = Column(Integer, primary_key=True, index=True)
    plot_id = Column(String, unique=True, index=True, nullable=False)
    plot_name = Column(String)
    village = Column(String)
    farmer_name = Column(String)
    plot_area = Column(Float)
    boundary_wkt = Column(Text)
    boundary_missing = Column(Boolean, default=False)
    contract_start_date = Column(DateTime)
    contract_end_date = Column(DateTime)
    price_per_mu = Column(Float)
    created_at = Column(DateTime)
    
    work_sessions = relationship("WorkSession", back_populates="plot_contract")


class PricingRule(Base):
    __tablename__ = "pricing_rule"
    
    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String, unique=True, nullable=False)
    machine_type = Column(String, index=True)
    base_price_per_mu = Column(Float)
    night_surcharge_rate = Column(Float, default=0.0)
    night_start_hour = Column(Integer, default=22)
    night_end_hour = Column(Integer, default=6)
    empty_driving_deduction_rate = Column(Float, default=0.0)
    empty_driving_speed_threshold = Column(Float, default=15.0)
    minimum_working_speed = Column(Float, default=2.0)
    maximum_working_speed = Column(Float, default=12.0)
    work_session_gap_minutes = Column(Integer, default=30)
    overlap_detection_distance = Column(Float, default=5.0)
    created_at = Column(DateTime)
    is_active = Column(Boolean, default=True)


class WorkSession(Base):
    __tablename__ = "work_session"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, index=True, nullable=False)
    machine_id = Column(String, ForeignKey("machinery.machine_id"), index=True)
    plot_id = Column(String, ForeignKey("plot_contract.plot_id"), index=True)
    start_time = Column(DateTime, index=True)
    end_time = Column(DateTime, index=True)
    duration_minutes = Column(Float)
    total_distance_km = Column(Float)
    working_distance_km = Column(Float)
    empty_distance_km = Column(Float)
    calculated_area_mu = Column(Float)
    night_working_area_mu = Column(Float)
    is_cross_midnight = Column(Boolean, default=False)
    has_boundary_missing = Column(Boolean, default=False)
    created_at = Column(DateTime)
    
    machinery = relationship("Machinery", back_populates="work_sessions")
    plot_contract = relationship("PlotContract", back_populates="work_sessions")
    anomalies = relationship("AnomalyRecord", back_populates="work_session")
    settlements = relationship("SettlementRecord", back_populates="work_session")


class SettlementRecord(Base):
    __tablename__ = "settlement_record"
    
    id = Column(Integer, primary_key=True, index=True)
    settlement_id = Column(String, unique=True, index=True, nullable=False)
    machine_id = Column(String, ForeignKey("machinery.machine_id"), index=True)
    work_session_id = Column(String, ForeignKey("work_session.session_id"), index=True)
    plot_id = Column(String, index=True)
    settlement_date = Column(DateTime, index=True)
    
    total_area_mu = Column(Float)
    night_area_mu = Column(Float)
    empty_deduction_area_mu = Column(Float)
    billable_area_mu = Column(Float)
    
    price_per_mu = Column(Float)
    night_surcharge = Column(Float)
    empty_driving_deduction = Column(Float)
    total_amount = Column(Float)
    
    status = Column(String, default="pending")
    created_at = Column(DateTime)
    reviewed_at = Column(DateTime)
    reviewer = Column(String)
    review_notes = Column(Text)
    
    machinery = relationship("Machinery", back_populates="settlements")
    work_session = relationship("WorkSession", back_populates="settlements")


class AnomalyRecord(Base):
    __tablename__ = "anomaly_record"
    
    id = Column(Integer, primary_key=True, index=True)
    anomaly_id = Column(String, unique=True, index=True, nullable=False)
    work_session_id = Column(String, ForeignKey("work_session.session_id"), index=True)
    machine_id = Column(String, index=True)
    plot_id = Column(String, index=True)
    
    anomaly_type = Column(String, index=True)
    severity = Column(String)
    description = Column(Text)
    details = Column(Text)
    
    detected_at = Column(DateTime)
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime)
    resolution_notes = Column(Text)
    
    work_session = relationship("WorkSession", back_populates="anomalies")
