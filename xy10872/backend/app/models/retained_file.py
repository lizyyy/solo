from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class RetainedFile(Base):
    __tablename__ = "retained_files"

    id = Column(Integer, primary_key=True, index=True)
    reset_request_id = Column(Integer, ForeignKey("reset_requests.id"))
    file_path = Column(String)
    reason = Column(String)
    is_submission = Column(Boolean, default=False)
    retained_path = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    reset_request = relationship("ResetRequest", back_populates="retained_files")