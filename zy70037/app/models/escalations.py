from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from .base import Base

class Escalation(Base):
    dispatch_id = Column(Integer, ForeignKey('dispatches.id'), nullable=False)
    level = Column(Integer, default=1)
    escalated_at = Column(DateTime, nullable=False)
    escalated_to = Column(String(255), nullable=False)
    escalated_to_id = Column(Integer, nullable=True)
    reason = Column(Text, nullable=False)
    action_taken = Column(Text, nullable=True)
    resolved = Column(Integer, default=0)
    resolved_at = Column(DateTime, nullable=True)

    dispatch = relationship("Dispatch", back_populates="escalations")
