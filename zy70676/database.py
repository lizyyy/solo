from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./water_quality.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class SamplingPoint(Base):
    __tablename__ = "sampling_points"

    id = Column(Integer, primary_key=True, index=True)
    point_code = Column(String, unique=True, index=True, nullable=False)
    point_name = Column(String, nullable=False)
    location = Column(String)
    river_basin = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Unit(Base):
    __tablename__ = "units"

    id = Column(Integer, primary_key=True, index=True)
    unit_code = Column(String, unique=True, index=True, nullable=False)
    unit_name = Column(String, nullable=False)
    dimension = Column(String, nullable=False)
    conversion_factor = Column(Float, default=1.0)
    base_unit_id = Column(Integer, ForeignKey("units.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Parameter(Base):
    __tablename__ = "parameters"

    id = Column(Integer, primary_key=True, index=True)
    param_code = Column(String, unique=True, index=True, nullable=False)
    param_name = Column(String, nullable=False)
    default_unit_id = Column(Integer, ForeignKey("units.id"))
    created_at = Column(DateTime, default=datetime.utcnow)


class Threshold(Base):
    __tablename__ = "thresholds"

    id = Column(Integer, primary_key=True, index=True)
    parameter_id = Column(Integer, ForeignKey("parameters.id"), nullable=False)
    water_grade = Column(String, nullable=False)
    min_value = Column(Float)
    max_value = Column(Float)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    parameter = relationship("Parameter")


class FieldRecord(Base):
    __tablename__ = "field_records"

    id = Column(Integer, primary_key=True, index=True)
    record_code = Column(String, unique=True, index=True, nullable=False)
    sampling_point_id = Column(Integer, ForeignKey("sampling_points.id"), nullable=False)
    sampling_time = Column(DateTime, nullable=False)
    collector = Column(String, nullable=False)
    weather = Column(String)
    temperature = Column(Float)
    remark = Column(Text)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sampling_point = relationship("SamplingPoint")


class LabResult(Base):
    __tablename__ = "lab_results"

    id = Column(Integer, primary_key=True, index=True)
    field_record_id = Column(Integer, ForeignKey("field_records.id"), nullable=False)
    parameter_id = Column(Integer, ForeignKey("parameters.id"), nullable=False)
    raw_value = Column(Float, nullable=False)
    raw_unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    converted_value = Column(Float)
    standard_unit_id = Column(Integer, ForeignKey("units.id"))
    analyst = Column(String)
    analysis_time = Column(DateTime)
    is_approved = Column(Boolean, default=False)
    approver = Column(String)
    approval_time = Column(DateTime)
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    field_record = relationship("FieldRecord")
    parameter = relationship("Parameter")
    raw_unit = relationship("Unit", foreign_keys=[raw_unit_id])
    standard_unit = relationship("Unit", foreign_keys=[standard_unit_id])


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    entity_id = Column(Integer)
    original_data = Column(Text)
    modified_data = Column(Text)
    operator = Column(String, nullable=False)
    conclusion = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class ReviewReport(Base):
    __tablename__ = "review_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_code = Column(String, unique=True, index=True, nullable=False)
    field_record_ids = Column(Text, nullable=False)
    reviewer = Column(String, nullable=False)
    review_time = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="draft")
    conclusion = Column(String)
    issues = Column(Text)
    missing_samples = Column(Text)
    export_path = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
