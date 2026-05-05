from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class OptimizationAction(Base):
    __tablename__ = "optimization_actions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    related_batch_id = Column(Integer, ForeignKey("load_test_batches.id"), nullable=True, index=True)
    
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    
    action_type = Column(String(50), nullable=False)
    priority = Column(String(20), default="medium")
    
    status = Column(String(50), default="pending")
    
    assigned_to = Column(String(255), nullable=True)
    
    proposed_solution = Column(Text, nullable=True)
    expected_improvement = Column(Text, nullable=True)
    
    root_cause_analysis = Column(Text, nullable=True)
    
    implemented_at = Column(DateTime, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    
    verification_batch_id = Column(Integer, ForeignKey("load_test_batches.id"), nullable=True)
    
    actual_improvement = Column(JSON, nullable=True)
    
    notes = Column(Text, nullable=True)
    attachments = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="optimization_actions")
