from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    real_name = Column(String(50), nullable=False)
    role = Column(String(20), nullable=False)
    created_at = Column(DateTime, default=datetime.now)


class Prescription(Base):
    __tablename__ = "prescriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    prescription_no = Column(String(30), unique=True, nullable=False)
    patient_name = Column(String(50), nullable=False)
    patient_age = Column(Integer)
    patient_gender = Column(String(10))
    patient_id_card = Column(String(18))
    department = Column(String(50))
    doctor_name = Column(String(50))
    diagnosis = Column(String(200))
    herbal_items = Column(Text, nullable=False)
    total_doses = Column(Integer, nullable=False)
    decoction_type = Column(String(20), default="常规煎煮")
    special_instructions = Column(Text)
    priority = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)
    submit_source = Column(String(50), nullable=False)
    submitted_by = Column(String(50), nullable=False)
    submitted_at = Column(DateTime, default=datetime.now)


class DecoctionPot(Base):
    __tablename__ = "decoction_pots"
    
    id = Column(Integer, primary_key=True, index=True)
    pot_no = Column(String(20), unique=True, nullable=False)
    capacity_liters = Column(Float, nullable=False)
    status = Column(String(20), default="空闲")
    current_prescription_count = Column(Integer, default=0)
    last_maintenance_at = Column(DateTime)


class QueueEntry(Base):
    __tablename__ = "queue_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    queue_no = Column(String(30), unique=True, nullable=False)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False)
    status = Column(String(30), nullable=False)
    pot_id = Column(Integer, ForeignKey("decoction_pots.id"))
    queue_position = Column(Integer)
    estimated_start_time = Column(DateTime)
    actual_start_time = Column(DateTime)
    completed_at = Column(DateTime)
    is_same_pot = Column(Boolean, default=False)
    same_pot_group_id = Column(String(30))
    cancellation_requested = Column(Boolean, default=False)
    cancellation_requested_by = Column(String(50))
    cancellation_requested_at = Column(DateTime)
    cancellation_reason = Column(Text)
    exception_flag = Column(Boolean, default=False)
    exception_notes = Column(Text)
    exception_handled_by = Column(String(50))
    exception_handled_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    updated_by = Column(String(50))
    
    prescription = relationship("Prescription", backref="queue_entries")
    pot = relationship("DecoctionPot", backref="queue_entries")


class StatusHistory(Base):
    __tablename__ = "status_history"
    
    id = Column(Integer, primary_key=True, index=True)
    queue_entry_id = Column(Integer, ForeignKey("queue_entries.id"), nullable=False)
    from_status = Column(String(30))
    to_status = Column(String(30), nullable=False)
    action = Column(String(50), nullable=False)
    performed_by = Column(String(50), nullable=False)
    performed_by_role = Column(String(20), nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    
    queue_entry = relationship("QueueEntry", backref="status_histories")


class SamePotGroup(Base):
    __tablename__ = "same_pot_groups"
    
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(String(30), unique=True, nullable=False)
    pot_id = Column(Integer, ForeignKey("decoction_pots.id"))
    status = Column(String(30), nullable=False)
    total_prescriptions = Column(Integer, default=0)
    active_prescriptions = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_by = Column(String(50), nullable=False)
