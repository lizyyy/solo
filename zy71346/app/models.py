import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.ext.mutable import MutableDict

from .database import Base


class TaskStatus(str, enum.Enum):
    CREATED = "created"
    IMPORTED = "imported"
    PROCESSING = "processing"
    REVIEWING = "reviewing"
    COMPLETED = "completed"
    FAILED = "failed"


class AnomalyType(str, enum.Enum):
    OVER_DENOISE = "over_denoise"
    SILENCE_MISJUDGE = "silence_misjudge"
    PARAM_OVERRIDE = "param_override"
    AUDIO_QUALITY = "audio_quality"


class AudioType(str, enum.Enum):
    ORIGINAL = "original"
    VOICE_SEGMENT = "voice_segment"
    NOISE_SAMPLE = "noise_sample"
    DENOISING_RESULT = "denoising_result"


class ComparisonTask(Base):
    __tablename__ = "comparison_tasks"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    status = Column(String(20), default=TaskStatus.CREATED, index=True)
    description = Column(Text, nullable=True)
    created_by = Column(String(100), nullable=True)
    manual_notes = Column(Text, nullable=True)
    source_metadata = Column(MutableDict.as_mutable(JSON), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    params = relationship("DenoiseParams", back_populates="task", cascade="all, delete-orphan")
    audio_segments = relationship("AudioSegment", back_populates="task", cascade="all, delete-orphan")
    listening_records = relationship("ListeningRecord", back_populates="task", cascade="all, delete-orphan")
    processing_results = relationship("ProcessingResult", back_populates="task", cascade="all, delete-orphan")
    reports = relationship("ComparisonReport", back_populates="task", cascade="all, delete-orphan")
    anomalies = relationship("AnomalyRecord", back_populates="task", cascade="all, delete-orphan")


class DenoiseParams(Base):
    __tablename__ = "denoise_params"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("comparison_tasks.id"), nullable=False)
    version = Column(Integer, default=1, nullable=False)
    name = Column(String(200), nullable=False)
    params_json = Column(MutableDict.as_mutable(JSON), nullable=False)
    is_active = Column(Boolean, default=True)
    source = Column(String(100), nullable=True)
    manual_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("ComparisonTask", back_populates="params")
    results = relationship("ProcessingResult", back_populates="params")
    anomalies = relationship("AnomalyRecord", back_populates="params")


class AudioSegment(Base):
    __tablename__ = "audio_segments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("comparison_tasks.id"), nullable=False)
    audio_type = Column(String(20), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    file_path = Column(String(500), nullable=False)
    duration = Column(Float, nullable=True)
    sample_rate = Column(Integer, nullable=True)
    channels = Column(Integer, nullable=True)
    start_time = Column(Float, nullable=True)
    end_time = Column(Float, nullable=True)
    source_metadata = Column(MutableDict.as_mutable(JSON), nullable=True)
    manual_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("ComparisonTask", back_populates="audio_segments")
    listening_records = relationship("ListeningRecord", back_populates="audio_segment")
    results = relationship("ProcessingResult", back_populates="audio_segment")


class ListeningRecord(Base):
    __tablename__ = "listening_records"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("comparison_tasks.id"), nullable=False)
    audio_segment_id = Column(Integer, ForeignKey("audio_segments.id"), nullable=False)
    params_id = Column(Integer, ForeignKey("denoise_params.id"), nullable=True)
    listener = Column(String(100), nullable=True)
    naturalness_score = Column(Integer, nullable=True)
    noise_reduction_score = Column(Integer, nullable=True)
    overall_score = Column(Integer, nullable=True)
    has_artifacts = Column(Boolean, default=False)
    has_echo = Column(Boolean, default=False)
    has_muffled = Column(Boolean, default=False)
    comments = Column(Text, nullable=True)
    manual_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("ComparisonTask", back_populates="listening_records")
    audio_segment = relationship("AudioSegment", back_populates="listening_records")
    params = relationship("DenoiseParams")


class ProcessingResult(Base):
    __tablename__ = "processing_results"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("comparison_tasks.id"), nullable=False)
    audio_segment_id = Column(Integer, ForeignKey("audio_segments.id"), nullable=False)
    params_id = Column(Integer, ForeignKey("denoise_params.id"), nullable=False)
    output_file_path = Column(String(500), nullable=True)
    snr_before = Column(Float, nullable=True)
    snr_after = Column(Float, nullable=True)
    snr_improvement = Column(Float, nullable=True)
    voice_preservation_rate = Column(Float, nullable=True)
    noise_reduction_rate = Column(Float, nullable=True)
    duration = Column(Float, nullable=True)
    processing_time = Column(Float, nullable=True)
    metrics = Column(MutableDict.as_mutable(JSON), nullable=True)
    manual_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("ComparisonTask", back_populates="processing_results")
    audio_segment = relationship("AudioSegment", back_populates="results")
    params = relationship("DenoiseParams", back_populates="results")


class AnomalyRecord(Base):
    __tablename__ = "anomaly_records"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("comparison_tasks.id"), nullable=False)
    params_id = Column(Integer, ForeignKey("denoise_params.id"), nullable=True)
    audio_segment_id = Column(Integer, ForeignKey("audio_segments.id"), nullable=True)
    anomaly_type = Column(String(30), nullable=False, index=True)
    severity = Column(String(20), default="warning")
    message = Column(Text, nullable=False)
    suggestion = Column(Text, nullable=True)
    detected_at = Column(DateTime, default=datetime.utcnow)
    resolved = Column(Boolean, default=False)
    resolved_by = Column(String(100), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)

    task = relationship("ComparisonTask", back_populates="anomalies")
    params = relationship("DenoiseParams", back_populates="anomalies")
    audio_segment = relationship("AudioSegment")


class ComparisonReport(Base):
    __tablename__ = "comparison_reports"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("comparison_tasks.id"), nullable=False)
    batch_no = Column(String(50), index=True, nullable=False)
    report_type = Column(String(50), default="full")
    name = Column(String(200), nullable=False)
    file_path = Column(String(500), nullable=False)
    format = Column(String(10), default="xlsx")
    summary = Column(MutableDict.as_mutable(JSON), nullable=True)
    exported_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("ComparisonTask", back_populates="reports")
