from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import hashlib
import json


class IdempotentRequest(Base):
    __tablename__ = "idempotent_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_hash = Column(String(64), unique=True, index=True, nullable=False)
    request_data = Column(JSON, nullable=False)
    response_data = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    submitted_by = Column(String(100), nullable=False)

    @staticmethod
    def generate_hash(data: dict) -> str:
        def datetime_converter(o):
            if hasattr(o, 'isoformat'):
                return o.isoformat()
            return str(o)
        
        sorted_data = json.dumps(data, sort_keys=True, ensure_ascii=False, default=datetime_converter)
        return hashlib.sha256(sorted_data.encode('utf-8')).hexdigest()


class LostItem(Base):
    __tablename__ = "lost_items"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("idempotent_requests.id"), nullable=True)
    item_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    lost_location = Column(String(200), nullable=False)
    lost_time = Column(DateTime(timezone=True), nullable=False)
    bus_route = Column(String(50))
    bus_number = Column(String(50))
    contact_name = Column(String(100), nullable=False)
    contact_phone = Column(String(20), nullable=False)
    status = Column(String(50), default="pending")
    match_result = Column(JSON)
    final_report = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(100), nullable=False)

    audit_logs = relationship("AuditLog", back_populates="lost_item")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    lost_item_id = Column(Integer, ForeignKey("lost_items.id"), nullable=False)
    field_changed = Column(String(100), nullable=False)
    old_value = Column(JSON)
    new_value = Column(JSON)
    change_reason = Column(Text, nullable=False)
    changed_by = Column(String(100), nullable=False)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())

    lost_item = relationship("LostItem", back_populates="audit_logs")
