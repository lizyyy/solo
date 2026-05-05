from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base
import enum


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RiskType(str, enum.Enum):
    COLLISION = "collision"
    WAITING = "waiting"
    OBSTACLE = "obstacle"
    NARROW_PASSAGE = "narrow_passage"
    DEADLOCK = "deadlock"


class CollisionRisk(Base):
    __tablename__ = "collision_risks"

    id = Column(Integer, primary_key=True, index=True)
    
    batch_id = Column(Integer, ForeignKey("scheduling_batches.id"), nullable=False)
    robot_id = Column(Integer, ForeignKey("robots.id"), nullable=False)
    frame_id = Column(Integer, ForeignKey("replay_frames.id"), nullable=True)
    
    risk_type = Column(Enum(RiskType), nullable=False)
    risk_level = Column(Enum(RiskLevel), default=RiskLevel.LOW)
    
    robot_x = Column(Float, nullable=False)
    robot_y = Column(Float, nullable=False)
    
    other_robot_id = Column(Integer, ForeignKey("robots.id"), nullable=True)
    other_robot_x = Column(Float, nullable=True)
    other_robot_y = Column(Float, nullable=True)
    
    distance = Column(Float, nullable=True)
    time_to_collision = Column(Float, nullable=True)
    
    description = Column(String(500), nullable=True)
    action_taken = Column(String(500), nullable=True)
    
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    robot = relationship("Robot", back_populates="collision_risks", foreign_keys=[robot_id])
    
    def __repr__(self):
        return f"<CollisionRisk {self.risk_type.value} - {self.risk_level.value}>"
