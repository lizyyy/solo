from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base
import enum


class RobotState(str, enum.Enum):
    IDLE = "idle"
    MOVING = "moving"
    LOADING = "loading"
    UNLOADING = "unloading"
    CHARGING = "charging"
    FAULT = "fault"
    WAITING = "waiting"


class ReplayFrame(Base):
    __tablename__ = "replay_frames"

    id = Column(Integer, primary_key=True, index=True)
    
    batch_id = Column(Integer, ForeignKey("scheduling_batches.id"), nullable=False)
    robot_id = Column(Integer, ForeignKey("robots.id"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    
    frame_number = Column(Integer, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    z = Column(Float, default=0.0)
    orientation = Column(Float, default=0.0)
    
    speed = Column(Float, default=0.0)
    acceleration = Column(Float, default=0.0)
    
    battery_level = Column(Float, default=100.0)
    payload = Column(Float, default=0.0)
    
    state = Column(Enum(RobotState), default=RobotState.IDLE)
    status_text = Column(String(255), nullable=True)
    
    next_waypoint_x = Column(Float, nullable=True)
    next_waypoint_y = Column(Float, nullable=True)
    
    is_charging = Column(Boolean, default=False)
    is_fault = Column(Boolean, default=False)
    is_waiting = Column(Boolean, default=False)
    
    collision_risk_level = Column(Integer, default=0)
    collision_with_robot_id = Column(Integer, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    batch = relationship("SchedulingBatch", back_populates="frames")
    robot = relationship("Robot", back_populates="frames")
    task = relationship("Task", back_populates="frames")
    
    __table_args__ = (
        {'sqlite_autoincrement': True},
    )
    
    def __repr__(self):
        return f"<ReplayFrame Batch:{self.batch_id} Robot:{self.robot_id} Frame:{self.frame_number}>"
