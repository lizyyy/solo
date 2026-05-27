from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.models.database import Base


class BatchSubmission(Base):
    __tablename__ = "batch_submissions"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(64), unique=True, index=True, nullable=False)
    quality_csv_hash = Column(String(64))
    audio_json_hash = Column(String(64))
    appeal_csv_hash = Column(String(64))
    submitted_at = Column(DateTime, default=datetime.utcnow)
    is_processed = Column(Boolean, default=False)
    total_records = Column(Integer, default=0)
    normal_count = Column(Integer, default=0)
    pending_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)

    records = relationship("QualityRecord", back_populates="batch")


class QualityRecord(Base):
    __tablename__ = "quality_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(64), ForeignKey("batch_submissions.batch_id"))
    record_type = Column(String(20), nullable=False)
    error_type = Column(String(50))
    agent_id = Column(String(50))
    agent_name = Column(String(100))
    call_id = Column(String(100))
    score_original = Column(Float)
    score_after_appeal = Column(Float)
    score_final = Column(Float)
    deduction_reason = Column(Text)
    appeal_reason = Column(Text)
    review_status = Column(String(30), default="pending")
    is_deduction_revoked = Column(Boolean, default=False)
    needs_second_review = Column(Boolean, default=False)
    raw_data = Column(Text)
    suggestion = Column(Text)
    error_message = Column(Text)
    data_source = Column(String(20), default="quality")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    batch = relationship("BatchSubmission", back_populates="records")
