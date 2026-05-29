from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Text, DateTime, ForeignKey, JSON,
)
from sqlalchemy.orm import relationship
from app.database import Base


class Experiment(Base):
    __tablename__ = "experiments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    formulas = relationship("Formula", back_populates="experiment")
    kiln_records = relationship("KilnRecord", back_populates="experiment")
    clay_records = relationship("ClayRecord", back_populates="experiment")
    photos = relationship("Photo", back_populates="experiment")
    notes = relationship("Note", back_populates="experiment")
    reports = relationship("Report", back_populates="experiment")
    anomalies = relationship("Anomaly", back_populates="experiment")


class Formula(Base):
    __tablename__ = "formulas"

    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(Integer, ForeignKey("experiments.id"), nullable=False)
    version = Column(Integer, default=1)
    parent_id = Column(Integer, ForeignKey("formulas.id"), nullable=True)
    name = Column(String(200), nullable=False)
    ingredients = Column(JSON, nullable=False)
    source = Column(String(50), default="formula")
    created_at = Column(DateTime, default=datetime.utcnow)

    experiment = relationship("Experiment", back_populates="formulas")
    parent = relationship("Formula", remote_side=[id])


class KilnRecord(Base):
    __tablename__ = "kiln_records"

    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(Integer, ForeignKey("experiments.id"), nullable=False)
    formula_id = Column(Integer, ForeignKey("formulas.id"), nullable=True)
    target_temp = Column(Float, nullable=True)
    temp_curve = Column(JSON, nullable=True)
    soak_duration_min = Column(Float, nullable=True)
    source = Column(String(50), default="kiln")
    recorded_at = Column(DateTime, default=datetime.utcnow)

    experiment = relationship("Experiment", back_populates="kiln_records")


class ClayRecord(Base):
    __tablename__ = "clay_records"

    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(Integer, ForeignKey("experiments.id"), nullable=False)
    clay_type = Column(String(100), nullable=False)
    clay_origin = Column(String(200), nullable=True)
    properties = Column(JSON, nullable=True)
    source = Column(String(50), default="clay")
    created_at = Column(DateTime, default=datetime.utcnow)

    experiment = relationship("Experiment", back_populates="clay_records")


class Photo(Base):
    __tablename__ = "photos"

    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(Integer, ForeignKey("experiments.id"), nullable=False)
    file_path = Column(String(500), nullable=False)
    label = Column(String(200), nullable=True)
    photo_type = Column(String(50), nullable=True)
    color_hex = Column(String(7), nullable=True)
    source = Column(String(50), default="photo")
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    experiment = relationship("Experiment", back_populates="photos")


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(Integer, ForeignKey("experiments.id"), nullable=False)
    author = Column(String(100), nullable=True)
    content = Column(Text, nullable=False)
    source = Column(String(50), default="note")
    created_at = Column(DateTime, default=datetime.utcnow)

    experiment = relationship("Experiment", back_populates="notes")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(Integer, ForeignKey("experiments.id"), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(JSON, nullable=False)
    source = Column(String(50), default="report")
    created_at = Column(DateTime, default=datetime.utcnow)

    experiment = relationship("Experiment", back_populates="reports")


class Anomaly(Base):
    __tablename__ = "anomalies"

    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(Integer, ForeignKey("experiments.id"), nullable=True)
    category = Column(String(50), nullable=False)
    severity = Column(String(20), default="warning")
    message = Column(Text, nullable=False)
    detail = Column(JSON, nullable=True)
    suggestion = Column(Text, nullable=True)
    resolved = Column(Integer, default=0)
    source_ref = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    experiment = relationship("Experiment", back_populates="anomalies")
