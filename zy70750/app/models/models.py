from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class LogDirectory(Base):
    __tablename__ = "log_directories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    path = Column(String(500), nullable=False, unique=True)
    file_pattern = Column(String(100), default="*.log")
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    regression_tasks = relationship("RegressionTask", back_populates="log_directory")


class MaskingRule(Base):
    __tablename__ = "masking_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    pattern = Column(String(500), nullable=False)
    replacement = Column(String(100), default="***")
    priority = Column(Integer, default=0)
    rule_type = Column(String(50), default="regex")
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class RetainedField(Base):
    __tablename__ = "retained_fields"

    id = Column(Integer, primary_key=True, index=True)
    field_name = Column(String(255), nullable=False)
    field_pattern = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RiskWord(Base):
    __tablename__ = "risk_words"

    id = Column(Integer, primary_key=True, index=True)
    word = Column(String(255), nullable=False, unique=True)
    severity = Column(String(50), default="medium")
    category = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RegressionTask(Base):
    __tablename__ = "regression_tasks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    log_directory_id = Column(Integer, ForeignKey("log_directories.id"))
    status = Column(String(50), default="pending")
    total_files = Column(Integer, default=0)
    total_lines = Column(Integer, default=0)
    processed_lines = Column(Integer, default=0)
    failed_lines = Column(Integer, default=0)
    diff_count = Column(Integer, default=0)
    risk_score = Column(Float, default=0.0)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    log_directory = relationship("LogDirectory", back_populates="regression_tasks")
    results = relationship("RegressionResult", back_populates="task")
    diff_reports = relationship("DiffReport", back_populates="task")
    failed_records = relationship("FailedRecord", back_populates="task")


class RegressionResult(Base):
    __tablename__ = "regression_results"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("regression_tasks.id"))
    file_path = Column(String(500), nullable=False)
    line_number = Column(Integer, nullable=False)
    original_content = Column(Text, nullable=False)
    masked_content = Column(Text, nullable=False)
    applied_rules = Column(Text, nullable=True)
    is_matched = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    task = relationship("RegressionTask", back_populates="results")


class DiffReport(Base):
    __tablename__ = "diff_reports"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("regression_tasks.id"))
    result_id = Column(Integer, ForeignKey("regression_results.id"))
    diff_type = Column(String(50), nullable=False)
    field_name = Column(String(255), nullable=True)
    original_value = Column(Text, nullable=True)
    masked_value = Column(Text, nullable=True)
    expected_value = Column(Text, nullable=True)
    severity = Column(String(50), default="medium")
    description = Column(Text, nullable=True)
    is_reviewed = Column(Boolean, default=False)
    reviewed_by = Column(String(100), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    task = relationship("RegressionTask", back_populates="diff_reports")


class FailedRecord(Base):
    __tablename__ = "failed_records"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("regression_tasks.id"))
    file_path = Column(String(500), nullable=False)
    line_number = Column(Integer, nullable=False)
    original_content = Column(Text, nullable=False)
    error_type = Column(String(100), nullable=False)
    error_message = Column(Text, nullable=True)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(String(100), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    task = relationship("RegressionTask", back_populates="failed_records")
