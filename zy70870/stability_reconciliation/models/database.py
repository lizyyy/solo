from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, Boolean, Text, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./stability_reconciliation.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class TestProtocol(Base):
    __tablename__ = "test_protocols"

    id = Column(String, primary_key=True, index=True)
    protocol_name = Column(String, index=True)
    product_name = Column(String)
    batch_number = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    conditions = Column(JSON)
    sampling_points = Column(JSON)
    status = Column(String, default="active")

    samples = relationship("Sample", back_populates="protocol")
    reconciliation_records = relationship("ReconciliationRecord", back_populates="protocol")


class Sample(Base):
    __tablename__ = "samples"

    id = Column(String, primary_key=True, index=True)
    protocol_id = Column(String, ForeignKey("test_protocols.id"))
    sample_id = Column(String, index=True)
    sampling_point = Column(String)
    planned_sampling_date = Column(DateTime)
    actual_sampling_date = Column(DateTime)
    condition = Column(String)
    storage_location = Column(String)
    status = Column(String, default="pending")
    test_results = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    protocol = relationship("TestProtocol", back_populates="samples")
    reconciliation_records = relationship("ReconciliationRecord", back_populates="sample")


class ChamberRecord(Base):
    __tablename__ = "chamber_records"

    id = Column(String, primary_key=True, index=True)
    chamber_id = Column(String, index=True)
    chamber_name = Column(String)
    record_time = Column(DateTime, index=True)
    temperature = Column(Float)
    humidity = Column(Float)
    target_temperature = Column(Float)
    target_humidity = Column(Float)
    is_alert = Column(Boolean, default=False)
    alert_type = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class ReconciliationRecord(Base):
    __tablename__ = "reconciliation_records"

    id = Column(String, primary_key=True, index=True)
    protocol_id = Column(String, ForeignKey("test_protocols.id"))
    sample_id = Column(String, ForeignKey("samples.id"))
    reconciliation_batch_id = Column(String, index=True)
    status = Column(String, default="pending")
    discrepancy_type = Column(String)
    discrepancy_source = Column(String)
    discrepancy_description = Column(Text)
    is_resolved = Column(Boolean, default=False)
    resolution_note = Column(Text)
    resolved_by = Column(String)
    resolved_at = Column(DateTime)
    review_comments = Column(JSON)
    calculation_details = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    protocol = relationship("TestProtocol", back_populates="reconciliation_records")
    sample = relationship("Sample", back_populates="reconciliation_records")
    audit_logs = relationship("AuditLog", back_populates="reconciliation")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, index=True)
    reconciliation_id = Column(String, ForeignKey("reconciliation_records.id"))
    action = Column(String)
    field_changed = Column(String)
    old_value = Column(JSON)
    new_value = Column(JSON)
    performed_by = Column(String)
    performed_at = Column(DateTime, default=datetime.utcnow)
    comment = Column(Text)

    reconciliation = relationship("ReconciliationRecord", back_populates="audit_logs")


class Report(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True, index=True)
    report_type = Column(String)
    protocol_id = Column(String)
    reconciliation_batch_id = Column(String)
    generated_by = Column(String)
    generated_at = Column(DateTime, default=datetime.utcnow)
    file_path = Column(String)
    status = Column(String, default="generated")
    summary_data = Column(JSON)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
