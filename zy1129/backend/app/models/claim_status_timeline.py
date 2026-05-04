from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class ClaimStatusTimeline(Base):
    __tablename__ = "claim_status_timeline"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id"), nullable=False)
    status = Column(String(20), nullable=False)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())
    description = Column(Text, nullable=True)
    operator = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
