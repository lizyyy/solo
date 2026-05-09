from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db import Base


class EnterpriseCustomer(Base):
    __tablename__ = "enterprise_customers"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(String(50), unique=True, index=True, nullable=False)
    customer_name = Column(String(200), nullable=False)
    company_type = Column(String(50), nullable=False)
    status = Column(String(20), default="ACTIVE")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    receipts = relationship("Receipt", back_populates="customer")
    permissions = relationship("ReprintPermission", back_populates="customer")


class Receipt(Base):
    __tablename__ = "receipts"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    receipt_index = Column(String(100), unique=True, index=True, nullable=False)
    original_transaction_id = Column(String(100), nullable=False, index=True)
    customer_id = Column(String(50), ForeignKey("enterprise_customers.customer_id"), nullable=False)
    transaction_type = Column(String(50), nullable=False)
    transaction_amount = Column(Integer, nullable=False)
    transaction_currency = Column(String(10), default="CNY")
    transaction_date = Column(DateTime, nullable=False)
    counterparty_name = Column(String(200), nullable=False)
    counterparty_account = Column(String(50), nullable=False)
    payer_account = Column(String(50), nullable=False)
    payer_name = Column(String(200), nullable=False)
    original_receipt_path = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    customer = relationship("EnterpriseCustomer", back_populates="receipts")
    signature = relationship("SignatureRecord", uselist=False, back_populates="receipt")
    download_logs = relationship("DownloadLog", back_populates="receipt")
    permissions = relationship("ReprintPermission", back_populates="receipt")
    
    __table_args__ = (
        Index("idx_receipt_customer", "customer_id", "transaction_date"),
    )


class SignatureRecord(Base):
    __tablename__ = "signature_records"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id"), unique=True, nullable=False)
    receipt_index = Column(String(100), nullable=False, index=True)
    original_transaction_id = Column(String(100), nullable=False)
    signature_value = Column(Text, nullable=False)
    signature_algorithm = Column(String(50), nullable=False)
    certificate_info = Column(Text, nullable=True)
    signed_at = Column(DateTime, nullable=False)
    verification_status = Column(String(20), default="PENDING")
    verified_at = Column(DateTime, nullable=True)
    verified_by = Column(String(100), nullable=True)
    
    receipt = relationship("Receipt", back_populates="signature", foreign_keys=[receipt_id])


class ReprintPermission(Base):
    __tablename__ = "reprint_permissions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    permission_id = Column(String(100), unique=True, index=True, nullable=False)
    customer_id = Column(String(50), ForeignKey("enterprise_customers.customer_id"), nullable=False)
    receipt_id = Column(Integer, ForeignKey("receipts.id"), nullable=False, index=True)
    receipt_index = Column(String(100), nullable=False)
    original_transaction_id = Column(String(100), nullable=False)
    operator_id = Column(String(100), nullable=False)
    operator_name = Column(String(200), nullable=False)
    request_reason = Column(String(500), nullable=True)
    max_download_count = Column(Integer, default=3, nullable=False)
    current_download_count = Column(Integer, default=0, nullable=False)
    valid_from = Column(DateTime, nullable=False)
    valid_until = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    approved_by = Column(String(100), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    
    customer = relationship("EnterpriseCustomer", back_populates="permissions")
    receipt = relationship("Receipt", back_populates="permissions", foreign_keys=[receipt_id])
    
    __table_args__ = (
        Index("idx_permission_active", "customer_id", "receipt_id", "is_active"),
    )


class DownloadLog(Base):
    __tablename__ = "download_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    log_id = Column(String(100), unique=True, index=True, nullable=False)
    receipt_id = Column(Integer, ForeignKey("receipts.id"), nullable=False, index=True)
    receipt_index = Column(String(100), nullable=False)
    permission_id = Column(String(100), ForeignKey("reprint_permissions.permission_id"), nullable=False, index=True)
    customer_id = Column(String(50), nullable=False)
    original_transaction_id = Column(String(100), nullable=False)
    operator_id = Column(String(100), nullable=False)
    operator_name = Column(String(200), nullable=False)
    download_seq = Column(Integer, nullable=False)
    watermark_info = Column(Text, nullable=True)
    client_ip = Column(String(50), nullable=True)
    user_agent = Column(String(200), nullable=True)
    downloaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(20), default="SUCCESS", nullable=False)
    failure_reason = Column(String(200), nullable=True)
    
    receipt = relationship("Receipt", back_populates="download_logs", foreign_keys=[receipt_id])


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    audit_id = Column(String(100), unique=True, index=True, nullable=False)
    operation_type = Column(String(50), nullable=False)
    operator_id = Column(String(100), nullable=False)
    operator_name = Column(String(200), nullable=False)
    customer_id = Column(String(50), nullable=True)
    receipt_index = Column(String(100), nullable=True)
    original_transaction_id = Column(String(100), nullable=True)
    permission_id = Column(String(100), nullable=True)
    operation_details = Column(Text, nullable=True)
    before_value = Column(Text, nullable=True)
    after_value = Column(Text, nullable=True)
    operation_result = Column(String(20), nullable=False)
    operated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    client_ip = Column(String(50), nullable=True)
    
    __table_args__ = (
        Index("idx_audit_operator", "operator_id", "operated_at"),
        Index("idx_audit_receipt", "receipt_index", "operated_at"),
    )