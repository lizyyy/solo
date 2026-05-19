from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./schema_gatekeeper.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class SchemaVersion(Base):
    __tablename__ = "schema_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    schema_name = Column(String, index=True, nullable=False)
    version = Column(String, nullable=False)
    fields = Column(JSON, nullable=False)
    created_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    
    consumers = relationship("Consumer", back_populates="subscribed_schema")
    change_requests = relationship("ChangeRequest", back_populates="schema")


class Consumer(Base):
    __tablename__ = "consumers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    team = Column(String)
    email = Column(String)
    subscribed_schema_id = Column(Integer, ForeignKey("schema_versions.id"))
    subscribed_fields = Column(JSON)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    last_sync_at = Column(DateTime)
    
    subscribed_schema = relationship("SchemaVersion", back_populates="consumers")
    intercept_records = relationship("InterceptRecord", back_populates="consumer")


class CompatibilityRule(Base):
    __tablename__ = "compatibility_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String, nullable=False)
    rule_type = Column(String, nullable=False)
    description = Column(Text)
    severity = Column(String, default="error")
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ChangeRequest(Base):
    __tablename__ = "change_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    schema_id = Column(Integer, ForeignKey("schema_versions.id"))
    request_id = Column(String, unique=True, index=True)
    title = Column(String, nullable=False)
    change_type = Column(String)
    old_schema = Column(JSON)
    new_schema = Column(JSON)
    status = Column(String, default="pending")
    created_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    approved_at = Column(DateTime)
    approved_by = Column(String)
    comments = Column(Text)
    compatibility_result = Column(JSON)
    
    schema = relationship("SchemaVersion", back_populates="change_requests")
    intercept_records = relationship("InterceptRecord", back_populates="change_request")
    impact_reports = relationship("ImpactReport", back_populates="change_request")
    status_history = relationship("StatusHistory", back_populates="change_request", order_by="StatusHistory.changed_at")


class InterceptRecord(Base):
    __tablename__ = "intercept_records"
    
    id = Column(Integer, primary_key=True, index=True)
    change_request_id = Column(Integer, ForeignKey("change_requests.id"))
    consumer_id = Column(Integer, ForeignKey("consumers.id"))
    intercept_time = Column(DateTime, default=datetime.utcnow)
    reason = Column(Text)
    severity = Column(String)
    status = Column(String, default="open")
    resolved_at = Column(DateTime)
    resolved_by = Column(String)
    resolution_note = Column(Text)
    failed_sample = Column(JSON)
    
    change_request = relationship("ChangeRequest", back_populates="intercept_records")
    consumer = relationship("Consumer", back_populates="intercept_records")


class ImpactReport(Base):
    __tablename__ = "impact_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    change_request_id = Column(Integer, ForeignKey("change_requests.id"))
    report_type = Column(String)
    generated_at = Column(DateTime, default=datetime.utcnow)
    generated_by = Column(String)
    affected_consumers = Column(JSON)
    breaking_changes = Column(JSON)
    recommendations = Column(JSON)
    report_content = Column(Text)
    
    change_request = relationship("ChangeRequest", back_populates="impact_reports")


class StatusHistory(Base):
    __tablename__ = "status_history"
    
    id = Column(Integer, primary_key=True, index=True)
    change_request_id = Column(Integer, ForeignKey("change_requests.id"))
    from_status = Column(String)
    to_status = Column(String, nullable=False)
    changed_by = Column(String)
    changed_at = Column(DateTime, default=datetime.utcnow)
    comments = Column(Text)
    
    change_request = relationship("ChangeRequest", back_populates="status_history")


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
