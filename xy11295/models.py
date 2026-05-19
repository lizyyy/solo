from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Enum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base


class MaterialType(str, enum.Enum):
    TRUSS = "桁架"
    LIGHT = "灯具"
    SCREEN = "屏幕"


class TransferStatus(str, enum.Enum):
    PENDING = "待归还"
    PARTIAL_RETURNED = "部分归还"
    RETURNED = "已归还"
    ABNORMAL = "异常"


class ExceptionType(str, enum.Enum):
    NONE = "无异常"
    DAMAGED = "损坏"
    LOST = "丢失"
    QUANTITY_MISMATCH = "数量不符"
    QUALITY_ISSUE = "质量问题"
    OVERDUE = "超期未还"


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    material_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    type = Column(Enum(MaterialType), nullable=False)
    specification = Column(String(200))
    unit = Column(String(20), default="件")
    total_quantity = Column(Integer, default=0)
    available_quantity = Column(Integer, default=0)
    location = Column(String(100))
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    transfers = relationship("TransferOrder", back_populates="material")


class Booth(Base):
    __tablename__ = "booths"

    id = Column(Integer, primary_key=True, index=True)
    booth_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    manager = Column(String(100), nullable=False)
    contact = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transfers = relationship("TransferOrder", back_populates="booth")


class TransferOrder(Base):
    __tablename__ = "transfer_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    booth_id = Column(Integer, ForeignKey("booths.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    borrower = Column(String(100), nullable=False)
    operator = Column(String(100), nullable=False)
    transfer_time = Column(DateTime(timezone=True), nullable=False)
    expected_return_time = Column(DateTime(timezone=True))
    status = Column(Enum(TransferStatus), default=TransferStatus.PENDING)
    exception_type = Column(Enum(ExceptionType), default=ExceptionType.NONE)
    exception_note = Column(Text)
    returned_quantity = Column(Integer, default=0)
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    material = relationship("Material", back_populates="transfers")
    booth = relationship("Booth", back_populates="transfers")
    return_records = relationship("ReturnRecord", back_populates="transfer_order")


class ReturnRecord(Base):
    __tablename__ = "return_records"

    id = Column(Integer, primary_key=True, index=True)
    transfer_order_id = Column(Integer, ForeignKey("transfer_orders.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    return_time = Column(DateTime(timezone=True), nullable=False)
    receiver = Column(String(100), nullable=False)
    condition = Column(String(200))
    exception_type = Column(Enum(ExceptionType), default=ExceptionType.NONE)
    exception_note = Column(Text)
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transfer_order = relationship("TransferOrder", back_populates="return_records")


class ImportErrorLog(Base):
    __tablename__ = "import_error_logs"

    id = Column(Integer, primary_key=True, index=True)
    import_type = Column(String(50), nullable=False)
    file_name = Column(String(200), nullable=False)
    row_number = Column(Integer)
    original_data = Column(Text, nullable=False)
    error_message = Column(Text, nullable=False)
    suggestion = Column(Text)
    resolved = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
