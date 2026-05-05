from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base
import enum


class TaskType(str, enum.Enum):
    PICKUP = "pickup"
    DROPOFF = "dropoff"
    CHARGE = "charge"
    MAINTENANCE = "maintenance"
    TRANSFER = "transfer"


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(50), unique=True, nullable=False)
    
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    assigned_robot_id = Column(Integer, ForeignKey("robots.id"), nullable=True)
    batch_id = Column(Integer, ForeignKey("scheduling_batches.id"), nullable=True)
    
    task_type = Column(Enum(TaskType), default=TaskType.TRANSFER)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    priority = Column(Integer, default=1)
    
    start_location_x = Column(Float, nullable=False)
    start_location_y = Column(Float, nullable=False)
    start_location_name = Column(String(100), nullable=True)
    
    end_location_x = Column(Float, nullable=False)
    end_location_y = Column(Float, nullable=False)
    end_location_name = Column(String(100), nullable=True)
    
    estimated_duration = Column(Float, default=0.0)
    actual_duration = Column(Float, default=0.0)
    
    scheduled_start_time = Column(DateTime, nullable=True)
    actual_start_time = Column(DateTime, nullable=True)
    actual_end_time = Column(DateTime, nullable=True)
    
    path = Column(String, nullable=True)
    waypoints = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    order = relationship("Order", back_populates="tasks")
    assigned_robot = relationship("Robot", back_populates="current_task")
    batch = relationship("SchedulingBatch", back_populates="tasks")
    frames = relationship("ReplayFrame", back_populates="task")
    
    def __repr__(self):
        return f"<Task {self.task_id} - {self.status.value}>"
