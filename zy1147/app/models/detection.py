import datetime
import json
from sqlalchemy import String, Text, Integer, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class DetectionHistory(Base):
    __tablename__ = "detection_history"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    request_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    
    original_text: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_text: Mapped[str] = mapped_column(Text, nullable=True)
    
    segments_json: Mapped[str] = mapped_column(Text, nullable=True)
    
    is_sensitive: Mapped[bool] = mapped_column(Boolean, default=False)
    highest_severity: Mapped[str] = mapped_column(String(20), nullable=True)
    
    total_hits: Mapped[int] = mapped_column(Integer, default=0)
    
    processing_time_ms: Mapped[int] = mapped_column(Integer, nullable=True)
    
    client_ip: Mapped[str] = mapped_column(String(50), nullable=True)
    user_agent: Mapped[str] = mapped_column(String(255), nullable=True)
    
    review_status: Mapped[str] = mapped_column(String(20), default="pending")
    reviewed_by: Mapped[str] = mapped_column(String(100), nullable=True)
    reviewed_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=True)
    
    lexicon_version: Mapped[str] = mapped_column(String(50), nullable=True)
    
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False, index=True
    )
    
    hits = relationship("HitRecord", back_populates="detection", cascade="all, delete-orphan")
    reviews = relationship("ReviewRecord", back_populates="detection", cascade="all, delete-orphan")
    
    @property
    def segments(self):
        if self.segments_json:
            return json.loads(self.segments_json)
        return []
    
    @segments.setter
    def segments(self, value):
        self.segments_json = json.dumps(value, ensure_ascii=False)
    
    __table_args__ = (
        Index("idx_detection_created", "created_at"),
        Index("idx_detection_review", "review_status"),
        Index("idx_detection_sensitive", "is_sensitive"),
    )


class HitRecord(Base):
    __tablename__ = "hit_records"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    detection_id: Mapped[int] = mapped_column(Integer, ForeignKey("detection_history.id"), nullable=False, index=True)
    
    sensitive_word_id: Mapped[int] = mapped_column(Integer, ForeignKey("sensitive_words.id"), nullable=True)
    
    hit_word: Mapped[str] = mapped_column(String(255), nullable=False)
    matched_word: Mapped[str] = mapped_column(String(255), nullable=True)
    
    start_position: Mapped[int] = mapped_column(Integer, nullable=False)
    end_position: Mapped[int] = mapped_column(Integer, nullable=False)
    
    match_type: Mapped[str] = mapped_column(String(50), nullable=False)
    
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    
    description: Mapped[str] = mapped_column(Text, nullable=True)
    suggestion: Mapped[str] = mapped_column(String(255), nullable=True)
    
    context_before: Mapped[str] = mapped_column(String(500), nullable=True)
    context_after: Mapped[str] = mapped_column(String(500), nullable=True)
    
    is_false_positive: Mapped[bool] = mapped_column(Boolean, default=False)
    false_positive_reason: Mapped[str] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
    
    detection = relationship("DetectionHistory", back_populates="hits")
    
    __table_args__ = (
        Index("idx_hit_detection", "detection_id"),
        Index("idx_hit_severity", "severity"),
    )
