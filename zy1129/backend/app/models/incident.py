from sqlalchemy import Column, Integer, String, Date, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    incident_number = Column(String(50), unique=True, nullable=False)
    incident_type = Column(String(50), nullable=False)
    incident_date = Column(Date, nullable=False)
    report_date = Column(Date, nullable=True)
    affected_member_id = Column(Integer, ForeignKey("members.id"), nullable=True)
    description = Column(Text, nullable=False)
    location = Column(String(200), nullable=True)
    severity = Column(String(20), default="moderate")
    status = Column(String(20), default="pending")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    member = relationship("Member", backref="incidents")
    claims = relationship("Claim", backref="incident", cascade="all, delete-orphan")
