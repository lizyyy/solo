from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class BlastStatus(str, enum.Enum):
    DRAFT = "草稿"
    SUBMITTED = "已提交"
    WIND_CHECK_FAILED = "风向校验不通过"
    RECEIPT_MISSING = "回执缺失"
    ZONE_CHANGED = "警戒线变更待同步"
    PENDING_REVIEW = "待复核"
    REVIEWING = "复核中"
    APPROVED = "已核准"
    EXECUTED = "已执行"
    ARCHIVED = "已归档"
    REJECTED = "已驳回"


class NoticeType(str, enum.Enum):
    CONSTRUCTION_TEAM = "施工队"
    VILLAGE_COMMITTEE = "村委"


class AuditAction(str, enum.Enum):
    CREATE = "创建"
    SUBMIT = "提交"
    WIND_CHECK = "风向校验"
    SEND_NOTICE = "发送通知"
    RECEIVE_RECEIPT = "接收回执"
    MODIFY_ZONE = "修改警戒区"
    REVIEW = "复核"
    APPROVE = "核准"
    EXECUTE = "执行"
    ARCHIVE = "归档"
    REJECT = "驳回"
    UPDATE = "更新"


class BlastPlan(Base):
    __tablename__ = "blast_plans"

    id = Column(Integer, primary_key=True, index=True)
    business_no = Column(String(50), unique=True, index=True, nullable=False)
    quarry_name = Column(String(100), nullable=False)
    blast_time = Column(DateTime, nullable=False)
    expected_blast_volume = Column(Float, nullable=False)
    safety_measures = Column(Text)
    status = Column(Enum(BlastStatus), default=BlastStatus.DRAFT, index=True)
    wind_direction = Column(String(20))
    wind_speed = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(50))
    remark = Column(Text)

    zones = relationship("WarningZone", back_populates="plan", cascade="all, delete-orphan")
    notices = relationship("Notice", back_populates="plan", cascade="all, delete-orphan")
    receipts = relationship("Receipt", back_populates="plan", cascade="all, delete-orphan")
    audits = relationship("AuditLog", back_populates="plan", cascade="all, delete-orphan")
    report = relationship("ExecutionReport", back_populates="plan", uselist=False)


class WarningZone(Base):
    __tablename__ = "warning_zones"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("blast_plans.id"), nullable=False)
    zone_name = Column(String(100), nullable=False)
    boundary_description = Column(Text, nullable=False)
    radius_meters = Column(Float)
    is_active = Column(Boolean, default=True)
    version = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    plan = relationship("BlastPlan", back_populates="zones")


class Notice(Base):
    __tablename__ = "notices"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("blast_plans.id"), nullable=False)
    notice_type = Column(Enum(NoticeType), nullable=False)
    recipient_name = Column(String(100), nullable=False)
    contact_phone = Column(String(20))
    address = Column(String(200))
    notice_content = Column(Text)
    sent_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    plan = relationship("BlastPlan", back_populates="notices")
    receipt = relationship("Receipt", back_populates="notice", uselist=False)


class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("blast_plans.id"), nullable=False)
    notice_id = Column(Integer, ForeignKey("notices.id"), nullable=False)
    recipient_name = Column(String(100), nullable=False)
    confirmed_at = Column(DateTime, nullable=False)
    confirm_method = Column(String(50))
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    plan = relationship("BlastPlan", back_populates="receipts")
    notice = relationship("Notice", back_populates="receipt")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("blast_plans.id"), nullable=False)
    action = Column(Enum(AuditAction), nullable=False)
    operator = Column(String(50))
    old_status = Column(String(50))
    new_status = Column(String(50))
    detail = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    plan = relationship("BlastPlan", back_populates="audits")


class ExecutionReport(Base):
    __tablename__ = "execution_reports"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("blast_plans.id"), unique=True, nullable=False)
    actual_blast_time = Column(DateTime, nullable=False)
    actual_blast_volume = Column(Float)
    wind_direction_at_blast = Column(String(20))
    wind_speed_at_blast = Column(Float)
    on_site_supervisor = Column(String(100))
    safety_check_result = Column(Text)
    abnormal_situation = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    plan = relationship("BlastPlan", back_populates="report")
