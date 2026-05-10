from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Boolean,
    Text,
    ForeignKey,
    JSON
)
from sqlalchemy.orm import relationship

from ..database import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(200), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    requests = relationship("RetractionRequest", back_populates="requester")


class TrainingDataset(Base):
    __tablename__ = "training_datasets"
    
    id = Column(String(50), primary_key=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    version = Column(String(20), default="1.0")
    created_at = Column(DateTime, default=datetime.utcnow)
    data_store_path = Column(String(500), nullable=False)
    record_count = Column(Integer, default=0)
    
    data_records = relationship("DataRecord", back_populates="dataset")
    features = relationship("Feature", back_populates="dataset")


class DataRecord(Base):
    __tablename__ = "data_records"
    
    id = Column(String(100), primary_key=True)
    dataset_id = Column(String(50), ForeignKey("training_datasets.id"), nullable=False)
    user_id = Column(String(50), nullable=True)
    external_id = Column(String(100), nullable=True)
    record_hash = Column(String(64), nullable=False)
    content_summary = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_retracted = Column(Boolean, default=False)
    retracted_at = Column(DateTime, nullable=True)
    
    dataset = relationship("TrainingDataset", back_populates="data_records")
    feature_impacts = relationship("FeatureImpact", back_populates="data_record")
    request_mappings = relationship("RequestDataMapping", back_populates="data_record")


class Feature(Base):
    __tablename__ = "features"
    
    id = Column(String(50), primary_key=True)
    dataset_id = Column(String(50), ForeignKey("training_datasets.id"), nullable=False)
    name = Column(String(100), nullable=False)
    feature_type = Column(String(50), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    dataset = relationship("TrainingDataset", back_populates="features")
    model_feature_links = relationship("ModelFeatureLink", back_populates="feature")
    feature_impacts = relationship("FeatureImpact", back_populates="feature")


class MLModel(Base):
    __tablename__ = "ml_models"
    
    id = Column(String(50), primary_key=True)
    name = Column(String(200), nullable=False)
    version = Column(String(20), nullable=False)
    model_type = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    trained_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="active")
    model_store_path = Column(String(500), nullable=False)
    
    feature_links = relationship("ModelFeatureLink", back_populates="model")
    model_impacts = relationship("ModelImpact", back_populates="model")


class ModelFeatureLink(Base):
    __tablename__ = "model_feature_links"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    model_id = Column(String(50), ForeignKey("ml_models.id"), nullable=False)
    feature_id = Column(String(50), ForeignKey("features.id"), nullable=False)
    weight = Column(JSON, nullable=True)
    importance_score = Column(Integer, default=1)
    
    model = relationship("MLModel", back_populates="feature_links")
    feature = relationship("Feature", back_populates="model_feature_links")


class RetractionRequestStatus:
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class RetractionRequest(Base):
    __tablename__ = "retraction_requests"
    
    id = Column(String(50), primary_key=True)
    requester_id = Column(String(50), ForeignKey("users.id"), nullable=False)
    status = Column(String(20), default=RetractionRequestStatus.PENDING)
    retraction_reason = Column(Text, nullable=False)
    ruleset_version = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    approval_notes = Column(Text, nullable=True)
    
    requester = relationship("User", back_populates="requests")
    data_mappings = relationship("RequestDataMapping", back_populates="request")
    feature_cleanups = relationship("FeatureCleanup", back_populates="request")
    model_impacts = relationship("ModelImpact", back_populates="request")
    receipts = relationship("ExecutionReceipt", back_populates="request")
    compliance_reports = relationship("ComplianceReport", back_populates="request")
    rule_evaluations = relationship("RuleEvaluation", back_populates="request")


class RequestDataMapping(Base):
    __tablename__ = "request_data_mappings"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(String(50), ForeignKey("retraction_requests.id"), nullable=False)
    data_record_id = Column(String(100), ForeignKey("data_records.id"), nullable=False)
    located_through = Column(String(100), nullable=False)
    location_confidence = Column(Integer, default=100)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    request = relationship("RetractionRequest", back_populates="data_mappings")
    data_record = relationship("DataRecord", back_populates="request_mappings")


class FeatureImpact(Base):
    __tablename__ = "feature_impacts"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    feature_id = Column(String(50), ForeignKey("features.id"), nullable=False)
    data_record_id = Column(String(100), ForeignKey("data_records.id"), nullable=False)
    impact_score = Column(Integer, default=0)
    impact_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    feature = relationship("Feature", back_populates="feature_impacts")
    data_record = relationship("DataRecord", back_populates="feature_impacts")


class FeatureCleanupStatus:
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SKIPPED = "skipped"
    FAILED = "failed"


class FeatureCleanup(Base):
    __tablename__ = "feature_cleanups"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(String(50), ForeignKey("retraction_requests.id"), nullable=False)
    feature_id = Column(String(50), ForeignKey("features.id"), nullable=False)
    status = Column(String(20), default=FeatureCleanupStatus.PENDING)
    cleanup_action = Column(String(100), nullable=False)
    executed_at = Column(DateTime, nullable=True)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    request = relationship("RetractionRequest", back_populates="feature_cleanups")
    feature = relationship("Feature")


class ModelImpactSeverity:
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ModelImpact(Base):
    __tablename__ = "model_impacts"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(String(50), ForeignKey("retraction_requests.id"), nullable=False)
    model_id = Column(String(50), ForeignKey("ml_models.id"), nullable=False)
    severity = Column(String(20), nullable=False)
    affected_features_count = Column(Integer, default=0)
    retraining_required = Column(Boolean, default=False)
    impact_description = Column(Text)
    assessed_at = Column(DateTime, default=datetime.utcnow)
    
    request = relationship("RetractionRequest", back_populates="model_impacts")
    model = relationship("MLModel", back_populates="model_impacts")


class ExecutionReceipt(Base):
    __tablename__ = "execution_receipts"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(String(50), ForeignKey("retraction_requests.id"), nullable=False)
    receipt_type = Column(String(50), nullable=False)
    payload = Column(JSON, nullable=False)
    signature = Column(String(256), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    request = relationship("RetractionRequest", back_populates="receipts")


class ComplianceReportStatus:
    DRAFT = "draft"
    FINALIZED = "finalized"
    ARCHIVED = "archived"


class ComplianceReport(Base):
    __tablename__ = "compliance_reports"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(String(50), ForeignKey("retraction_requests.id"), nullable=False)
    report_type = Column(String(50), nullable=False)
    status = Column(String(20), default=ComplianceReportStatus.DRAFT)
    content = Column(JSON, nullable=False)
    generated_at = Column(DateTime, default=datetime.utcnow)
    finalized_at = Column(DateTime, nullable=True)
    
    request = relationship("RetractionRequest", back_populates="compliance_reports")


class RuleDefinition(Base):
    __tablename__ = "rule_definitions"
    
    id = Column(String(100), primary_key=True)
    ruleset = Column(String(50), nullable=False)
    version = Column(String(20), nullable=False)
    rule_name = Column(String(100), nullable=False)
    rule_type = Column(String(50), nullable=False)
    condition_expression = Column(Text, nullable=False)
    action = Column(String(50), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    evaluations = relationship("RuleEvaluation", back_populates="rule")


class RuleEvaluation(Base):
    __tablename__ = "rule_evaluations"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    rule_id = Column(String(100), ForeignKey("rule_definitions.id"), nullable=False)
    request_id = Column(String(50), ForeignKey("retraction_requests.id"), nullable=False)
    input_values = Column(JSON, nullable=False)
    evaluation_result = Column(Boolean, nullable=False)
    evaluation_notes = Column(Text)
    evaluated_at = Column(DateTime, default=datetime.utcnow)
    
    rule = relationship("RuleDefinition", back_populates="evaluations")
    request = relationship("RetractionRequest", back_populates="rule_evaluations")
