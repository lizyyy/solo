from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text
from app.core.database import Base


class AuditLog(Base):
    """审计日志"""
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    log_code = Column(String(50), unique=True, index=True, nullable=False)
    
    action = Column(String(100), nullable=False)
    action_type = Column(String(50), nullable=True)
    
    user_id = Column(String(50), nullable=True)
    user_name = Column(String(100), nullable=True)
    
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(Integer, nullable=True)
    resource_code = Column(String(100), nullable=True)
    
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    
    details = Column(Text, nullable=True)
    
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    
    is_success = Column(String(20), default="success")
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.now, index=True)
