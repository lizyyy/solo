import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

DB_PATH = os.path.expanduser("~/.lab_inspector/lab_inspector.db")
Base = declarative_base()


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True)
    source_type = Column(String(50), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500))
    import_time = Column(DateTime, default=datetime.now)
    total_rows = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    imported_by = Column(String(100), default="system")
    notes = Column(Text)

    records = relationship("ConsumableRecord", back_populates="batch")
    failed_records = relationship("FailedRecord", back_populates="batch")


class ConsumableRecord(Base):
    __tablename__ = "consumable_records"

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id"))
    source_type = Column(String(50), nullable=False)
    original_row = Column(Integer, nullable=False)
    record_date = Column(DateTime)
    material_code = Column(String(100))
    material_name = Column(String(255), nullable=False)
    specification = Column(String(255))
    unit = Column(String(50))
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float)
    total_price = Column(Float)
    department = Column(String(255))
    research_group = Column(String(255))
    applicant = Column(String(255))
    receiver = Column(String(255))
    handler = Column(String(255))
    purpose = Column(String(50))
    location = Column(String(255))
    status = Column(String(50), default="valid")
    supplier = Column(String(255))
    order_no = Column(String(100))
    receipt_no = Column(String(100))
    remark = Column(Text)
    is_valid = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    batch = relationship("ImportBatch", back_populates="records")
    corrections = relationship("CorrectionLog", back_populates="record")
    audit_logs = relationship("AuditLog", back_populates="record")


class FailedRecord(Base):
    __tablename__ = "failed_records"

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id"))
    source_type = Column(String(50), nullable=False)
    original_row = Column(Integer, nullable=False)
    raw_data = Column(Text)
    error_message = Column(Text)
    error_type = Column(String(100))
    created_at = Column(DateTime, default=datetime.now)
    is_resolved = Column(Boolean, default=False)
    resolved_record_id = Column(Integer, nullable=True)

    batch = relationship("ImportBatch", back_populates="failed_records")


class CorrectionLog(Base):
    __tablename__ = "correction_logs"

    id = Column(Integer, primary_key=True)
    record_id = Column(Integer, ForeignKey("consumable_records.id"))
    field_name = Column(String(100), nullable=False)
    old_value = Column(Text)
    new_value = Column(Text)
    reason = Column(Text)
    corrected_by = Column(String(100), default="manual")
    corrected_at = Column(DateTime, default=datetime.now)
    correction_type = Column(String(50), default="manual")

    record = relationship("ConsumableRecord", back_populates="corrections")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    record_id = Column(Integer, ForeignKey("consumable_records.id"))
    action = Column(String(50), nullable=False)
    field_name = Column(String(100))
    old_value = Column(Text)
    new_value = Column(Text)
    operator = Column(String(100), default="system")
    operated_at = Column(DateTime, default=datetime.now)
    note = Column(Text)

    record = relationship("ConsumableRecord", back_populates="audit_logs")


def get_engine():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    return create_engine(f"sqlite:///{DB_PATH}")


def get_session():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    return Session()


def init_database():
    engine = get_engine()
    Base.metadata.create_all(engine)
    return True
