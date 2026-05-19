from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.sql import func
from app.core.database import Base


class OperationHistory(Base):
    __tablename__ = "operation_history"

    id = Column(Integer, primary_key=True, index=True)
    
    operation_type = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(100), index=True)
    entity_id = Column(Integer)
    
    operator = Column(String(100))
    operation_time = Column(DateTime(timezone=True), server_default=func.now())
    
    before_data = Column(JSON)
    after_data = Column(JSON)
    
    changes = Column(JSON)
    
    ip_address = Column(String(50))
    user_agent = Column(String(500))
    
    notes = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
