from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from database import Base
from datetime import datetime


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    action = Column(String(50), nullable=False)
    entity_type = Column(String(50))
    entity_id = Column(Integer)
    
    flight_number = Column(String(20), index=True)
    
    user_name = Column(String(100))
    user_role = Column(String(50))
    
    details = Column(Text)
    
    before_data = Column(Text)
    after_data = Column(Text)
    
    ip_address = Column(String(50))
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        return {
            "id": self.id,
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "flight_number": self.flight_number,
            "user_name": self.user_name,
            "user_role": self.user_role,
            "details": self.details,
            "before_data": self.before_data,
            "after_data": self.after_data,
            "ip_address": self.ip_address,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
