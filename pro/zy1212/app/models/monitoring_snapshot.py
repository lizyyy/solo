from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class MonitoringSnapshot(Base):
    __tablename__ = "monitoring_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    load_test_batch_id = Column(Integer, ForeignKey("load_test_batches.id"), nullable=True, index=True)
    
    name = Column(String(255), nullable=False)
    snapshot_type = Column(String(50), default="during_test")
    
    snapshot_time = Column(DateTime, nullable=False)
    
    cpu_utilization_percent = Column(Float, nullable=True)
    memory_utilization_percent = Column(Float, nullable=True)
    disk_utilization_percent = Column(Float, nullable=True)
    network_utilization_percent = Column(Float, nullable=True)
    
    gc_count = Column(Integer, nullable=True)
    gc_time_ms = Column(Integer, nullable=True)
    
    database_connections = Column(Integer, nullable=True)
    database_query_latency_ms = Column(Float, nullable=True)
    
    cache_hit_rate = Column(Float, nullable=True)
    
    thread_count = Column(Integer, nullable=True)
    deadlock_count = Column(Integer, nullable=True)
    
    custom_metrics = Column(JSON, nullable=True)
    
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="monitoring_snapshots")
    load_test_batch = relationship("LoadTestBatch", back_populates="monitoring_snapshots")
