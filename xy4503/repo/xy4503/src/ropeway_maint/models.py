from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base


class Cabin(Base):
    __tablename__ = "cabins"

    id = Column(Integer, primary_key=True, index=True)
    cabin_number = Column(String(50), unique=True, index=True, nullable=False)
    status = Column(String(50), default="正常")
    max_capacity = Column(Integer, default=8)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WireRope(Base):
    __tablename__ = "wire_ropes"

    id = Column(Integer, primary_key=True, index=True)
    rope_id = Column(String(50), unique=True, index=True, nullable=False)
    location = Column(String(100))
    installation_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class Gripper(Base):
    __tablename__ = "grippers"

    id = Column(Integer, primary_key=True, index=True)
    gripper_id = Column(String(50), unique=True, index=True, nullable=False)
    cabin_number = Column(String(50), ForeignKey("cabins.cabin_number"))
    last_lubrication_date = Column(DateTime)
    lubrication_interval_days = Column(Integer, default=30)
    created_at = Column(DateTime, default=datetime.utcnow)


class CabinInspection(Base):
    __tablename__ = "cabin_inspections"

    id = Column(Integer, primary_key=True, index=True)
    inspection_date = Column(DateTime, index=True, nullable=False)
    cabin_number = Column(String(50), ForeignKey("cabins.cabin_number"), nullable=False)
    inspector = Column(String(100))
    condition = Column(String(20))
    issues = Column(Text)
    status = Column(String(50), default="正常")
    created_at = Column(DateTime, default=datetime.utcnow)


class WireRopeInspection(Base):
    __tablename__ = "wire_rope_inspections"

    id = Column(Integer, primary_key=True, index=True)
    inspection_date = Column(DateTime, index=True, nullable=False)
    rope_id = Column(String(50), ForeignKey("wire_ropes.rope_id"), nullable=False)
    broken_wires = Column(Integer, default=0)
    corrosion = Column(String(50))
    wear_percentage = Column(Float, default=0.0)
    abnormal = Column(String(10))
    issues = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class WindSpeedRecord(Base):
    __tablename__ = "wind_speed_records"

    id = Column(Integer, primary_key=True, index=True)
    record_date = Column(DateTime, index=True, nullable=False)
    time_slot = Column(String(50))
    wind_speed = Column(Float, nullable=False)
    direction = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)


class GripperLubrication(Base):
    __tablename__ = "gripper_lubrications"

    id = Column(Integer, primary_key=True, index=True)
    record_date = Column(DateTime, index=True, nullable=False)
    gripper_id = Column(String(50), ForeignKey("grippers.gripper_id"), nullable=False)
    cabin_number = Column(String(50))
    lubrication_date = Column(DateTime)
    technician = Column(String(100))
    status = Column(String(50), default="已完成")
    created_at = Column(DateTime, default=datetime.utcnow)


class ReservationPeak(Base):
    __tablename__ = "reservation_peaks"

    id = Column(Integer, primary_key=True, index=True)
    record_date = Column(DateTime, index=True, nullable=False)
    time_slot = Column(String(50))
    peak_count = Column(Integer, nullable=False)
    estimated_arrival = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)


class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    shift_date = Column(DateTime, index=True, nullable=False)
    shift_name = Column(String(50), nullable=False)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    status = Column(String(50), default="正常")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(Integer, primary_key=True, index=True)
    assessment_date = Column(DateTime, index=True, nullable=False)
    shift_id = Column(Integer, ForeignKey("shifts.id"))
    cabin_number = Column(String(50))
    risk_type = Column(String(100), nullable=False)
    risk_level = Column(String(50), default="低")
    action_required = Column(String(50))
    reason = Column(Text)
    status = Column(String(50), default="待处理")
    created_at = Column(DateTime, default=datetime.utcnow)


class ReviewNote(Base):
    __tablename__ = "review_notes"

    id = Column(Integer, primary_key=True, index=True)
    risk_id = Column(Integer, ForeignKey("risk_assessments.id"))
    reviewer = Column(String(100), nullable=False)
    note = Column(Text, nullable=False)
    action_taken = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
