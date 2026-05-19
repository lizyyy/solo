from sqlalchemy import Column, String, Integer, Text, DateTime
from app.models.base import BaseModel


class AuditLog(BaseModel):
    __tablename__ = "audit_logs"

    action = Column(String(100), nullable=False)
    entity_type = Column(String(50))
    entity_id = Column(Integer)
    
    user = Column(String(100))
    ip_address = Column(String(50))
    
    description = Column(Text)
    changes = Column(Text)
    
    old_value = Column(Text)
    new_value = Column(Text)
    
    source = Column(String(100))
