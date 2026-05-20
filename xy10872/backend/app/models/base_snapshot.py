from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class BaseSnapshot(Base):
    __tablename__ = "base_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    lab_space_id = Column(Integer, ForeignKey("lab_spaces.id"))
    name = Column(String)
    description = Column(String)
    path = Column(String)
    is_base = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String)

    lab_space = relationship("LabSpace", back_populates="snapshots")
    reset_requests = relationship("ResetRequest", back_populates="snapshot")