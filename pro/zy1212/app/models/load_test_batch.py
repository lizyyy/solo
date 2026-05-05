from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class LoadTestBatch(Base):
    __tablename__ = "load_test_batches"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    traffic_model_id = Column(Integer, ForeignKey("traffic_models.id"), nullable=True, index=True)
    
    name = Column(String(255), nullable=False)
    batch_number = Column(Integer, nullable=False)
    description = Column(Text, nullable=True)
    
    test_type = Column(String(50), default="stress")
    environment = Column(String(50), default="staging")
    
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    
    total_requests = Column(Integer, default=0)
    failed_requests = Column(Integer, default=0)
    
    avg_response_time_ms = Column(Float, nullable=True)
    min_response_time_ms = Column(Float, nullable=True)
    max_response_time_ms = Column(Float, nullable=True)
    
    p50_response_time_ms = Column(Float, nullable=True)
    p95_response_time_ms = Column(Float, nullable=True)
    p99_response_time_ms = Column(Float, nullable=True)
    
    qps = Column(Float, nullable=True)
    tps = Column(Float, nullable=True)
    throughput_bytes_per_sec = Column(Float, nullable=True)
    
    error_rate = Column(Float, nullable=True)
    capacity_utilization_percent = Column(Float, nullable=True)
    
    raw_data_source = Column(String(255), nullable=True)
    raw_data = Column(JSON, nullable=True)
    
    is_baseline = Column(Boolean, default=False)
    baseline_comparison = Column(JSON, nullable=True)
    
    slo_evaluation = Column(JSON, nullable=True)
    bottleneck_analysis = Column(JSON, nullable=True)
    
    status = Column(String(50), default="completed")
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="load_test_batches")
    traffic_model = relationship("TrafficModel", back_populates="load_test_batches")
    monitoring_snapshots = relationship("MonitoringSnapshot", back_populates="load_test_batch")
