from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
import enum


class ChangeType(str, enum.Enum):
    ADD = "add"
    MODIFY = "modify"
    DELETE = "delete"


class StudentChange(Base):
    __tablename__ = "student_changes"

    id = Column(Integer, primary_key=True, index=True)
    lab_space_id = Column(Integer, ForeignKey("lab_spaces.id"))
    file_path = Column(String)
    change_type = Column(Enum(ChangeType))
    change_time = Column(DateTime, default=datetime.utcnow)
    is_submission = Column(Boolean, default=False)
    description = Column(String)

    lab_space = relationship("LabSpace", back_populates="changes")