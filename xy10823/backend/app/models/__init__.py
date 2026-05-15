from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from backend.app.database import Base


class WarehouseAccountStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class LogisticsChannelStatus(str, enum.Enum):
    ENABLED = "enabled"
    DISABLED = "disabled"


class LabelTemplateStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class PrintBatchStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    PARTIAL_FAILED = "partial_failed"
    FAILED = "failed"


class LabelRecordStatus(str, enum.Enum):
    CREATED = "created"
    GENERATING = "generating"
    GENERATED = "generated"
    PRINTING = "printing"
    PRINTED = "printed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    EXCEPTION = "exception"


class ExceptionType(str, enum.Enum):
    API_ERROR = "api_error"
    TEMPLATE_ERROR = "template_error"
    DATA_ERROR = "data_error"
    NETWORK_ERROR = "network_error"
    VALIDATION_ERROR = "validation_error"
    UNKNOWN = "unknown"


class ExceptionStatus(str, enum.Enum):
    OPEN = "open"
    RESOLVED = "resolved"
    ARCHIVED = "archived"


class WarehouseAccount(Base):
    __tablename__ = "warehouse_accounts"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    status = Column(Enum(WarehouseAccountStatus), default=WarehouseAccountStatus.ACTIVE)
    config = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    batches = relationship("PrintBatch", back_populates="warehouse_account")


class LogisticsChannel(Base):
    __tablename__ = "logistics_channels"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    carrier = Column(String(50), nullable=False)
    status = Column(Enum(LogisticsChannelStatus), default=LogisticsChannelStatus.ENABLED)
    api_config = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    templates = relationship("LabelTemplate", back_populates="channel")


class LabelTemplate(Base):
    __tablename__ = "label_templates"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    channel_id = Column(Integer, ForeignKey("logistics_channels.id"))
    status = Column(Enum(LabelTemplateStatus), default=LabelTemplateStatus.ACTIVE)
    template_content = Column(Text)
    width = Column(Integer)
    height = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    channel = relationship("LogisticsChannel", back_populates="templates")


class PrintBatch(Base):
    __tablename__ = "print_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, index=True, nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouse_accounts.id"))
    channel_id = Column(Integer, ForeignKey("logistics_channels.id"))
    template_id = Column(Integer, ForeignKey("label_templates.id"))
    status = Column(Enum(PrintBatchStatus), default=PrintBatchStatus.PENDING)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))

    warehouse_account = relationship("WarehouseAccount", back_populates="batches")
    records = relationship("LabelRecord", back_populates="batch")


class LabelRecord(Base):
    __tablename__ = "label_records"

    id = Column(Integer, primary_key=True, index=True)
    record_no = Column(String(50), unique=True, index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("print_batches.id"))
    order_no = Column(String(100))
    tracking_no = Column(String(100))
    status = Column(Enum(LabelRecordStatus), default=LabelRecordStatus.CREATED)
    receiver_name = Column(String(100))
    receiver_phone = Column(String(50))
    receiver_address = Column(Text)
    sender_info = Column(Text)
    goods_info = Column(Text)
    weight = Column(String(50))
    label_url = Column(String(500))
    label_data = Column(Text)
    status_reason = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    batch = relationship("PrintBatch", back_populates="records")
    status_history = relationship("StatusHistory", back_populates="record", order_by="StatusHistory.id")
    exceptions = relationship("ExceptionRecord", back_populates="record")
    reprints = relationship("ReprintRecord", back_populates="record")


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("label_records.id"))
    from_status = Column(String(50))
    to_status = Column(String(50))
    reason = Column(String(500))
    operator = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    record = relationship("LabelRecord", back_populates="status_history")


class ExceptionRecord(Base):
    __tablename__ = "exception_records"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("label_records.id"))
    exception_type = Column(Enum(ExceptionType), default=ExceptionType.UNKNOWN)
    error_code = Column(String(100))
    error_message = Column(String(500))
    error_detail = Column(Text)
    status = Column(Enum(ExceptionStatus), default=ExceptionStatus.OPEN)
    resolution = Column(Text)
    resolved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    record = relationship("LabelRecord", back_populates="exceptions")


class ReprintRecord(Base):
    __tablename__ = "reprint_records"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("label_records.id"))
    reprint_count = Column(Integer, default=1)
    reprint_reason = Column(String(500))
    operator = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    record = relationship("LabelRecord", back_populates="reprints")
