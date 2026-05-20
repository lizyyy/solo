from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean, Enum, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class ObjectLevel(str, enum.Enum):
    LEVEL_A = "A级"
    LEVEL_B = "B级"
    LEVEL_C = "C级"
    LEVEL_D = "D级"


class LeaveScope(str, enum.Enum):
    LOCAL = "本市范围内"
    PROVINCIAL = "本省范围内"
    NATIONAL = "全国范围"


class ProcessStatus(str, enum.Enum):
    PENDING = "待处理"
    PROCESSED = "已处理"
    RETURNED = "退回修改"
    APPROVED = "已放行"
    NEED_MATERIALS = "需补材料"


class ExceptionType(str, enum.Enum):
    OVERTIME = "超时未签"
    LEAVE_COVER = "请假覆盖"
    TRACE_GAP = "轨迹缺口"
    NORMAL = "正常"


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(Enum(ProcessStatus), default=ProcessStatus.PENDING)
    processed_by = Column(String(50), nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    process_note = Column(Text, nullable=True)

    checkin_records = relationship("CheckinRecord", back_populates="batch")
    leave_records = relationship("LeaveRecord", back_populates="batch")
    location_summaries = relationship("LocationSummary", back_populates="batch")
    audit_logs = relationship("AuditLog", back_populates="batch")


class CheckinRecord(Base):
    __tablename__ = "checkin_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    object_name = Column(String(100), nullable=False, index=True)
    object_id_card = Column(String(50), nullable=False, index=True)
    object_level = Column(Enum(ObjectLevel), nullable=False)
    checkin_time = Column(DateTime(timezone=True), nullable=False)
    checkin_location = Column(String(200), nullable=True)
    is_overtime = Column(Boolean, default=False)
    status = Column(Enum(ProcessStatus), default=ProcessStatus.PENDING)
    exception_type = Column(Enum(ExceptionType), default=ExceptionType.NORMAL)
    exception_reason = Column(Text, nullable=True)
    processed_by = Column(String(50), nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    process_note = Column(Text, nullable=True)
    readable_explanation = Column(Text, nullable=True)

    batch = relationship("Batch", back_populates="checkin_records")
    audit_logs = relationship("AuditLog", back_populates="checkin_record")


class LeaveRecord(Base):
    __tablename__ = "leave_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    object_name = Column(String(100), nullable=False, index=True)
    object_id_card = Column(String(50), nullable=False, index=True)
    object_level = Column(Enum(ObjectLevel), nullable=False)
    leave_start_time = Column(DateTime(timezone=True), nullable=False)
    leave_end_time = Column(DateTime(timezone=True), nullable=False)
    leave_scope = Column(Enum(LeaveScope), nullable=False)
    leave_reason = Column(Text, nullable=False)
    approver = Column(String(50), nullable=False)
    approve_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(Enum(ProcessStatus), default=ProcessStatus.PENDING)
    exception_type = Column(Enum(ExceptionType), default=ExceptionType.NORMAL)
    exception_reason = Column(Text, nullable=True)
    processed_by = Column(String(50), nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    process_note = Column(Text, nullable=True)
    readable_explanation = Column(Text, nullable=True)

    batch = relationship("Batch", back_populates="leave_records")
    audit_logs = relationship("AuditLog", back_populates="leave_record")


class LocationSummary(Base):
    __tablename__ = "location_summaries"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    object_name = Column(String(100), nullable=False, index=True)
    object_id_card = Column(String(50), nullable=False, index=True)
    object_level = Column(Enum(ObjectLevel), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    locations = Column(Text, nullable=False)
    has_gap = Column(Boolean, default=False)
    gap_details = Column(Text, nullable=True)
    status = Column(Enum(ProcessStatus), default=ProcessStatus.PENDING)
    exception_type = Column(Enum(ExceptionType), default=ExceptionType.NORMAL)
    exception_reason = Column(Text, nullable=True)
    processed_by = Column(String(50), nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    process_note = Column(Text, nullable=True)
    readable_explanation = Column(Text, nullable=True)

    batch = relationship("Batch", back_populates="location_summaries")
    audit_logs = relationship("AuditLog", back_populates="location_summary")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    checkin_record_id = Column(Integer, ForeignKey("checkin_records.id"), nullable=True)
    leave_record_id = Column(Integer, ForeignKey("leave_records.id"), nullable=True)
    location_summary_id = Column(Integer, ForeignKey("location_summaries.id"), nullable=True)
    action = Column(String(50), nullable=False)
    previous_status = Column(Enum(ProcessStatus), nullable=True)
    new_status = Column(Enum(ProcessStatus), nullable=False)
    operator = Column(String(50), nullable=False)
    operated_at = Column(DateTime(timezone=True), server_default=func.now())
    reason = Column(Text, nullable=False)

    batch = relationship("Batch", back_populates="audit_logs")
    checkin_record = relationship("CheckinRecord", back_populates="audit_logs")
    leave_record = relationship("LeaveRecord", back_populates="audit_logs")
    location_summary = relationship("LocationSummary", back_populates="audit_logs")
