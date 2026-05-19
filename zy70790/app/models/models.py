from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Language(Base):
    __tablename__ = "languages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    display_name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class SdkConfig(Base):
    __tablename__ = "sdk_configs"

    id = Column(Integer, primary_key=True, index=True)
    language_id = Column(Integer, ForeignKey("languages.id"), nullable=False)
    sdk_version = Column(String)
    config_source = Column(String)
    config_content = Column(Text, nullable=False)
    imported_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    language = relationship("Language")
    retry_policies = relationship("RetryPolicy", back_populates="sdk_config")


class RetryPolicy(Base):
    __tablename__ = "retry_policies"

    id = Column(Integer, primary_key=True, index=True)
    sdk_config_id = Column(Integer, ForeignKey("sdk_configs.id"), nullable=False)
    status_code = Column(Integer, nullable=False)
    status_code_category = Column(String)
    max_retries = Column(Integer, nullable=False)
    backoff_strategy = Column(String)
    initial_delay = Column(Float)
    max_delay = Column(Float)
    multiplier = Column(Float)
    jitter_enabled = Column(Boolean, default=False)
    is_retryable = Column(Boolean, default=True)

    sdk_config = relationship("SdkConfig", back_populates="retry_policies")


class PolicyReport(Base):
    __tablename__ = "policy_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_name = Column(String, nullable=False)
    comparison_type = Column(String)
    status_codes_analyzed = Column(Integer)
    discrepancies_found = Column(Integer)
    report_content = Column(Text)
    generated_at = Column(DateTime, default=datetime.utcnow)
    needs_review = Column(Boolean, default=False)
    reviewed = Column(Boolean, default=False)
    reviewed_by = Column(String)
    reviewed_at = Column(DateTime)


class BackoffDiscrepancy(Base):
    __tablename__ = "backoff_discrepancies"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("policy_reports.id"), nullable=False)
    status_code = Column(Integer, nullable=False)
    language_a = Column(String, nullable=False)
    language_b = Column(String, nullable=False)
    field_name = Column(String, nullable=False)
    value_a = Column(String)
    value_b = Column(String)
    severity = Column(String)
    description = Column(Text)
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime)