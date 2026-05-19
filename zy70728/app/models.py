from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class ProxyRule(Base):
    __tablename__ = "proxy_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    path_pattern = Column(String(500), nullable=False)
    method = Column(String(20), default="*")
    target_url = Column(String(500))
    rewrite_path = Column(String(500))
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    description = Column(Text)

    hit_results = relationship("HitResult", back_populates="rule")


class SampleRequest(Base):
    __tablename__ = "sample_requests"

    id = Column(Integer, primary_key=True, index=True)
    path = Column(String(1000), nullable=False)
    method = Column(String(20), nullable=False)
    headers = Column(JSON)
    query_params = Column(JSON)
    body = Column(Text)
    source = Column(String(200))
    expected_status = Column(Integer)
    expected_response = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    hit_results = relationship("HitResult", back_populates="sample_request")


class ShadowBatch(Base):
    __tablename__ = "shadow_batches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    status = Column(String(50), default="pending")
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    rule_ids = Column(JSON)
    total_samples = Column(Integer, default=0)
    passed_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    diff_count = Column(Integer, default=0)
    description = Column(Text)

    hit_results = relationship("HitResult", back_populates="batch")
    reports = relationship("TestReport", back_populates="batch")


class HitResult(Base):
    __tablename__ = "hit_results"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("shadow_batches.id"))
    rule_id = Column(Integer, ForeignKey("proxy_rules.id"))
    sample_request_id = Column(Integer, ForeignKey("sample_requests.id"))
    status = Column(String(50), default="pending")
    actual_status = Column(Integer)
    actual_response = Column(Text)
    actual_headers = Column(JSON)
    response_time_ms = Column(Integer)
    has_diff = Column(Boolean, default=False)
    diff_details = Column(JSON)
    executed_at = Column(DateTime(timezone=True))

    batch = relationship("ShadowBatch", back_populates="hit_results")
    rule = relationship("ProxyRule", back_populates="hit_results")
    sample_request = relationship("SampleRequest", back_populates="hit_results")
    diff_reasons = relationship("DiffReason", back_populates="hit_result")


class DiffReason(Base):
    __tablename__ = "diff_reasons"

    id = Column(Integer, primary_key=True, index=True)
    hit_result_id = Column(Integer, ForeignKey("hit_results.id"))
    category = Column(String(100))
    description = Column(Text)
    field_path = Column(String(500))
    expected_value = Column(Text)
    actual_value = Column(Text)
    severity = Column(String(50), default="medium")
    is_false_positive = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    hit_result = relationship("HitResult", back_populates="diff_reasons")


class TestReport(Base):
    __tablename__ = "test_reports"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("shadow_batches.id"))
    name = Column(String(200), nullable=False)
    content = Column(JSON)
    format = Column(String(50), default="json")
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("ShadowBatch", back_populates="reports")


class ExceptionRecord(Base):
    __tablename__ = "exception_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer)
    hit_result_id = Column(Integer)
    original_input = Column(JSON)
    error_message = Column(Text)
    error_type = Column(String(200))
    stack_trace = Column(Text)
    handler = Column(String(100))
    handle_conclusion = Column(String(500))
    handled_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
