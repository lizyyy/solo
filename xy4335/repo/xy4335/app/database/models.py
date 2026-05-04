from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean
from sqlalchemy.orm import relationship

from app.database.connection import Base


class CallRecord(Base):
    __tablename__ = "call_records"

    id = Column(Integer, primary_key=True, index=True)
    call_id = Column(String(100), unique=True, index=True, nullable=False)
    caller_id = Column(String(100), index=True, nullable=False)
    call_time = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, default=0)
    summary_text = Column(Text, nullable=True)
    initial_risk_level = Column(String(20), default="green")
    operator_id = Column(String(100), nullable=True)
    operator_name = Column(String(100), nullable=True)
    has_referral = Column(Boolean, default=False)
    referral_to = Column(String(200), nullable=True)
    referral_time = Column(DateTime, nullable=True)
    import_time = Column(DateTime, default=datetime.now)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    risk_assessments = relationship("RiskAssessment", back_populates="call_record")
    follow_ups = relationship("FollowUp", back_populates="call_record")
    supervisor_notes = relationship("SupervisorNote", back_populates="call_record")

    def get_latest_assessment(self):
        if self.risk_assessments:
            return sorted(self.risk_assessments, key=lambda x: x.assessment_time, reverse=True)[0]
        return None

    def get_current_risk_level(self):
        latest = self.get_latest_assessment()
        if latest:
            return latest.risk_level
        return self.initial_risk_level


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(String(100), unique=True, index=True, nullable=False)
    date = Column(DateTime, nullable=False)
    operator_id = Column(String(100), index=True, nullable=False)
    operator_name = Column(String(100), nullable=True)
    shift_start = Column(DateTime, nullable=True)
    shift_end = Column(DateTime, nullable=True)
    role = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    import_time = Column(DateTime, default=datetime.now)
    created_at = Column(DateTime, default=datetime.now)


class FollowUp(Base):
    __tablename__ = "follow_ups"

    id = Column(Integer, primary_key=True, index=True)
    follow_up_id = Column(String(100), unique=True, index=True, nullable=False)
    call_record_id = Column(Integer, ForeignKey("call_records.id"), nullable=False)
    scheduled_time = Column(DateTime, nullable=True)
    actual_time = Column(DateTime, nullable=True)
    operator_id = Column(String(100), nullable=True)
    operator_name = Column(String(100), nullable=True)
    content = Column(Text, nullable=True)
    result = Column(String(50), nullable=True)
    is_completed = Column(Boolean, default=False)
    missed_reason = Column(String(200), nullable=True)
    import_time = Column(DateTime, default=datetime.now)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    call_record = relationship("CallRecord", back_populates="follow_ups")


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(Integer, primary_key=True, index=True)
    call_record_id = Column(Integer, ForeignKey("call_records.id"), nullable=False)
    assessment_time = Column(DateTime, default=datetime.now)
    risk_level = Column(String(20), nullable=False)
    risk_score = Column(Float, default=0.0)
    assessed_by = Column(String(100), nullable=True)
    flags = Column(Text, nullable=True)
    reasons = Column(Text, nullable=True)
    is_system_generated = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    call_record = relationship("CallRecord", back_populates="risk_assessments")

    def get_flags_list(self) -> List[str]:
        if self.flags:
            import json
            try:
                return json.loads(self.flags)
            except:
                return [f.strip() for f in self.flags.split(",")]
        return []

    def set_flags_list(self, flags: List[str]):
        import json
        self.flags = json.dumps(flags, ensure_ascii=False)


class SupervisorNote(Base):
    __tablename__ = "supervisor_notes"

    id = Column(Integer, primary_key=True, index=True)
    call_record_id = Column(Integer, ForeignKey("call_records.id"), nullable=False)
    note_text = Column(Text, nullable=False)
    supervisor_id = Column(String(100), nullable=True)
    supervisor_name = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    call_record = relationship("CallRecord", back_populates="supervisor_notes")
