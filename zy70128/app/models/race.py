from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class Race(BaseModel):
    """赛事信息"""

    __tablename__ = "races"

    name = Column(String(255), nullable=False, index=True)
    description = Column(String(500), nullable=True)
    race_date = Column(DateTime, nullable=False)
    is_published = Column(Boolean, default=False, nullable=False)

    result_versions = relationship("ResultVersion", back_populates="race", cascade="all, delete-orphan")
    chip_batches = relationship("ChipBatch", back_populates="race", cascade="all, delete-orphan")
    appeals = relationship("Appeal", back_populates="race", cascade="all, delete-orphan")
