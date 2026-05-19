from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean, Enum, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from config import Base


class HazardStatus(str, enum.Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    RECTIFYING = "rectifying"
    RECHECKING = "rechecking"
    CLOSED = "closed"
    ESCALATED = "escalated"


class HazardLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class BatchStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PARTIAL_SUCCESS = "partial_success"
    SUCCESS = "success"
    FAILED = "failed"


class OperationType(str, enum.Enum):
    IMPORT = "import"
    UPDATE = "update"
    RECTIFY = "rectify"
    RECHECK = "recheck"
    CLOSE = "close"


class Hazard(Base):
    __tablename__ = "hazards"

    id = Column(Integer, primary_key=True, index=True)
    hazard_code = Column(String(50), unique=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    location = Column(String(200), index=True)
    location_detail = Column(String(500))
    level = Column(Enum(HazardLevel), default=HazardLevel.MEDIUM)
    status = Column(Enum(HazardStatus), default=HazardStatus.PENDING)
    
    discover_time = Column(DateTime, default=datetime.utcnow)
    discoverer = Column(String(100))
    discoverer_phone = Column(String(20))
    
    deadline = Column(DateTime)
    actual_close_time = Column(DateTime)
    
    responsible_person_id = Column(Integer, ForeignKey("responsible_persons.id"))
    responsible_person = relationship("ResponsiblePerson", back_populates="hazards")
    
    department = Column(String(100))
    team = Column(String(100))
    
    photos = relationship("HazardPhoto", back_populates="hazard", cascade="all, delete-orphan")
    rectifications = relationship("Rectification", back_populates="hazard", cascade="all, delete-orphan")
    rechecks = relationship("Recheck", back_populates="hazard", cascade="all, delete-orphan")
    operation_logs = relationship("OperationLog", back_populates="hazard", cascade="all, delete-orphan")
    
    is_duplicate = Column(Boolean, default=False)
    duplicate_with = Column(Integer, ForeignKey("hazards.id"))
    merged_hazards = relationship("Hazard", remote_side=[id])
    
    rule_check_results = relationship("RuleCheckResult", back_populates="hazard", cascade="all, delete-orphan")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_deleted = Column(Boolean, default=False)


class HazardPhoto(Base):
    __tablename__ = "hazard_photos"

    id = Column(Integer, primary_key=True, index=True)
    hazard_id = Column(Integer, ForeignKey("hazards.id"), nullable=False)
    hazard = relationship("Hazard", back_populates="photos")
    
    photo_type = Column(String(50))
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(200))
    file_size = Column(Integer)
    upload_time = Column(DateTime, default=datetime.utcnow)
    uploader = Column(String(100))
    description = Column(Text)
    
    is_deleted = Column(Boolean, default=False)


class ResponsiblePerson(Base):
    __tablename__ = "responsible_persons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20))
    email = Column(String(100))
    department = Column(String(100))
    position = Column(String(100))
    
    hazards = relationship("Hazard", back_populates="responsible_person")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)


class Rectification(Base):
    __tablename__ = "rectifications"

    id = Column(Integer, primary_key=True, index=True)
    hazard_id = Column(Integer, ForeignKey("hazards.id"), nullable=False)
    hazard = relationship("Hazard", back_populates="rectifications")
    
    rectifier = Column(String(100))
    rectify_time = Column(DateTime, default=datetime.utcnow)
    description = Column(Text)
    measures = Column(Text)
    cost = Column(Float)
    
    photos = relationship("RectificationPhoto", back_populates="rectification", cascade="all, delete-orphan")
    
    created_at = Column(DateTime, default=datetime.utcnow)


class RectificationPhoto(Base):
    __tablename__ = "rectification_photos"

    id = Column(Integer, primary_key=True, index=True)
    rectification_id = Column(Integer, ForeignKey("rectifications.id"), nullable=False)
    rectification = relationship("Rectification", back_populates="photos")
    
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(200))
    upload_time = Column(DateTime, default=datetime.utcnow)
    description = Column(Text)


class Recheck(Base):
    __tablename__ = "rechecks"

    id = Column(Integer, primary_key=True, index=True)
    hazard_id = Column(Integer, ForeignKey("hazards.id"), nullable=False)
    hazard = relationship("Hazard", back_populates="rechecks")
    
    rechecker = Column(String(100))
    recheck_time = Column(DateTime, default=datetime.utcnow)
    result = Column(Boolean, nullable=False)
    description = Column(Text)
    suggestion = Column(Text)
    
    photos = relationship("RecheckPhoto", back_populates="recheck", cascade="all, delete-orphan")
    
    created_at = Column(DateTime, default=datetime.utcnow)


class RecheckPhoto(Base):
    __tablename__ = "recheck_photos"

    id = Column(Integer, primary_key=True, index=True)
    recheck_id = Column(Integer, ForeignKey("rechecks.id"), nullable=False)
    recheck = relationship("Recheck", back_populates="photos")
    
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(200))
    upload_time = Column(DateTime, default=datetime.utcnow)
    description = Column(Text)


class BatchOperation(Base):
    __tablename__ = "batch_operations"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, index=True)
    operation_type = Column(Enum(OperationType), nullable=False)
    status = Column(Enum(BatchStatus), default=BatchStatus.PENDING)
    
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    
    operator = Column(String(100))
    operate_time = Column(DateTime, default=datetime.utcnow)
    remark = Column(Text)
    
    items = relationship("BatchItem", back_populates="batch", cascade="all, delete-orphan")


class BatchItem(Base):
    __tablename__ = "batch_items"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batch_operations.id"), nullable=False)
    batch = relationship("BatchOperation", back_populates="items")
    
    hazard_id = Column(Integer, ForeignKey("hazards.id"))
    row_index = Column(Integer)
    row_data = Column(Text)
    
    success = Column(Boolean)
    error_message = Column(Text)
    processed_at = Column(DateTime)
    
    retry_count = Column(Integer, default=0)
    last_retry_at = Column(DateTime)


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    hazard_id = Column(Integer, ForeignKey("hazards.id"), nullable=False)
    hazard = relationship("Hazard", back_populates="operation_logs")
    
    operation = Column(String(100))
    operator = Column(String(100))
    operate_time = Column(DateTime, default=datetime.utcnow)
    remark = Column(Text)
    
    old_value = Column(Text)
    new_value = Column(Text)


class RuleCheckResult(Base):
    __tablename__ = "rule_check_results"

    id = Column(Integer, primary_key=True, index=True)
    hazard_id = Column(Integer, ForeignKey("hazards.id"), nullable=False)
    hazard = relationship("Hazard", back_populates="rule_check_results")
    
    rule_code = Column(String(50))
    rule_name = Column(String(100))
    passed = Column(Boolean, nullable=False)
    message = Column(Text)
    
    check_time = Column(DateTime, default=datetime.utcnow)
    check_stage = Column(String(50))
