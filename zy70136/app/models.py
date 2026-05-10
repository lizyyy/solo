from datetime import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SQLAlchemyEnum
from sqlalchemy.orm import relationship
from app.database import Base


class SignStatus(str, Enum):
    DRAFT = "draft"
    PENDING_QUALIFICATION = "pending_qualification"
    QUALIFICATION_APPROVED = "qualification_approved"
    QUALIFICATION_REJECTED = "qualification_rejected"
    SUBMITTING_TO_CHANNEL = "submitting_to_channel"
    CHANNEL_SUBMITTED = "channel_submitted"
    CHANNEL_REJECTED = "channel_rejected"
    AUDIT_APPROVED = "audit_approved"
    AUDIT_REJECTED = "audit_rejected"
    FAILED = "failed"


class QualificationStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ReceiptStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"


class RetryType(str, Enum):
    QUALIFICATION = "qualification"
    CHANNEL_SUBMIT = "channel_submit"
    RECEIPT_PARSE = "receipt_parse"


class RetryStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    MAX_RETRY_EXCEEDED = "max_retry_exceeded"


class SmsSignApplication(Base):
    __tablename__ = "sms_sign_applications"
    
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(64), unique=True, index=True, nullable=False)
    merchant_id = Column(String(64), index=True, nullable=False)
    sign_name = Column(String(32), nullable=False)
    sign_type = Column(String(32))
    description = Column(Text)
    status = Column(SQLAlchemyEnum(SignStatus), default=SignStatus.DRAFT, nullable=False)
    channel_sign_id = Column(String(64))
    channel = Column(String(32))
    audit_comment = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    qualifications = relationship("QualificationAttachment", back_populates="application")
    receipts = relationship("ChannelReceipt", back_populates="application")
    operation_logs = relationship("OperationLog", back_populates="application")


class QualificationAttachment(Base):
    __tablename__ = "qualification_attachments"
    
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(64), unique=True, index=True, nullable=False)
    application_id = Column(Integer, ForeignKey("sms_sign_applications.id"), nullable=False)
    qualification_type = Column(String(64), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_url = Column(String(512), nullable=False)
    file_hash = Column(String(128), nullable=False)
    status = Column(SQLAlchemyEnum(QualificationStatus), default=QualificationStatus.PENDING)
    reviewer_id = Column(String(64))
    review_comment = Column(Text)
    reviewed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    application = relationship("SmsSignApplication", back_populates="qualifications")


class ChannelReceipt(Base):
    __tablename__ = "channel_receipts"
    
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(64), unique=True, index=True, nullable=False)
    application_id = Column(Integer, ForeignKey("sms_sign_applications.id"), nullable=False)
    channel = Column(String(32), nullable=False)
    channel_receipt_id = Column(String(128), index=True)
    raw_payload = Column(Text, nullable=False)
    parsed_result = Column(Text)
    status = Column(SQLAlchemyEnum(ReceiptStatus), default=ReceiptStatus.PENDING)
    error_message = Column(Text)
    received_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime)
    
    application = relationship("SmsSignApplication", back_populates="receipts")


class RetryQueue(Base):
    __tablename__ = "retry_queue"
    
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(64), unique=True, index=True, nullable=False)
    retry_type = Column(SQLAlchemyEnum(RetryType), nullable=False)
    target_id = Column(String(64), nullable=False)
    status = Column(SQLAlchemyEnum(RetryStatus), default=RetryStatus.PENDING)
    retry_count = Column(Integer, default=0)
    max_retry_count = Column(Integer, default=3)
    next_retry_at = Column(DateTime)
    last_error = Column(Text)
    payload = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class OperationLog(Base):
    __tablename__ = "operation_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(64), index=True, nullable=False)
    application_id = Column(Integer, ForeignKey("sms_sign_applications.id"), nullable=False)
    operator_id = Column(String(64))
    operation_type = Column(String(64), nullable=False)
    from_status = Column(String(64))
    to_status = Column(String(64))
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    application = relationship("SmsSignApplication", back_populates="operation_logs")


class AuditReport(Base):
    __tablename__ = "audit_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String(64), unique=True, index=True, nullable=False)
    application_id = Column(Integer, ForeignKey("sms_sign_applications.id"), nullable=False)
    final_status = Column(String(64), nullable=False)
    qualification_result = Column(Text)
    channel_result = Column(Text)
    audit_trail = Column(Text)
    generated_at = Column(DateTime, default=datetime.utcnow)
