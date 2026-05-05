from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    service_name = Column(String(100), nullable=False)
    environment = Column(String(50), nullable=False, default="production")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    interfaces = relationship("Interface", back_populates="project", cascade="all, delete-orphan")
    traffic_models = relationship("TrafficModel", back_populates="project", cascade="all, delete-orphan")
    load_test_batches = relationship("LoadTestBatch", back_populates="project", cascade="all, delete-orphan")
    machine_capacities = relationship("MachineCapacity", back_populates="project", cascade="all, delete-orphan")
    monitoring_snapshots = relationship("MonitoringSnapshot", back_populates="project", cascade="all, delete-orphan")
    optimization_actions = relationship("OptimizationAction", back_populates="project", cascade="all, delete-orphan")
