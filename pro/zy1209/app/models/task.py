from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base
from .enums import TaskStatus, AnalysisType, SeverityLevel, ExportFormat


class AnalysisTask(Base):
    __tablename__ = "analysis_tasks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.PENDING)
    
    config = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    error_message = Column(Text, nullable=True)
    
    input_snapshots = relationship("InputSnapshot", back_populates="task", cascade="all, delete-orphan")
    results = relationship("DiagnosisResult", back_populates="task", cascade="all, delete-orphan")
    export_records = relationship("ExportRecord", back_populates="task", cascade="all, delete-orphan")


class InputSnapshot(Base):
    __tablename__ = "input_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("analysis_tasks.id"), nullable=False)
    
    snapshot_type = Column(String(50), nullable=False)
    file_path = Column(String(512), nullable=True)
    content_hash = Column(String(64), nullable=True)
    content = Column(Text, nullable=True)
    
    snapshot_metadata = Column("metadata", JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    task = relationship("AnalysisTask", back_populates="input_snapshots")


class DiagnosisResult(Base):
    __tablename__ = "diagnosis_results"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("analysis_tasks.id"), nullable=False)
    
    analysis_type = Column(SQLEnum(AnalysisType), nullable=False)
    severity = Column(SQLEnum(SeverityLevel), default=SeverityLevel.INFO)
    
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    findings = Column(JSON, nullable=True)
    recommendations = Column(JSON, nullable=True)
    metrics = Column(JSON, nullable=True)
    
    raw_data = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    task = relationship("AnalysisTask", back_populates="results")


class ExportRecord(Base):
    __tablename__ = "export_records"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("analysis_tasks.id"), nullable=True)
    
    export_format = Column(SQLEnum(ExportFormat), nullable=False)
    file_path = Column(String(512), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size = Column(Integer, default=0)
    
    export_config = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    task = relationship("AnalysisTask", back_populates="export_records")
