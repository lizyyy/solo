from datetime import datetime, date
from enum import Enum as PyEnum
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Date, Boolean, 
    Float, ForeignKey, Enum
)
from sqlalchemy.orm import relationship
from app.database import Base


class AnimalType(str, PyEnum):
    DOG = "dog"
    CAT = "cat"
    RABBIT = "rabbit"
    BIRD = "bird"
    OTHER = "other"


class InfectionRisk(str, PyEnum):
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class CageStatus(str, PyEnum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    MAINTENANCE = "maintenance"
    RESERVED = "reserved"


class HospitalizationStatus(str, PyEnum):
    PENDING = "pending"
    ADMITTED = "admitted"
    IN_TREATMENT = "in_treatment"
    TRANSFERRED = "transferred"
    DISCHARGED = "discharged"
    CANCELLED = "cancelled"


class OrderStatus(str, PyEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Pet(Base):
    __tablename__ = "pets"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    species = Column(Enum(AnimalType), nullable=False)
    breed = Column(String(100))
    age = Column(Integer)
    weight = Column(Float)
    gender = Column(String(20))
    owner_name = Column(String(100))
    owner_phone = Column(String(20))
    medical_history = Column(Text)
    allergy_info = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    hospitalizations = relationship("Hospitalization", back_populates="pet")
    medical_orders = relationship("MedicalOrder", back_populates="pet")


class Cage(Base):
    __tablename__ = "cages"
    
    id = Column(Integer, primary_key=True, index=True)
    cage_number = Column(String(50), unique=True, nullable=False)
    location = Column(String(100))
    status = Column(Enum(CageStatus), default=CageStatus.AVAILABLE)
    suitable_species = Column(Text)
    is_isolation = Column(Boolean, default=False)
    max_infection_risk = Column(Enum(InfectionRisk), default=InfectionRisk.LOW)
    current_pet_id = Column(Integer, ForeignKey("pets.id"), nullable=True)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MedicalOrder(Base):
    __tablename__ = "medical_orders"
    
    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id"), nullable=False)
    order_number = Column(String(50), unique=True, nullable=False)
    diagnosis = Column(Text, nullable=False)
    treatment_plan = Column(Text, nullable=False)
    infection_risk = Column(Enum(InfectionRisk), default=InfectionRisk.NONE)
    required_special_care = Column(Text)
    estimated_stay_days = Column(Integer)
    attending_vet = Column(String(100))
    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    pet = relationship("Pet", back_populates="medical_orders")
    hospitalizations = relationship("Hospitalization", back_populates="medical_order")


class Hospitalization(Base):
    __tablename__ = "hospitalizations"
    
    id = Column(Integer, primary_key=True, index=True)
    hospitalization_number = Column(String(50), unique=True, nullable=False)
    pet_id = Column(Integer, ForeignKey("pets.id"), nullable=False)
    cage_id = Column(Integer, ForeignKey("cages.id"), nullable=False)
    medical_order_id = Column(Integer, ForeignKey("medical_orders.id"), nullable=False)
    status = Column(Enum(HospitalizationStatus), default=HospitalizationStatus.PENDING)
    admission_date = Column(DateTime)
    discharge_date = Column(DateTime)
    current_infection_risk = Column(Enum(InfectionRisk), default=InfectionRisk.NONE)
    transfer_history = Column(Text)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    pet = relationship("Pet", back_populates="hospitalizations")
    medical_order = relationship("MedicalOrder", back_populates="hospitalizations")
