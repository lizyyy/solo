from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Forklift(Base):
    __tablename__ = "forklifts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True)
    battery_level = Column(Float, default=100.0)
    status = Column(String(20), default="idle")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    charging_tasks = relationship("ChargingTask", back_populates="forklift")


class ChargingPile(Base):
    __tablename__ = "charging_piles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True)
    status = Column(String(20), default="available")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    charging_tasks = relationship("ChargingTask", back_populates="charging_pile")


class ChargingTask(Base):
    __tablename__ = "charging_tasks"

    id = Column(Integer, primary_key=True, index=True)
    forklift_id = Column(Integer, ForeignKey("forklifts.id"))
    charging_pile_id = Column(Integer, ForeignKey("charging_piles.id"))
    shift = Column(String(20))
    requested_by = Column(String(50))
    status = Column(String(20), default="pending")
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    forklift = relationship("Forklift", back_populates="charging_tasks")
    charging_pile = relationship("ChargingPile", back_populates="charging_tasks")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String(50))
    operator = Column(String(50))
    target_id = Column(Integer)
    target_type = Column(String(50))
    status = Column(String(20))
    reason = Column(Text)
    details = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
