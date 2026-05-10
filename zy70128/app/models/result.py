from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class ResultVersion(BaseModel):
    """成绩版本管理"""

    __tablename__ = "result_versions"

    race_id = Column(Integer, ForeignKey("races.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False, default=1)
    is_latest = Column(Boolean, default=True, nullable=False)
    is_public = Column(Boolean, default=False, nullable=False)
    published_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(String(100), nullable=True)

    race = relationship("Race", back_populates="result_versions")
    records = relationship("ResultRecord", back_populates="version", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="result_version")


class ResultRecord(BaseModel):
    """成绩记录（每条比赛记录）"""

    __tablename__ = "result_records"

    version_id = Column(Integer, ForeignKey("result_versions.id"), nullable=False, index=True)
    athlete_id = Column(String(50), nullable=False, index=True)
    athlete_name = Column(String(100), nullable=False)
    bib_number = Column(String(20), nullable=True, index=True)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    rank = Column(Integer, nullable=True)
    category = Column(String(50), nullable=True)
    status = Column(String(20), nullable=False, default="FINISHED")  # FINISHED, DNF, DQ, etc.
    source = Column(String(50), nullable=True)  # CHIP, REFEREE, MANUAL, etc.

    version = relationship("ResultVersion", back_populates="records")
