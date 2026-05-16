from sqlalchemy import create_engine, Column, Integer, String, JSON, DateTime, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import json

SQLALCHEMY_DATABASE_URL = "sqlite:///./cardinality_guardrail.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Status:
    PENDING = "PENDING"
    BLOCKED = "BLOCKED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    APPLIED = "APPLIED"

class Application(Base):
    __tablename__ = "applications"
    
    id = Column(Integer, primary_key=True, index=True)
    metric_name = Column(String, index=True, nullable=False)
    labels = Column(JSON, nullable=False)
    estimated_cardinality = Column(Integer, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String, default=Status.PENDING, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    reviewed_by = Column(String, nullable=True)
    review_comment = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    applied_at = Column(DateTime, nullable=True)
    raw_input = Column(JSON, nullable=False)
    process_result = Column(JSON, nullable=True)
    block_reason = Column(Text, nullable=True)
    
    def to_dict(self):
        return {
            "id": self.id,
            "metric_name": self.metric_name,
            "labels": self.labels,
            "estimated_cardinality": self.estimated_cardinality,
            "reason": self.reason,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "reviewed_by": self.reviewed_by,
            "review_comment": self.review_comment,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "applied_at": self.applied_at.isoformat() if self.applied_at else None,
            "block_reason": self.block_reason,
            "process_result": self.process_result,
            "raw_input": self.raw_input
        }

class WhitelistLabel(Base):
    __tablename__ = "whitelist_labels"
    
    id = Column(Integer, primary_key=True, index=True)
    label_key = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String, default="system")
    
    def to_dict(self):
        return {
            "id": self.id,
            "label_key": self.label_key,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "created_by": self.created_by
        }

class BlockRecord(Base):
    __tablename__ = "block_records"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, index=True)
    metric_name = Column(String, index=True)
    block_type = Column(String)
    block_detail = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "application_id": self.application_id,
            "metric_name": self.metric_name,
            "block_type": self.block_type,
            "block_detail": self.block_detail,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

def init_db():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        default_labels = ["env", "service", "version", "instance", "region", "zone"]
        for label in default_labels:
            existing = session.query(WhitelistLabel).filter(WhitelistLabel.label_key == label).first()
            if not existing:
                db_label = WhitelistLabel(label_key=label, description=f"默认标签: {label}")
                session.add(db_label)
        session.commit()
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
