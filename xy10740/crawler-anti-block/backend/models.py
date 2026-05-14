from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class CrawlerTask(Base):
    __tablename__ = "crawler_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(100), unique=True, index=True, nullable=False)
    idempotency_key = Column(String(100), unique=True, index=True, nullable=False)
    target_site = Column(String(255), index=True, nullable=False)
    proxy_pool = Column(String(255), nullable=False)
    status = Column(String(50), default="pending", index=True)
    version = Column(String(50), index=True)
    frequency_strategy = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    approved_by = Column(String(100))
    approved_at = Column(DateTime)
    rolled_back_from = Column(Integer)
    
    __table_args__ = (
        Index('idx_target_site_status', 'target_site', 'status'),
    )

class FailureReason(Base):
    __tablename__ = "failure_reasons"
    
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("crawler_tasks.id"), index=True)
    reason_type = Column(String(100), index=True)
    description = Column(Text)
    count = Column(Integer, default=1)
    first_occurred_at = Column(DateTime, default=datetime.utcnow)
    last_occurred_at = Column(DateTime, default=datetime.utcnow)
    
    task = relationship("CrawlerTask", backref="failure_reasons")

class CaptchaEvent(Base):
    __tablename__ = "captcha_events"
    
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("crawler_tasks.id"), index=True)
    event_type = Column(String(100))
    captcha_type = Column(String(100))
    confirmed = Column(Boolean, default=False)
    confirmed_by = Column(String(100))
    confirmed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    task = relationship("CrawlerTask", backref="captcha_events")

class FrequencyAnomaly(Base):
    __tablename__ = "frequency_anomalies"
    
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("crawler_tasks.id"), index=True)
    anomaly_type = Column(String(100))
    current_rate = Column(Float)
    expected_rate = Column(Float)
    threshold = Column(Float)
    detected_at = Column(DateTime, default=datetime.utcnow)
    resolved = Column(Boolean, default=False)
    
    task = relationship("CrawlerTask", backref="frequency_anomalies")

class CollectionReport(Base):
    __tablename__ = "collection_reports"
    
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("crawler_tasks.id"), index=True)
    total_requests = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    success_rate = Column(Float)
    avg_response_time = Column(Float)
    data_records = Column(Integer, default=0)
    report_date = Column(DateTime, default=datetime.utcnow)
    
    task = relationship("CrawlerTask", backref="collection_reports")