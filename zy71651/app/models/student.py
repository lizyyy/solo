from sqlalchemy import Column, String
from sqlalchemy.orm import relationship

from .base import BaseModel


class Student(BaseModel):
    student_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    class_name = Column(String(100))
    contact = Column(String(100))
    notes = Column(String(500))

    tasks = relationship("EstimationTask", back_populates="student")
