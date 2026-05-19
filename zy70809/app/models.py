from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum

class BatchStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class ResultType(str, enum.Enum):
    NORMAL = "normal"
    PENDING_CONFIRM = "pending_confirm"
    FAILED = "failed"

class RuleType(str, enum.Enum):
    EXPIRED = "expired"
    MULTIPLE_CONTRACTS = "multiple_contracts"
    PHOTO_MISSING = "photo_missing"

class Batch(Base):
    __tablename__ = "batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, unique=True, index=True, nullable=False)
    equipment_file = Column(String)
    photo_file = Column(String)
    contract_file = Column(String)
    status = Column(Enum(BatchStatus), default=BatchStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime)
    
    results = relationship("ValidationResult", back_populates="batch")

class Equipment(Base):
    __tablename__ = "equipment"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    equipment_code = Column(String, index=True, nullable=False)
    equipment_name = Column(String, nullable=False)
    equipment_type = Column(String)
    location = Column(String)
    last_maintenance_date = Column(Date)
    next_maintenance_date = Column(Date)
    maintenance_company = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class Contract(Base):
    __tablename__ = "contracts"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    contract_no = Column(String, index=True)
    equipment_code = Column(String, index=True, nullable=False)
    contractor = Column(String)
    start_date = Column(Date)
    end_date = Column(Date)
    contract_amount = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class InspectionPhoto(Base):
    __tablename__ = "inspection_photos"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    equipment_code = Column(String, index=True, nullable=False)
    photo_name = Column(String, nullable=False)
    photo_path = Column(String)
    upload_date = Column(Date)
    inspector = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class ValidationResult(Base):
    __tablename__ = "validation_results"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    equipment_code = Column(String, index=True, nullable=False)
    result_type = Column(Enum(ResultType), nullable=False)
    rule_type = Column(Enum(RuleType))
    original_data = Column(Text)
    suggestion = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    batch = relationship("Batch", back_populates="results")
