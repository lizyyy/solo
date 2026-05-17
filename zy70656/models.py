from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class ImageDirectory(Base):
    __tablename__ = "image_directories"
    
    id = Column(Integer, primary_key=True, index=True)
    directory_path = Column(String, unique=True, index=True)
    status = Column(String, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    processed_by = Column(String, nullable=True)
    
    invoices = relationship("Invoice", back_populates="directory")
    audit_logs = relationship("AuditLog", back_populates="directory")

class Invoice(Base):
    __tablename__ = "invoices"
    
    id = Column(Integer, primary_key=True, index=True)
    directory_id = Column(Integer, ForeignKey("image_directories.id"))
    original_filename = Column(String, index=True)
    file_path = Column(String)
    invoice_code = Column(String, index=True, nullable=True)
    invoice_number = Column(String, index=True, nullable=True)
    reimbursement_id = Column(String, index=True, nullable=True)
    amount = Column(Float, nullable=True)
    is_duplicate = Column(Boolean, default=False)
    duplicate_with = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    status = Column(String, default="parsed")
    match_status = Column(String, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    directory = relationship("ImageDirectory", back_populates="invoices")
    audit_logs = relationship("AuditLog", back_populates="invoice")

class ReimbursementSheet(Base):
    __tablename__ = "reimbursement_sheets"
    
    id = Column(Integer, primary_key=True, index=True)
    directory_id = Column(Integer, ForeignKey("image_directories.id"))
    reimbursement_id = Column(String, index=True)
    invoice_code = Column(String, index=True)
    invoice_number = Column(String, index=True)
    amount = Column(Float)
    applicant = Column(String, nullable=True)
    department = Column(String, nullable=True)
    status = Column(String, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ArchiveReport(Base):
    __tablename__ = "archive_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    directory_id = Column(Integer, ForeignKey("image_directories.id"))
    report_content = Column(Text)
    total_files = Column(Integer, default=0)
    matched_count = Column(Integer, default=0)
    duplicate_count = Column(Integer, default=0)
    missing_count = Column(Integer, default=0)
    status = Column(String, default="generated")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    generated_by = Column(String, nullable=True)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    directory_id = Column(Integer, ForeignKey("image_directories.id"))
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    action = Column(String)
    original_input = Column(Text)
    processed_by = Column(String)
    conclusion = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    directory = relationship("ImageDirectory", back_populates="audit_logs")
    invoice = relationship("Invoice", back_populates="audit_logs")
