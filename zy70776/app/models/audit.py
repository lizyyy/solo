from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    checklist_id = Column(Integer, ForeignKey("release_checklists.id"), nullable=False)
    action = Column(String, nullable=False)
    operator = Column(String, nullable=False)
    original_data = Column(Text)
    conclusion = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    checklist = relationship("ReleaseChecklist", back_populates="audit_logs")
