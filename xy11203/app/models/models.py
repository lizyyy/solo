from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from .enums import MedicineType, BatchStatus, OperationType, RuleType, RuleResultStatus, UserRole


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.WAREHOUSE_KEEPER)
    phone = Column(String(20))
    email = Column(String(100))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    operations = relationship("OperationLog", back_populates="operator")


class Medicine(Base):
    __tablename__ = "medicines"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    type = Column(Enum(MedicineType), nullable=False)
    manufacturer = Column(String(200))
    specification = Column(String(100))
    unit = Column(String(20), default="支")
    temperature_min = Column(Float)
    temperature_max = Column(Float)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    batches = relationship("Batch", back_populates="medicine")
    inventory = relationship("Inventory", back_populates="medicine")


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(100), unique=True, index=True, nullable=False)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit = Column(String(20), default="支")
    production_date = Column(DateTime)
    expiry_date = Column(DateTime)
    arrival_temperature = Column(Float)
    temperature_photo_path = Column(String(500))
    damage_photo_path = Column(String(500))
    damage_quantity = Column(Integer, default=0)
    damage_description = Column(Text)
    status = Column(Enum(BatchStatus), default=BatchStatus.PENDING)
    receiver_id = Column(Integer, ForeignKey("users.id"))
    reviewer_id = Column(Integer, ForeignKey("users.id"))
    approver_id = Column(Integer, ForeignKey("users.id"))
    received_at = Column(DateTime(timezone=True))
    reviewed_at = Column(DateTime(timezone=True))
    approved_at = Column(DateTime(timezone=True))
    import_hash = Column(String(255), index=True)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    medicine = relationship("Medicine", back_populates="batches")
    rule_results = relationship("RuleResult", back_populates="batch")
    operations = relationship("OperationLog", back_populates="batch")


class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False, unique=True)
    quantity = Column(Integer, nullable=False)
    available_quantity = Column(Integer, nullable=False)
    locked_quantity = Column(Integer, default=0)
    damaged_quantity = Column(Integer, default=0)
    warehouse_location = Column(String(100))
    last_check_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    medicine = relationship("Medicine", back_populates="inventory")
    batch = relationship("Batch")


class RuleResult(Base):
    __tablename__ = "rule_results"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    rule_type = Column(Enum(RuleType), nullable=False)
    status = Column(Enum(RuleResultStatus), nullable=False)
    reason = Column(Text, nullable=False)
    actual_value = Column(String(255))
    expected_value = Column(String(255))
    operator_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("Batch", back_populates="rule_results")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(Enum(OperationType), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    before_data = Column(Text)
    after_data = Column(Text)
    change_reason = Column(Text)
    ip_address = Column(String(50))
    user_agent = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    operator = relationship("User", back_populates="operations")
    batch = relationship("Batch", back_populates="operations")


class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, index=True)
    log_level = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    module = Column(String(100))
    function = Column(String(100))
    user_id = Column(Integer)
    ip_address = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
