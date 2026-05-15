from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base


class MaterialStatus(str, enum.Enum):
    PENDING = "pending"
    EVALUATING = "evaluating"
    SUCCESS = "success"
    PARTIAL_SUCCESS = "partial_success"
    FAILED = "failed"
    NEEDS_REVIEW = "needs_review"
    CONFIRMED = "confirmed"


class EvaluationResult(str, enum.Enum):
    PASS = "pass"
    FAIL = "fail"
    PARTIAL_PASS = "partial_pass"
    NEEDS_MANUAL_REVIEW = "needs_manual_review"


class OperationType(str, enum.Enum):
    SUBMIT = "submit"
    EVALUATE = "evaluate"
    CORRECT = "correct"
    CONFIRM = "confirm"
    ROLLBACK = "rollback"
    DELETE = "delete"
    BATCH_DELETE = "batch_delete"


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, index=True, nullable=False)
    file_hash = Column(String, index=True, nullable=False)
    file_name = Column(String, nullable=False)
    file_summary = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    status = Column(String, default=MaterialStatus.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    evaluations = relationship("Evaluation", back_populates="material")
    corrections = relationship("Correction", back_populates="material")


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    result = Column(String, nullable=False)
    confidence = Column(Float, default=0.0)
    reasoning = Column(Text)
    failure_path = Column(String)
    failure_details = Column(Text)
    success_count = Column(Integer, default=0)
    total_count = Column(Integer, default=0)
    is_manual_confirmed = Column(Boolean, default=False)
    confirmed_by = Column(String)
    confirmed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    material = relationship("Material", back_populates="evaluations")


class Correction(Base):
    __tablename__ = "corrections"

    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    evaluation_id = Column(Integer, ForeignKey("evaluations.id"))
    operator = Column(String, nullable=False)
    original_result = Column(String)
    corrected_result = Column(String)
    remark = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    material = relationship("Material", back_populates="corrections")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String, nullable=False)
    operator = Column(String, default="system")
    target_ids = Column(Text)
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CandidateList(Base):
    __tablename__ = "candidate_lists"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String, nullable=False)
    name = Column(String, nullable=False)
    target_ids = Column(Text, nullable=False)
    created_by = Column(String, default="system")
    is_executed = Column(Boolean, default=False)
    executed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
