content = '''from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .database import Base


class BatteryStatus(str, enum.Enum):
    NORMAL = "normal"
    ABNORMAL_TEMPERATURE = "abnormal_temperature"
    DISABLED = "disabled"
    PENDING_REVIEW = "pending_review"
    REVIEWED = "reviewed"
    RESOLVED = "resolved"
    RELEASED = "released"


class SlotStatus(str, enum.Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    DISABLED = "disabled"
    UNDER_INSPECTION = "under_inspection"


class AbnormalType(str, enum.Enum):
    OVER_TEMPERATURE = "over_temperature"
    TEMPERATURE_GAP = "temperature_gap"
    RAPID_RISE = "rapid_rise"
    DISABLED_SLOT = "disabled_slot"
    MANUAL_RELEASE = "manual_release"


class ReviewConclusion(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED_ABNORMAL = "confirmed_abnormal"
    FALSE_ALARM = "false_alarm"
    NEEDS_FURTHER_CHECK = "needs_further_check"


class BatteryRecord(Base):
    __tablename__ = "battery_records"

    id = Column(Integer, primary_key=True, index=True)
    battery_id = Column(String, index=True, nullable=False)
    business_no = Column(String, index=True, unique=True, nullable=False)
    slot_no = Column(String, nullable=False)
    entry_time = Column(DateTime, nullable=False)
    exit_time = Column(DateTime)
    status = Column(Enum(BatteryStatus), default=BatteryStatus.NORMAL)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    temperature_samples = relationship("TemperatureSample", back_populates="battery_record")
    disable_records = relationship("DisableRecord", back_populates="battery_record")
    reviews = relationship("ReviewRecord", back_populates="battery_record")
    abnormal_events = relationship("AbnormalEvent", back_populates="battery_record")
    disposition_report = relationship("DispositionReport", back_populates="battery_record", uselist=False)
    operation_traces = relationship("OperationTrace", back_populates="battery_record")
'''

with open('/Users/lzy/pro/solo/workspaces/zy71003/app/models_part1.py', 'w') as f:
    f.write(content)
print("part1 done")
