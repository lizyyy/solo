from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
from models.enums import ReviewStatus


class ReviewRecord(Base):
    __tablename__ = "review_records"

    id = Column(String, primary_key=True, index=True)
    sample_id = Column(String, ForeignKey("food_samples.id"), index=True)
    temperature_record_id = Column(String, ForeignKey("temperature_records.id"), index=True)
    waste_record_id = Column(String, ForeignKey("waste_records.id"), index=True)

    reviewer_id = Column(String, index=True)
    reviewer_name = Column(String)
    review_status = Column(String, default=ReviewStatus.UNREVIEWED, index=True)
    review_result = Column(String)
    review_notes = Column(Text)
    review_time = Column(DateTime)

    reviewer_id_2 = Column(String)
    reviewer_name_2 = Column(String)
    review_time_2 = Column(DateTime)
    review_notes_2 = Column(Text)

    appeal_reason = Column(Text)
    appeal_time = Column(DateTime)
    appeal_result = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sample = relationship("FoodSample", back_populates="reviews")
    temperature_record = relationship("TemperatureRecord", back_populates="reviews")
    waste_record = relationship("WasteRecord", back_populates="reviews")

    @property
    def record_type(self) -> str:
        if self.sample_id:
            return "sample"
        if self.temperature_record_id:
            return "temperature"
        if self.waste_record_id:
            return "waste"
        return "unknown"

    def to_dict(self):
        return {
            "id": self.id,
            "sample_id": self.sample_id,
            "temperature_record_id": self.temperature_record_id,
            "waste_record_id": self.waste_record_id,
            "record_type": self.record_type,
            "reviewer_id": self.reviewer_id,
            "reviewer_name": self.reviewer_name,
            "review_status": self.review_status,
            "review_result": self.review_result,
            "review_notes": self.review_notes,
            "review_time": self.review_time.isoformat() if self.review_time else None,
            "appeal_reason": self.appeal_reason,
            "appeal_time": self.appeal_time.isoformat() if self.appeal_time else None,
            "appeal_result": self.appeal_result
        }
