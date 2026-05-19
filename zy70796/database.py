from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./crawler_filter.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class AccessLog(Base):
    __tablename__ = "access_logs"
    id = Column(Integer, primary_key=True, index=True)
    ip = Column(String, index=True)
    user_agent = Column(Text)
    path = Column(String, index=True)
    method = Column(String(10))
    status_code = Column(Integer)
    request_time = Column(DateTime, index=True)
    referer = Column(Text)
    response_time = Column(Float)
    raw_log = Column(Text)
    is_crawler = Column(Boolean, default=None)
    crawler_confidence = Column(Float, default=0.0)
    crawler_type = Column(String, default=None)
    group_id = Column(String, index=True, default=None)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class FilterRule(Base):
    __tablename__ = "filter_rules"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    rule_type = Column(String)
    pattern = Column(Text)
    is_active = Column(Boolean, default=True)
    confidence = Column(Float, default=1.0)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

class PurificationReport(Base):
    __tablename__ = "purification_reports"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, unique=True, index=True)
    total_logs = Column(Integer, default=0)
    crawler_count = Column(Integer, default=0)
    human_count = Column(Integer, default=0)
    pending_count = Column(Integer, default=0)
    confidence_distribution = Column(Text)
    top_crawler_ips = Column(Text)
    top_crawler_user_agents = Column(Text)
    status = Column(String, default="processing")
    created_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    log_id = Column(Integer, ForeignKey("access_logs.id"), nullable=True)
    report_id = Column(Integer, ForeignKey("purification_reports.id"), nullable=True)
    action = Column(String)
    operator = Column(String)
    old_value = Column(Text)
    new_value = Column(Text)
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
