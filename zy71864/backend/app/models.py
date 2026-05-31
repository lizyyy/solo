from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON, Float
from sqlalchemy.orm import relationship

from app.database import Base


class QuestionBank(Base):
    __tablename__ = "question_bank"

    id = Column(Integer, primary_key=True, index=True)
    question_no = Column(String(50), index=True, nullable=False)
    content = Column(Text, nullable=False)
    standard_answer = Column(Text, nullable=False)
    recurrence_formula = Column(String(200))
    version = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    created_by = Column(String(100))
    is_active = Column(Boolean, default=True, nullable=False)
    parent_id = Column(Integer, ForeignKey("question_bank.id"), nullable=True)

    parent = relationship("QuestionBank", remote_side=[id], backref="versions")
    equivalent_answers = relationship("EquivalentAnswer", back_populates="question")
    diagnosis_results = relationship("DiagnosisResult", back_populates="question")


class EquivalentAnswer(Base):
    __tablename__ = "equivalent_answer"

    id = Column(Integer, primary_key=True, index=True)
    question_bank_id = Column(Integer, ForeignKey("question_bank.id"), nullable=False)
    answer_expression = Column(Text, nullable=False)
    description = Column(String(500))
    created_at = Column(DateTime, default=datetime.now, nullable=False)

    question = relationship("QuestionBank", back_populates="equivalent_answers")


class EvaluationRecord(Base):
    __tablename__ = "evaluation_record"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String(50), index=True, nullable=False)
    student_name = Column(String(100), nullable=False)
    question_no = Column(String(50), index=True, nullable=False)
    student_answer = Column(Text, nullable=False)
    score = Column(Float)
    evaluation_time = Column(DateTime, default=datetime.now, nullable=False)
    batch_id = Column(String(100), index=True)
    remark = Column(Text)

    diagnosis_results = relationship("DiagnosisResult", back_populates="evaluation_record")


class FilterCondition(Base):
    __tablename__ = "filter_condition"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), index=True, nullable=False)
    condition_name = Column(String(200))
    condition_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    is_current = Column(Boolean, default=False, nullable=False)

    batches = relationship("DiagnosisBatch", back_populates="filter_condition")


class DiagnosisBatch(Base):
    __tablename__ = "diagnosis_batch"

    id = Column(Integer, primary_key=True, index=True)
    batch_hash = Column(String(64), unique=True, index=True, nullable=False)
    batch_name = Column(String(200), nullable=False)
    material_count = Column(Integer, default=0)
    status = Column(String(50), default="pending", nullable=False)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    completed_at = Column(DateTime)
    filter_condition_id = Column(Integer, ForeignKey("filter_condition.id"))

    filter_condition = relationship("FilterCondition", back_populates="batches")
    results = relationship("DiagnosisResult", back_populates="batch")


class DiagnosisResult(Base):
    __tablename__ = "diagnosis_result"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("diagnosis_batch.id"), nullable=False)
    question_bank_id = Column(Integer, ForeignKey("question_bank.id"))
    evaluation_record_id = Column(Integer, ForeignKey("evaluation_record.id"), nullable=False)
    diagnosis_type = Column(String(50), nullable=False)
    is_correct = Column(Boolean, default=False, nullable=False)
    is_equivalent = Column(Boolean, default=False, nullable=False)
    matched_equivalent_id = Column(Integer, ForeignKey("equivalent_answer.id"))
    error_type = Column(String(100))
    human_readable_error = Column(Text)
    suggestion = Column(Text)
    next_action = Column(String(200))
    contact_person = Column(String(100))
    created_at = Column(DateTime, default=datetime.now, nullable=False)

    batch = relationship("DiagnosisBatch", back_populates="results")
    question = relationship("QuestionBank", back_populates="diagnosis_results")
    evaluation_record = relationship("EvaluationRecord", back_populates="diagnosis_results")
    matched_equivalent = relationship("EquivalentAnswer")
