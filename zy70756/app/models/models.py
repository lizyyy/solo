from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class CsvFile(Base):
    __tablename__ = "csv_files"

    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String, index=True)
    file_hash = Column(String, unique=True, index=True)
    file_size = Column(Integer)
    detected_encoding = Column(String)
    detected_confidence = Column(String)
    status = Column(String, default="uploaded")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    column_mappings = relationship("ColumnMapping", back_populates="csv_file")
    null_rules = relationship("NullRule", back_populates="csv_file")
    bad_rows = relationship("BadRow", back_populates="csv_file")
    conversion_summary = relationship("ConversionSummary", back_populates="csv_file", uselist=False)
    audit_logs = relationship("AuditLog", back_populates="csv_file")


class ColumnMapping(Base):
    __tablename__ = "column_mappings"

    id = Column(Integer, primary_key=True, index=True)
    csv_file_id = Column(Integer, ForeignKey("csv_files.id"))
    original_column = Column(String)
    normalized_column = Column(String)
    is_ignored = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    csv_file = relationship("CsvFile", back_populates="column_mappings")


class NullRule(Base):
    __tablename__ = "null_rules"

    id = Column(Integer, primary_key=True, index=True)
    csv_file_id = Column(Integer, ForeignKey("csv_files.id"))
    column_name = Column(String)
    null_values = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    csv_file = relationship("CsvFile", back_populates="null_rules")


class BadRow(Base):
    __tablename__ = "bad_rows"

    id = Column(Integer, primary_key=True, index=True)
    csv_file_id = Column(Integer, ForeignKey("csv_files.id"))
    row_number = Column(Integer)
    raw_data = Column(Text)
    error_message = Column(Text)
    is_fixed = Column(Boolean, default=False)
    fixed_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    csv_file = relationship("CsvFile", back_populates="bad_rows")


class ConversionSummary(Base):
    __tablename__ = "conversion_summaries"

    id = Column(Integer, primary_key=True, index=True)
    csv_file_id = Column(Integer, ForeignKey("csv_files.id"), unique=True)
    total_rows = Column(Integer)
    success_rows = Column(Integer)
    failed_rows = Column(Integer)
    skipped_rows = Column(Integer)
    output_path = Column(String, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    csv_file = relationship("CsvFile", back_populates="conversion_summary")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    csv_file_id = Column(Integer, ForeignKey("csv_files.id"))
    action = Column(String)
    handler = Column(String)
    original_input = Column(JSON)
    conclusion = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    csv_file = relationship("CsvFile", back_populates="audit_logs")
