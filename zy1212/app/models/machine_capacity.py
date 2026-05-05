from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class MachineCapacity(Base):
    __tablename__ = "machine_capacities"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    
    name = Column(String(255), nullable=False)
    machine_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    cpu_cores = Column(Integer, nullable=False)
    cpu_model = Column(String(255), nullable=True)
    memory_gb = Column(Float, nullable=False)
    disk_gb = Column(Integer, nullable=True)
    network_bandwidth_gbps = Column(Float, nullable=True)
    
    max_qps_estimated = Column(Integer, nullable=True)
    max_connections = Column(Integer, nullable=True)
    
    tags = Column(JSON, nullable=True)
    metadata = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    project = relationship("Project", back_populates="machine_capacities")
