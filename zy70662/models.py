from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class AgeGroup(Base):
    __tablename__ = "age_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String)
    min_age = Column(Integer)
    max_age = Column(Integer)

    participants = relationship("Participant", back_populates="age_group")


class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, index=True)
    bib_number = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    age = Column(Integer)
    age_group_id = Column(Integer, ForeignKey("age_groups.id"))

    age_group = relationship("AgeGroup", back_populates="participants")
    time_records = relationship("TimeRecord", back_populates="participant")
    penalties = relationship("Penalty", back_populates="participant")
    scores = relationship("Score", back_populates="participant")


class TimeRecord(Base):
    __tablename__ = "time_records"

    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(Integer, ForeignKey("participants.id"), nullable=False)
    checkpoint = Column(String, nullable=False)
    time_seconds = Column(Float, nullable=False)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())
    is_valid = Column(Boolean, default=True)
    notes = Column(Text)

    participant = relationship("Participant", back_populates="time_records")


class Penalty(Base):
    __tablename__ = "penalties"

    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(Integer, ForeignKey("participants.id"), nullable=False)
    penalty_type = Column(String, nullable=False)
    time_penalty_seconds = Column(Float, default=0.0)
    rank_penalty = Column(Integer, default=0)
    description = Column(Text)
    applied = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    participant = relationship("Participant", back_populates="penalties")


class Appeal(Base):
    __tablename__ = "appeals"

    id = Column(Integer, primary_key=True, index=True)
    appeal_number = Column(String, unique=True, index=True, nullable=False)
    participant_id = Column(Integer, ForeignKey("participants.id"), nullable=False)
    status = Column(String, default="pending")
    reason = Column(Text, nullable=False)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True))
    reviewer = Column(String)
    decision = Column(String)
    decision_notes = Column(Text)

    participant = relationship("Participant")
    review_reports = relationship("ReviewReport", back_populates="appeal")


class Score(Base):
    __tablename__ = "scores"

    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(Integer, ForeignKey("participants.id"), nullable=False)
    raw_time_seconds = Column(Float, nullable=False)
    penalty_time_seconds = Column(Float, default=0.0)
    final_time_seconds = Column(Float, nullable=False)
    overall_rank = Column(Integer)
    group_rank = Column(Integer)
    age_group_id = Column(Integer, ForeignKey("age_groups.id"))
    is_verified = Column(Boolean, default=False)
    has_appeal = Column(Boolean, default=False)
    last_updated = Column(DateTime(timezone=True), onupdate=func.now())

    participant = relationship("Participant", back_populates="scores")


class ReviewReport(Base):
    __tablename__ = "review_reports"

    id = Column(Integer, primary_key=True, index=True)
    appeal_id = Column(Integer, ForeignKey("appeals.id"), nullable=False)
    report_content = Column(Text, nullable=False)
    generated_by = Column(String)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    export_format = Column(String, default="json")

    appeal = relationship("Appeal", back_populates="review_reports")
