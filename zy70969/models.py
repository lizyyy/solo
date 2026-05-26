from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class SubmissionBatch(Base):
    __tablename__ = "submission_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, unique=True, index=True)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    total_records = Column(Integer, default=0)
    normal_count = Column(Integer, default=0)
    confirm_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)

    records = relationship("SprayRecord", back_populates="batch")


class ChemicalInventory(Base):
    __tablename__ = "chemical_inventories"

    id = Column(Integer, primary_key=True, index=True)
    chemical_code = Column(String, unique=True, index=True)
    name = Column(String)
    max_dosage_per_100m2 = Column(Float)
    min_interval_days = Column(Integer)
    wind_speed_limit = Column(Float)
    hazard_level = Column(String)
    notes = Column(Text, nullable=True)


class SprayRecord(Base):
    __tablename__ = "spray_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("submission_batches.id"))
    record_hash = Column(String, index=True)
    is_duplicate = Column(Boolean, default=False)

    chemical_code = Column(String)
    area_code = Column(String)
    spray_date = Column(String)
    dosage = Column(Float)
    operator = Column(String)
    weather_code = Column(String)

    status = Column(String)
    rule_violations = Column(Text)
    suggestion = Column(Text)
    raw_data = Column(Text)

    batch = relationship("SubmissionBatch", back_populates="records")


class WeatherRecord(Base):
    __tablename__ = "weather_records"

    id = Column(Integer, primary_key=True, index=True)
    weather_code = Column(String, unique=True, index=True)
    record_date = Column(String)
    wind_speed = Column(Float)
    temperature = Column(Float)
    humidity = Column(Float)
    rainfall = Column(Float)
    weather_condition = Column(String)


class ProcessReport(Base):
    __tablename__ = "process_reports"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("submission_batches.id"))
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    report_content = Column(Text)
