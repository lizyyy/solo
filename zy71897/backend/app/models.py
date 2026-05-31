from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class Compressor(Base):
    __tablename__ = "compressors"

    id = Column(Integer, primary_key=True, index=True)
    equipment_no = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100))
    model = Column(String(100))
    rated_power = Column(Float)
    rated_pressure = Column(Float)
    location = Column(String(200))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    energy_records = relationship("EnergyRecord", back_populates="compressor")
    vibration_records = relationship("VibrationRecord", back_populates="compressor")
    diagnoses = relationship("Diagnosis", back_populates="compressor")


class EnergyRecord(Base):
    __tablename__ = "energy_records"

    id = Column(Integer, primary_key=True, index=True)
    compressor_id = Column(Integer, ForeignKey("compressors.id"), nullable=False)
    record_time = Column(DateTime(timezone=True), nullable=False, index=True)
    power = Column(Float)
    current = Column(Float)
    voltage = Column(Float)
    pressure = Column(Float)
    flow_rate = Column(Float)
    temperature = Column(Float)
    running_hours = Column(Float)
    load_rate = Column(Float)
    is_manual_edited = Column(Boolean, default=False)
    edited_by = Column(String(50))
    edited_at = Column(DateTime(timezone=True))
    batch_id = Column(String(100), index=True)
    source_file = Column(String(200))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    compressor = relationship("Compressor", back_populates="energy_records")

    __table_args__ = (
        Index('idx_compressor_time', 'compressor_id', 'record_time', unique=True),
    )


class VibrationRecord(Base):
    __tablename__ = "vibration_records"

    id = Column(Integer, primary_key=True, index=True)
    compressor_id = Column(Integer, ForeignKey("compressors.id"), nullable=False)
    record_time = Column(DateTime(timezone=True), nullable=False, index=True)
    x_vibration = Column(Float)
    y_vibration = Column(Float)
    z_vibration = Column(Float)
    overall_vibration = Column(Float)
    frequency_spectrum = Column(Text)
    is_manual_edited = Column(Boolean, default=False)
    edited_by = Column(String(50))
    edited_at = Column(DateTime(timezone=True))
    batch_id = Column(String(100), index=True)
    source_file = Column(String(200))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    compressor = relationship("Compressor", back_populates="vibration_records")

    __table_args__ = (
        Index('idx_vib_compressor_time', 'compressor_id', 'record_time', unique=True),
    )


class ThresholdConfig(Base):
    __tablename__ = "threshold_configs"

    id = Column(Integer, primary_key=True, index=True)
    parameter_name = Column(String(50), nullable=False)
    level = Column(String(20), nullable=False)
    min_value = Column(Float)
    max_value = Column(Float)
    unit = Column(String(20))
    description = Column(String(500))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        Index('idx_param_level', 'parameter_name', 'level', unique=True),
    )


class Diagnosis(Base):
    __tablename__ = "diagnoses"

    id = Column(Integer, primary_key=True, index=True)
    compressor_id = Column(Integer, ForeignKey("compressors.id"), nullable=False)
    diagnosis_time = Column(DateTime(timezone=True), nullable=False, index=True)
    diagnosis_type = Column(String(50))
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    energy_consumption = Column(Float)
    energy_efficiency = Column(Float)
    load_rate_avg = Column(Float)
    anomaly_score = Column(Float)
    abnormal_count = Column(Integer, default=0)
    status = Column(String(20), default="pending")
    reviewed_by = Column(String(50))
    reviewed_at = Column(DateTime(timezone=True))
    review_comment = Column(Text)
    is_manual_corrected = Column(Boolean, default=False)
    corrected_by = Column(String(50))
    corrected_at = Column(DateTime(timezone=True))
    correction_note = Column(Text)
    batch_id = Column(String(100), index=True)
    report_hash = Column(String(100), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    compressor = relationship("Compressor", back_populates="diagnoses")
    anomalies = relationship("Anomaly", back_populates="diagnosis", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_diagnosis_scope', 'compressor_id', 'start_time', 'end_time', unique=True),
    )


class Anomaly(Base):
    __tablename__ = "anomalies"

    id = Column(Integer, primary_key=True, index=True)
    diagnosis_id = Column(Integer, ForeignKey("diagnoses.id"), nullable=False)
    record_time = Column(DateTime(timezone=True), nullable=False, index=True)
    parameter = Column(String(50), nullable=False)
    actual_value = Column(Float)
    threshold_level = Column(String(20))
    threshold_min = Column(Float)
    threshold_max = Column(Float)
    deviation = Column(Float)
    severity = Column(String(20))
    description = Column(String(500))
    recommendation = Column(String(500))
    is_manual_override = Column(Boolean, default=False)
    override_note = Column(String(200))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    diagnosis = relationship("Diagnosis", back_populates="anomalies")


class ExportRecord(Base):
    __tablename__ = "export_records"

    id = Column(Integer, primary_key=True, index=True)
    export_time = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    export_type = Column(String(50))
    compressor_id = Column(Integer, ForeignKey("compressors.id"))
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    filters = Column(Text)
    view_state = Column(Text)
    file_path = Column(String(300))
    file_name = Column(String(200))
    report_hash = Column(String(100), index=True)
    exported_by = Column(String(50))
    record_count = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
