from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Enum, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class EquipmentType(PyEnum):
    TRUSS = "truss"
    LIGHT = "light"
    SCREEN = "screen"


class OperationType(PyEnum):
    IMPORT = "import"
    OCCUPY = "occupy"
    TRANSFER = "transfer"
    RETURN = "return"
    LOSS = "loss"


class OperationStatus(PyEnum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"


class ExceptionType(PyEnum):
    NONE = "none"
    DUPLICATE = "duplicate"
    INSUFFICIENT_STOCK = "insufficient_stock"
    INVALID_EQUIPMENT = "invalid_equipment"
    INVALID_QUANTITY = "invalid_quantity"
    NOT_FOUND = "not_found"


class RoleType(PyEnum):
    MANAGER = "manager"
    OPERATOR = "operator"
    AUDITOR = "auditor"


class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    type = Column(Enum(EquipmentType), nullable=False, index=True)
    total_quantity = Column(Integer, nullable=False, default=0)
    available_quantity = Column(Integer, nullable=False, default=0)
    unit = Column(String(20), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    records = relationship("OperationRecord", back_populates="equipment")


class OperationRecord(Base):
    __tablename__ = "operation_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(String(100), unique=True, nullable=False, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False)
    operation_type = Column(Enum(OperationType), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)
    booth = Column(String(50), nullable=True, index=True)
    from_booth = Column(String(50), nullable=True)
    to_booth = Column(String(50), nullable=True)
    operator = Column(String(100), nullable=False, index=True)
    role = Column(Enum(RoleType), nullable=False)
    status = Column(Enum(OperationStatus), nullable=False, index=True)
    exception_type = Column(Enum(ExceptionType), nullable=False, default=ExceptionType.NONE)
    remark = Column(Text, nullable=True)
    operated_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.now)

    equipment = relationship("Equipment", back_populates="records")
    audit_logs = relationship("AuditLog", back_populates="record")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    record_id = Column(Integer, ForeignKey("operation_records.id"), nullable=False)
    action = Column(String(100), nullable=False)
    operator = Column(String(100), nullable=False)
    role = Column(Enum(RoleType), nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    operated_at = Column(DateTime, default=datetime.now)

    record = relationship("OperationRecord", back_populates="audit_logs")


class StockSnapshot(Base):
    __tablename__ = "stock_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False)
    total_quantity = Column(Integer, nullable=False)
    available_quantity = Column(Integer, nullable=False)
    snapshot_at = Column(DateTime, default=datetime.now, index=True)
