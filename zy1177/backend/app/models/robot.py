from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base
import enum


class RobotStatus(str, enum.Enum):
    IDLE = "idle"
    MOVING = "moving"
    LOADING = "loading"
    UNLOADING = "unloading"
    CHARGING = "charging"
    FAULT = "fault"
    WAITING = "waiting"


class Robot(Base):
    __tablename__ = "robots"

    id = Column(Integer, primary_key=True, index=True)
    robot_id = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    
    warehouse_map_id = Column(Integer, ForeignKey("warehouse_maps.id"), nullable=True)
    
    current_x = Column(Float, default=0.0)
    current_y = Column(Float, default=0.0)
    current_z = Column(Float, default=0.0)
    orientation = Column(Float, default=0.0)
    
    status = Column(Enum(RobotStatus), default=RobotStatus.IDLE)
    
    battery_level = Column(Float, default=100.0)
    max_speed = Column(Float, default=1.0)
    current_speed = Column(Float, default=0.0)
    
    payload_capacity = Column(Float, default=50.0)
    current_payload = Column(Float, default=0.0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    warehouse_map = relationship("WarehouseMap", back_populates="robots")
    current_task = relationship("Task", back_populates="assigned_robot", uselist=False)
    frames = relationship("ReplayFrame", back_populates="robot")
    collision_risks = relationship("CollisionRisk", back_populates="robot")
    
    def __repr__(self):
        return f"<Robot {self.robot_id} - {self.status.value}>"
