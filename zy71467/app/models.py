import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Enum, ForeignKey, JSON
from sqlalchemy.orm import relationship

from .database import Base


class QuestionType(str, enum.Enum):
    INTERVAL = "interval"
    CHORD = "chord"
    KEY_SIGNATURE = "key_signature"


class RiskType(str, enum.Enum):
    ENHARMONIC_MISJUDGE = "enharmonic_misjudge"
    PARTIAL_SCORE_MISS = "partial_score_miss"
    QUESTION_TYPE_MISMATCH = "question_type_mismatch"


class GradingStatus(str, enum.Enum):
    SUCCESS = "success"
    NEEDS_REVIEW = "needs_review"
    FAILED = "failed"


class AnswerRecord(Base):
    __tablename__ = "answer_records"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, index=True)
    question_id = Column(String, index=True)
    question_type = Column(Enum(QuestionType), index=True)
    student_answer = Column(JSON, nullable=False)
    standard_answer = Column(JSON, nullable=False)
    full_score = Column(Float, default=10.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    grading_results = relationship("GradingResult", back_populates="answer_record")


class GradingResult(Base):
    __tablename__ = "grading_results"

    id = Column(Integer, primary_key=True, index=True)
    answer_record_id = Column(Integer, ForeignKey("answer_records.id"))
    score = Column(Float, nullable=False)
    is_correct = Column(Integer, default=0)
    status = Column(Enum(GradingStatus), default=GradingStatus.SUCCESS)
    partial_scores = Column(JSON)
    error_explanations = Column(JSON)
    risk_flags = Column(JSON)
    rule_version = Column(String, default="1.0.0")
    needs_manual_review = Column(Integer, default=0)
    review_reason = Column(Text, nullable=True)
    graded_at = Column(DateTime, default=datetime.utcnow)

    answer_record = relationship("AnswerRecord", back_populates="grading_results")
