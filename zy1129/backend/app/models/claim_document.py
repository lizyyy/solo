from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, Date, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class ClaimDocument(Base):
    __tablename__ = "claim_documents"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id"), nullable=False)
    document_type = Column(String(50), nullable=False)
    document_name = Column(String(200), nullable=False)
    file_path = Column(String(500), nullable=True)
    is_submitted = Column(Boolean, default=False)
    submitted_date = Column(Date, nullable=True)
    is_required = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
