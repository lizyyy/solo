from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class LabSpace(Base):
    __tablename__ = "lab_spaces"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    student_id = Column(String, index=True)
    student_name = Column(String)
    course_id = Column(String)
    path = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    snapshots = relationship("BaseSnapshot", back_populates="lab_space")
    reset_requests = relationship("ResetRequest", back_populates="lab_space")
    changes = relationship("StudentChange", back_populates="lab_space")