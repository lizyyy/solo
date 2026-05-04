"""数据库模型定义"""

from datetime import datetime
from typing import Optional, Dict, List
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, DateTime,
    Text, Boolean, ForeignKey, Index, JSON
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker, Session

Base = declarative_base()


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(200))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    extra_data = Column("metadata", JSON, default=dict)

    samples = relationship("Sample", back_populates="batch", cascade="all, delete-orphan")
    groups = relationship("DefectGroupModel", back_populates="batch", cascade="all, delete-orphan")
    anomalies = relationship("AnomalyModel", back_populates="batch", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_batches_batch_id', 'batch_id'),
    )


class Sample(Base):
    __tablename__ = "samples"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sample_id = Column(String(100), unique=True, nullable=False, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    image_path = Column(String(500), nullable=False)
    formula = Column(String(200), default="")
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    image_features_id = Column(Integer, ForeignKey("image_features.id"))
    text_features_id = Column(Integer, ForeignKey("text_features.id"))
    temperature_data_id = Column(Integer, ForeignKey("temperature_data.id"))
    group_id = Column(Integer, ForeignKey("defect_groups.id"))
    manual_group_id = Column(Integer, ForeignKey("defect_groups.id"))

    is_verified = Column(Boolean, default=False)
    verified_at = Column(DateTime)
    verified_by = Column(String(100))
    verification_notes = Column(Text, default="")

    extra_data = Column("metadata", JSON, default=dict)

    batch = relationship("Batch", back_populates="samples")
    image_features = relationship("ImageFeaturesModel", uselist=False, cascade="all")
    text_features = relationship("TextFeaturesModel", uselist=False, cascade="all")
    temperature_data = relationship("TemperatureDataModel", uselist=False, cascade="all")
    group = relationship("DefectGroupModel", foreign_keys=[group_id], back_populates="samples")
    manual_group = relationship("DefectGroupModel", foreign_keys=[manual_group_id])

    __table_args__ = (
        Index('idx_samples_sample_id', 'sample_id'),
        Index('idx_samples_batch_id', 'batch_id'),
        Index('idx_samples_formula', 'formula'),
    )


class ImageFeaturesModel(Base):
    __tablename__ = "image_features"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sample_id = Column(String(100), ForeignKey("samples.sample_id"), nullable=False, index=True)

    width = Column(Integer)
    height = Column(Integer)

    avg_bgr_b = Column(Float)
    avg_bgr_g = Column(Float)
    avg_bgr_r = Column(Float)
    avg_hsv_h = Column(Float)
    avg_hsv_s = Column(Float)
    avg_hsv_v = Column(Float)
    avg_lab_l = Column(Float)
    avg_lab_a = Column(Float)
    avg_lab_b = Column(Float)

    color_contrast = Column(Float)
    brightness = Column(Float)

    total_contours = Column(Integer)
    avg_contour_area = Column(Float)
    avg_contour_perimeter = Column(Float)
    max_contour_area = Column(Float)
    contour_density = Column(Float)
    edge_intensity = Column(Float)

    bubble_count = Column(Integer)
    total_bubble_area = Column(Float)
    avg_bubble_area = Column(Float)
    max_bubble_area = Column(Float)
    bubble_area_ratio = Column(Float)

    dominant_colors = Column(JSON, default=list)
    feature_vector = Column(JSON, default=list)

    created_at = Column(DateTime, default=datetime.utcnow)


class TextFeaturesModel(Base):
    __tablename__ = "text_features"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sample_id = Column(String(100), ForeignKey("samples.sample_id"), nullable=False, index=True)

    cleaned_text = Column(Text)
    words = Column(JSON, default=list)
    keywords = Column(JSON, default=list)
    defect_categories = Column(JSON, default=dict)
    defect_keywords = Column(JSON, default=list)
    has_defect = Column(Boolean, default=False)
    sentiment_score = Column(Float, default=0.5)
    feature_vector = Column(JSON, default=list)

    created_at = Column(DateTime, default=datetime.utcnow)


class TemperatureDataModel(Base):
    __tablename__ = "temperature_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sample_id = Column(String(100), ForeignKey("samples.sample_id"), nullable=False, index=True)

    source_file = Column(String(500))
    temperatures = Column(JSON, default=list)
    timestamps = Column(JSON, default=list)
    avg_temp = Column(Float)
    min_temp = Column(Float)
    max_temp = Column(Float)
    std_temp = Column(Float)

    extra_data = Column("metadata", JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)


class DefectGroupModel(Base):
    __tablename__ = "defect_groups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_id = Column(String(50), unique=True, nullable=False, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)

    name = Column(String(200))
    description = Column(Text)
    dominant_defect_type = Column(String(100))
    similarity_score = Column(Float, default=0.0)

    is_manual = Column(Boolean, default=False)
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    features_summary = Column(JSON, default=dict)
    extra_data = Column("metadata", JSON, default=dict)

    batch = relationship("Batch", back_populates="groups")
    samples = relationship("Sample", back_populates="group", foreign_keys="Sample.group_id")

    __table_args__ = (
        Index('idx_defect_groups_group_id', 'group_id'),
        Index('idx_defect_groups_batch_id', 'batch_id'),
    )


class AnomalyModel(Base):
    __tablename__ = "anomalies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    anomaly_id = Column(String(50), unique=True, nullable=False, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    sample_id = Column(String(100), ForeignKey("samples.sample_id"), nullable=False, index=True)

    anomaly_type = Column(String(100))
    severity = Column(Float, default=0.0)
    description = Column(Text)
    comparison_samples = Column(JSON, default=list)
    details = Column(JSON, default=dict)

    is_reviewed = Column(Boolean, default=False)
    reviewed_at = Column(DateTime)
    reviewed_by = Column(String(100))
    review_notes = Column(Text, default="")

    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="anomalies")

    __table_args__ = (
        Index('idx_anomalies_anomaly_id', 'anomaly_id'),
        Index('idx_anomalies_batch_id', 'batch_id'),
        Index('idx_anomalies_sample_id', 'sample_id'),
        Index('idx_anomalies_type', 'anomaly_type'),
    )


class VerificationHistory(Base):
    __tablename__ = "verification_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sample_id = Column(String(100), ForeignKey("samples.sample_id"), nullable=False, index=True)

    action = Column(String(50))
    old_group_id = Column(String(50))
    new_group_id = Column(String(50))
    notes = Column(Text, default="")
    performed_by = Column(String(100))
    performed_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index('idx_verification_sample_id', 'sample_id'),
        Index('idx_verification_performed_at', 'performed_at'),
    )


def init_db(db_path: str = "glass_inspector.db", echo: bool = False):
    db_url = f"sqlite:///{db_path}"
    engine = create_engine(db_url, echo=echo, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return engine, SessionLocal
