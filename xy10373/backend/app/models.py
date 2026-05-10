from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class Patient(Base):
    __tablename__ = "patients"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(50), nullable=False)
    gender = Column(String(10), nullable=False)
    age = Column(Integer, nullable=False)
    id_card = Column(String(18), index=True)
    ward = Column(String(50), nullable=False)
    bed_no = Column(String(20))
    admission_date = Column(Date, nullable=False)
    discharge_date = Column(Date, nullable=True)
    diagnosis = Column(String(200))
    contact_phone = Column(String(20))
    is_discharged = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    certificates = relationship("CareCertificate", back_populates="patient")
    replacement_requests = relationship("ReplacementRequest", back_populates="patient")
    logs = relationship("OperationLog", back_populates="patient")


class WardRule(Base):
    __tablename__ = "ward_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    ward_name = Column(String(50), unique=True, nullable=False)
    max_caregivers = Column(Integer, default=1, nullable=False)
    default_validity_days = Column(Integer, default=7, nullable=False)
    description = Column(String(500))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class Caregiver(Base):
    __tablename__ = "caregivers"
    
    id = Column(Integer, primary_key=True, index=True)
    caregiver_id = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(50), nullable=False)
    gender = Column(String(10), nullable=False)
    id_card = Column(String(18), unique=True, index=True, nullable=False)
    relation_to_patient = Column(String(50), nullable=False)
    phone = Column(String(20))
    address = Column(String(200))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    certificates = relationship("CareCertificate", back_populates="caregiver")


class CareCertificate(Base):
    __tablename__ = "care_certificates"
    
    id = Column(Integer, primary_key=True, index=True)
    certificate_no = Column(String(30), unique=True, index=True, nullable=False)
    patient_id = Column(String(20), ForeignKey("patients.patient_id"), nullable=False)
    caregiver_id = Column(String(20), ForeignKey("caregivers.caregiver_id"), nullable=False)
    issue_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=False)
    status = Column(String(20), default="active", nullable=False)
    source_file = Column(String(200))
    notes = Column(Text)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    patient = relationship("Patient", back_populates="certificates")
    caregiver = relationship("Caregiver", back_populates="certificates")
    replacement_requests = relationship("ReplacementRequest", back_populates="certificate")
    logs = relationship("OperationLog", back_populates="certificate")


class ReplacementRequest(Base):
    __tablename__ = "replacement_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    request_no = Column(String(30), unique=True, index=True, nullable=False)
    certificate_id = Column(Integer, ForeignKey("care_certificates.id"), nullable=False)
    patient_id = Column(String(20), ForeignKey("patients.patient_id"), nullable=False)
    old_caregiver_id = Column(String(20), nullable=False)
    new_caregiver_name = Column(String(50), nullable=False)
    new_caregiver_id_card = Column(String(18), nullable=False)
    new_caregiver_relation = Column(String(50), nullable=False)
    new_caregiver_phone = Column(String(20))
    reason = Column(String(500), nullable=False)
    requested_by = Column(String(50), nullable=False)
    request_date = Column(DateTime, default=func.now())
    status = Column(String(20), default="pending", nullable=False)
    approved_by = Column(String(50))
    approval_date = Column(DateTime)
    approval_notes = Column(String(500))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    certificate = relationship("CareCertificate", back_populates="replacement_requests")
    patient = relationship("Patient", back_populates="replacement_requests")


class OperationLog(Base):
    __tablename__ = "operation_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String(50), nullable=False)
    patient_id = Column(String(20), ForeignKey("patients.patient_id"))
    certificate_id = Column(Integer, ForeignKey("care_certificates.id"))
    operator = Column(String(50), nullable=False)
    action = Column(String(200), nullable=False)
    old_value = Column(Text)
    new_value = Column(Text)
    source_file = Column(String(200))
    result = Column(String(20), nullable=False)
    notes = Column(String(500))
    created_at = Column(DateTime, default=func.now())
    
    patient = relationship("Patient", back_populates="logs")
    certificate = relationship("CareCertificate", back_populates="logs")
