import datetime
from sqlalchemy import String, Text, Integer, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ReviewRecord(Base):
    __tablename__ = "review_records"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    detection_id: Mapped[int] = mapped_column(Integer, ForeignKey("detection_history.id"), nullable=False, index=True)
    hit_record_id: Mapped[int] = mapped_column(Integer, ForeignKey("hit_records.id"), nullable=True)
    
    review_type: Mapped[str] = mapped_column(String(20), nullable=False)
    
    review_result: Mapped[str] = mapped_column(String(20), nullable=False)
    
    reviewer: Mapped[str] = mapped_column(String(100), nullable=True)
    
    comment: Mapped[str] = mapped_column(Text, nullable=True)
    
    action_taken: Mapped[str] = mapped_column(String(50), nullable=True)
    
    added_to_whitelist: Mapped[bool] = mapped_column(Boolean, default=False)
    whitelist_term: Mapped[str] = mapped_column(String(255), nullable=True)
    
    added_to_sensitive_words: Mapped[bool] = mapped_column(Boolean, default=False)
    sensitive_word: Mapped[str] = mapped_column(String(255), nullable=True)
    
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
    
    detection = relationship("DetectionHistory", back_populates="reviews")
    
    __table_args__ = (
        Index("idx_review_detection", "detection_id"),
        Index("idx_review_result", "review_result"),
        Index("idx_review_created", "created_at"),
    )
