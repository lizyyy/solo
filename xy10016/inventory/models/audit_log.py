from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime
from .base import Base


class AuditLog(Base):
    __tablename__ = 'audit_log'

    action = Column(String(50), nullable=False)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(String(100))
    user_id = Column(String(50))
    username = Column(String(50))
    ip_address = Column(String(50))
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    old_value = Column(Text)
    new_value = Column(Text)
    status = Column(String(20), default='success')
    error_message = Column(Text)
    correlation_id = Column(String(100))

    def __repr__(self):
        return f'<AuditLog {self.action} {self.resource_type} at {self.timestamp}>'
