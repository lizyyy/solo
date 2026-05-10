from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./model_approval.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String(100), nullable=False)
    version = Column(String(50), nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    current_status = Column(String(50), default="待评测")
    
    is_rolled_back = Column(Boolean, default=False)
    rollback_reason = Column(Text, nullable=True)
    rollback_at = Column(DateTime, nullable=True)
    
    traffic_weight = Column(Integer, default=0)
    is_production = Column(Boolean, default=False)
    
    evaluations = relationship("Evaluation", back_populates="model_version")
    approvals = relationship("Approval", back_populates="model_version")
    history = relationship("StatusHistory", back_populates="model_version")
    audits = relationship("AuditLog", back_populates="model_version")


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    model_version_id = Column(Integer, ForeignKey("model_versions.id"))
    
    evaluator = Column(String(100), nullable=False)
    accuracy_score = Column(String(20), nullable=False)
    performance_score = Column(String(20), nullable=False)
    stability_score = Column(String(20), nullable=False)
    overall_result = Column(String(20), nullable=False)
    
    findings = Column(Text, nullable=True)
    evaluated_at = Column(DateTime, default=datetime.utcnow)
    
    model_version = relationship("ModelVersion", back_populates="evaluations")


class Approval(Base):
    __tablename__ = "approvals"

    id = Column(Integer, primary_key=True, index=True)
    model_version_id = Column(Integer, ForeignKey("model_versions.id"))
    
    approver = Column(String(100), nullable=False)
    approval_type = Column(String(50), nullable=False)
    decision = Column(String(20), nullable=False)
    comments = Column(Text, nullable=True)
    approved_at = Column(DateTime, default=datetime.utcnow)
    
    model_version = relationship("ModelVersion", back_populates="approvals")


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, index=True)
    model_version_id = Column(Integer, ForeignKey("model_versions.id"))
    
    from_status = Column(String(50), nullable=True)
    to_status = Column(String(50), nullable=False)
    operator = Column(String(100), nullable=False)
    reason = Column(Text, nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow)
    
    model_version = relationship("ModelVersion", back_populates="history")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    model_version_id = Column(Integer, ForeignKey("model_versions.id"))
    
    action = Column(String(100), nullable=False)
    operator = Column(String(100), nullable=False)
    details = Column(Text, nullable=True)
    result = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    model_version = relationship("ModelVersion", back_populates="audits")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
