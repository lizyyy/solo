from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base
import enum

class PatientStatus(str, enum.Enum):
    NORMAL_CARE = "normal_care"  # 转普通护理
    NEED_REVIEW = "need_review"  # 需要复查
    ALERT = "alert"  # 必须报警

class DataSource(str, enum.Enum):
    ANESTHESIA = "anesthesia"
    INFUSION = "infusion"
    CAGE = "cage"
    MEDICATION = "medication"

class AnesthesiaRecord(Base):
    __tablename__ = "anesthesia_records"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String(50), index=True, nullable=False)
    patient_name = Column(String(100), nullable=True)
    species = Column(String(50), nullable=True)
    breed = Column(String(100), nullable=True)
    
    anesthesia_start_time = Column(DateTime, nullable=True)
    anesthesia_end_time = Column(DateTime, nullable=True)
    awakening_time = Column(DateTime, nullable=True)
    
    anesthetic_type = Column(String(100), nullable=True)
    dosage = Column(Float, nullable=True)
    
    heart_rate = Column(Float, nullable=True)
    respiratory_rate = Column(Float, nullable=True)
    blood_pressure_systolic = Column(Float, nullable=True)
    blood_pressure_diastolic = Column(Float, nullable=True)
    temperature = Column(Float, nullable=True)
    spo2 = Column(Float, nullable=True)
    
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class InfusionPumpLog(Base):
    __tablename__ = "infusion_pump_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String(50), index=True, nullable=False)
    
    log_time = Column(DateTime, nullable=False)
    drug_name = Column(String(100), nullable=True)
    concentration = Column(String(50), nullable=True)
    
    infusion_rate = Column(Float, nullable=True)
    volume_infused = Column(Float, nullable=True)
    volume_remaining = Column(Float, nullable=True)
    
    is_interrupted = Column(Boolean, default=False)
    interruption_reason = Column(Text, nullable=True)
    interruption_start_time = Column(DateTime, nullable=True)
    interruption_end_time = Column(DateTime, nullable=True)
    
    pump_status = Column(String(50), nullable=True)
    alarms = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

class CageSensor(Base):
    __tablename__ = "cage_sensors"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String(50), index=True, nullable=False)
    cage_number = Column(String(50), nullable=True)
    
    reading_time = Column(DateTime, nullable=False)
    
    temperature = Column(Float, nullable=True)
    temperature_min = Column(Float, default=36.0)
    temperature_max = Column(Float, default=39.0)
    
    oxygen_level = Column(Float, nullable=True)
    oxygen_min = Column(Float, default=90.0)
    oxygen_max = Column(Float, default=100.0)
    
    humidity = Column(Float, nullable=True)
    
    is_temperature_abnormal = Column(Boolean, default=False)
    is_oxygen_abnormal = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)

class MedicationPlan(Base):
    __tablename__ = "medication_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String(50), index=True, nullable=False)
    
    drug_name = Column(String(100), nullable=False)
    generic_name = Column(String(100), nullable=True)
    
    dosage = Column(String(100), nullable=True)
    dosage_value = Column(Float, nullable=True)
    dosage_unit = Column(String(50), nullable=True)
    
    route = Column(String(50), nullable=True)
    frequency = Column(String(100), nullable=True)
    
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    
    prescribing_vet = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    
    is_conflict = Column(Boolean, default=False)
    conflict_drugs = Column(Text, nullable=True)
    conflict_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class HandoffRecord(Base):
    __tablename__ = "handoff_records"
    
    id = Column(Integer, primary_key=True, index=True)
    handoff_id = Column(String(100), unique=True, index=True, nullable=False)
    
    patient_id = Column(String(50), index=True, nullable=False)
    patient_name = Column(String(100), nullable=True)
    species = Column(String(50), nullable=True)
    breed = Column(String(100), nullable=True)
    
    shift_date = Column(DateTime, nullable=False)
    nurse_name = Column(String(100), nullable=True)
    
    status = Column(Enum(PatientStatus), default=PatientStatus.NEED_REVIEW)
    final_status = Column(Enum(PatientStatus), nullable=True)
    
    has_awakening_timeout = Column(Boolean, default=False)
    has_infusion_interruption = Column(Boolean, default=False)
    has_temp_oxygen_abnormal = Column(Boolean, default=False)
    has_medication_conflict = Column(Boolean, default=False)
    
    abnormal_details = Column(Text, nullable=True)
    
    nurse_review_notes = Column(Text, nullable=True)
    is_reviewed = Column(Boolean, default=False)
    reviewed_by = Column(String(100), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    handoff_id = Column(String(100), index=True, nullable=True)
    patient_id = Column(String(50), index=True, nullable=True)
    
    action = Column(String(100), nullable=False)
    action_details = Column(Text, nullable=True)
    
    performed_by = Column(String(100), nullable=True)
    performed_at = Column(DateTime, default=datetime.utcnow)
    
    created_at = Column(DateTime, default=datetime.utcnow)
