from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from config import settings

engine = create_engine(
    settings.DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class Medicine(Base):
    __tablename__ = "medicines"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), index=True, nullable=False)
    generic_name = Column(String(200))
    manufacturer = Column(String(200))
    dosage_form = Column(String(100))
    concentration = Column(String(100))
    min_dose_per_kg = Column(Float, nullable=False)
    max_dose_per_kg = Column(Float, nullable=False)
    dose_unit = Column(String(50), nullable=False)
    species = Column(String(200))
    contraindications = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    inventory_items = relationship("Inventory", back_populates="medicine")


class Inventory(Base):
    __tablename__ = "inventory"
    
    id = Column(Integer, primary_key=True, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    batch_number = Column(String(100), index=True, nullable=False)
    quantity = Column(Integer, nullable=False)
    unit = Column(String(50), nullable=False)
    expiry_date = Column(DateTime, nullable=False)
    location = Column(String(100))
    received_date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    medicine = relationship("Medicine", back_populates="inventory_items")


class Prescription(Base):
    __tablename__ = "prescriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    prescription_no = Column(String(100), unique=True, index=True)
    doctor_id = Column(String(100))
    doctor_name = Column(String(100))
    pet_id = Column(String(100))
    pet_name = Column(String(100))
    pet_species = Column(String(100))
    pet_weight_kg = Column(Float, nullable=False)
    owner_name = Column(String(100))
    owner_phone = Column(String(100))
    owner_id_card = Column(String(100))
    diagnosis = Column(Text)
    status = Column(String(50), default="pending")
    total_amount = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    items = relationship("PrescriptionItem", back_populates="prescription")
    audit_logs = relationship("AuditLog", back_populates="prescription")


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"
    
    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False)
    medicine_id = Column(Integer, ForeignKey("medicines.id"))
    medicine_name = Column(String(200), nullable=False)
    batch_number = Column(String(100))
    dosage = Column(Float, nullable=False)
    dosage_unit = Column(String(50), nullable=False)
    frequency = Column(String(100))
    duration_days = Column(Integer)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float)
    subtotal = Column(Float)
    check_status = Column(String(50), default="pending")
    check_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    prescription = relationship("Prescription", back_populates="items")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"))
    action = Column(String(100), nullable=False)
    operator_id = Column(String(100))
    operator_name = Column(String(100))
    item_details = Column(Text)
    check_result = Column(String(50))
    reason = Column(Text)
    ip_address = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    prescription = relationship("Prescription", back_populates="audit_logs")


class Contraindication(Base):
    __tablename__ = "contraindications"
    
    id = Column(Integer, primary_key=True, index=True)
    medicine_a_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    medicine_b_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String(50), default="warning")
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    Base.metadata.create_all(bind=engine)
