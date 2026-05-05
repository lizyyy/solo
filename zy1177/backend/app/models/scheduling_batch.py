from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base
import enum


class SchedulingStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"


class SchedulingAlgorithm(str, enum.Enum):
    GREEDY = "greedy"
    A_STAR = "a_star"
    GENETIC = "genetic"
    REINFORCEMENT_LEARNING = "reinforcement_learning"


class SchedulingBatch(Base):
    __tablename__ = "scheduling_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(50), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    warehouse_map_id = Column(Integer, ForeignKey("warehouse_maps.id"), nullable=True)
    
    algorithm = Column(Enum(SchedulingAlgorithm), default=SchedulingAlgorithm.GREEDY)
    status = Column(Enum(SchedulingStatus), default=SchedulingStatus.PENDING)
    
    total_robots = Column(Integer, default=0)
    total_orders = Column(Integer, default=0)
    total_tasks = Column(Integer, default=0)
    
    completed_orders = Column(Integer, default=0)
    completed_tasks = Column(Integer, default=0)
    
    total_distance = Column(Integer, default=0)
    total_energy = Column(Integer, default=0)
    
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    estimated_completion_time = Column(DateTime, nullable=True)
    
    config = Column(Text, nullable=True)
    metrics = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    warehouse_map = relationship("WarehouseMap", back_populates="batches")
    tasks = relationship("Task", back_populates="batch")
    frames = relationship("ReplayFrame", back_populates="batch")
    
    def __repr__(self):
        return f"<SchedulingBatch {self.batch_id} - {self.status.value}>"
