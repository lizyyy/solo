from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
from models.enums import ExceptionType


class RuleResult(Base):
    __tablename__ = "rule_results"

    id = Column(String, primary_key=True, index=True)
    rule_name = Column(String, nullable=False, index=True)
    rule_code = Column(String, index=True)
    exception_type = Column(String, nullable=False, index=True)
    is_blocked = Column(Boolean, default=False, index=True)
    reason = Column(Text, nullable=False)
    details = Column(Text)
    severity = Column(String, default="medium")

    sample_id = Column(String, ForeignKey("food_samples.id"), index=True)
    temperature_record_id = Column(String, ForeignKey("temperature_records.id"), index=True)
    waste_record_id = Column(String, ForeignKey("waste_records.id"), index=True)

    applied_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    sample = relationship("FoodSample", back_populates="rule_results")
    temperature_record = relationship("TemperatureRecord", back_populates="rule_results")
    waste_record = relationship("WasteRecord", back_populates="rule_results")

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
            "rule_name": self.rule_name,
            "rule_code": self.rule_code,
            "exception_type": self.exception_type,
            "is_blocked": self.is_blocked,
            "reason": self.reason,
            "details": self.details,
            "severity": self.severity,
            "sample_id": self.sample_id,
            "temperature_record_id": self.temperature_record_id,
            "waste_record_id": self.waste_record_id,
            "record_type": self.record_type,
            "applied_at": self.applied_at.isoformat() if self.applied_at else None
        }
