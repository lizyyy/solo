from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime

DATABASE_URL = "sqlite:///./warehouse.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class Part(Base):
    __tablename__ = "parts"
    id = Column(Integer, primary_key=True, index=True)
    part_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    model = Column(String(100))
    quantity = Column(Integer, default=0)
    unit_price = Column(Float, default=0.0)
    location = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

class Engineer(Base):
    __tablename__ = "engineers"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(50), nullable=False)
    phone = Column(String(20))
    department = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

class Batch(Base):
    __tablename__ = "batches"
    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, index=True, nullable=False)
    part_id = Column(Integer, ForeignKey("parts.id"))
    quantity = Column(Integer, nullable=False)
    received_date = Column(DateTime, default=datetime.utcnow)
    supplier = Column(String(100))
    expire_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    part = relationship("Part")

class PartIssuance(Base):
    __tablename__ = "part_issuances"
    id = Column(Integer, primary_key=True, index=True)
    issuance_no = Column(String(50), unique=True, index=True, nullable=False)
    engineer_id = Column(Integer, ForeignKey("engineers.id"))
    part_id = Column(Integer, ForeignKey("parts.id"))
    batch_id = Column(Integer, ForeignKey("batches.id"))
    quantity = Column(Integer, nullable=False)
    service_order_no = Column(String(50))
    customer_name = Column(String(100))
    customer_phone = Column(String(20))
    appliance_model = Column(String(100))
    fault_description = Column(Text)
    issued_by = Column(String(50))
    issued_at = Column(DateTime, default=datetime.utcnow)
    old_part_expected = Column(Boolean, default=True)
    old_part_returned = Column(Boolean, default=False)
    old_part_returned_at = Column(DateTime)
    status = Column(String(20), default="issued")
    remarks = Column(Text)
    engineer = relationship("Engineer")
    part = relationship("Part")
    batch = relationship("Batch")

class OldPartReturn(Base):
    __tablename__ = "old_part_returns"
    id = Column(Integer, primary_key=True, index=True)
    return_no = Column(String(50), unique=True, index=True, nullable=False)
    issuance_id = Column(Integer, ForeignKey("part_issuances.id"))
    engineer_id = Column(Integer, ForeignKey("engineers.id"))
    part_id = Column(Integer, ForeignKey("parts.id"))
    quantity = Column(Integer, nullable=False)
    condition = Column(String(50))
    defect_description = Column(Text)
    received_by = Column(String(50))
    received_at = Column(DateTime, default=datetime.utcnow)
    storage_location = Column(String(50))
    status = Column(String(20), default="received")
    remarks = Column(Text)
    issuance = relationship("PartIssuance")
    engineer = relationship("Engineer")
    part = relationship("Part")

class Claim(Base):
    __tablename__ = "claims"
    id = Column(Integer, primary_key=True, index=True)
    claim_no = Column(String(50), unique=True, index=True, nullable=False)
    return_id = Column(Integer, ForeignKey("old_part_returns.id"))
    issuance_id = Column(Integer, ForeignKey("part_issuances.id"))
    part_id = Column(Integer, ForeignKey("parts.id"))
    batch_id = Column(Integer, ForeignKey("batches.id"))
    quantity = Column(Integer, nullable=False)
    claim_amount = Column(Float, nullable=False)
    vendor = Column(String(100))
    claim_reason = Column(Text)
    submitted_by = Column(String(50))
    submitted_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default="pending")
    approved_at = Column(DateTime)
    approved_by = Column(String(50))
    paid_at = Column(DateTime)
    paid_amount = Column(Float)
    remarks = Column(Text)
    return_record = relationship("OldPartReturn")
    issuance = relationship("PartIssuance")
    part = relationship("Part")
    batch = relationship("Batch")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String(50), nullable=False)
    reference_no = Column(String(50))
    operator = Column(String(50))
    status = Column(String(20), nullable=False)
    reason = Column(Text, nullable=False)
    details = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)
