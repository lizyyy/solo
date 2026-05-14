from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True)
    description = Column(Text, nullable=True)
    path = Column(String(255), index=True)
    method = Column(String(20), default="GET")
    status = Column(String(50), default="active")
    delay_ms = Column(Integer, default=0)
    response_template = Column(JSON, default={})
    scenario_params = Column(JSON, default={})
    share_token = Column(String(100), unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    approvals = relationship("Approval", back_populates="scenario")
    timeline = relationship("Timeline", back_populates="scenario")

class Approval(Base):
    __tablename__ = "approvals"

    id = Column(Integer, primary_key=True, index=True)
    scenario_id = Column(Integer, ForeignKey("scenarios.id"))
    approver = Column(String(255))
    action = Column(String(50))
    comment = Column(Text, nullable=True)
    old_params = Column(JSON, nullable=True)
    new_params = Column(JSON, nullable=True)
    old_response = Column(JSON, nullable=True)
    new_response = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    scenario = relationship("Scenario", back_populates="approvals")

class Timeline(Base):
    __tablename__ = "timeline"

    id = Column(Integer, primary_key=True, index=True)
    scenario_id = Column(Integer, ForeignKey("scenarios.id"))
    action = Column(String(100))
    actor = Column(String(255))
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    scenario = relationship("Scenario", back_populates="timeline")

class MockLog(Base):
    __tablename__ = "mock_logs"

    id = Column(Integer, primary_key=True, index=True)
    scenario_id = Column(Integer, ForeignKey("scenarios.id"), nullable=True)
    path = Column(String(255))
    method = Column(String(20))
    request_headers = Column(JSON, nullable=True)
    request_body = Column(JSON, nullable=True)
    response_status = Column(String(50))
    response_data = Column(JSON, nullable=True)
    delay_ms = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)