from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .database import Base


class SubmissionStatus(str, enum.Enum):
    PENDING = "pending"
    GRADING = "grading"
    GRADED = "graded"
    CALLBACK_PENDING = "callback_pending"
    CALLBACK_FAILED = "callback_failed"
    SUCCESS = "success"
    MANUAL_REVIEW = "manual_review"


class ExceptionType(str, enum.Enum):
    SIGNATURE_VERIFICATION_FAILED = "signature_verification_failed"
    NETWORK_ERROR = "network_error"
    GRADE_WRITE_FAILED = "grade_write_failed"
    INVALID_PAYLOAD = "invalid_payload"
    TIMEOUT = "timeout"
    UNKNOWN = "unknown"


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(String, unique=True, index=True)
    student_id = Column(String, index=True)
    assignment_id = Column(String, index=True)
    course_id = Column(String, index=True)
    submit_time = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(Enum(SubmissionStatus), default=SubmissionStatus.PENDING)
    final_score = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    grading_tasks = relationship("GradingTask", back_populates="submission")
    callback_payloads = relationship("CallbackPayload", back_populates="submission")
    exception_logs = relationship("ExceptionLog", back_populates="submission")
    retry_records = relationship("RetryRecord", back_populates="submission")


class GradingTask(Base):
    __tablename__ = "grading_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String, unique=True, index=True)
    submission_id = Column(String, ForeignKey("submissions.submission_id"))
    grader_type = Column(String)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    raw_score = Column(Float, nullable=True)
    grading_details = Column(Text, nullable=True)

    submission = relationship("Submission", back_populates="grading_tasks")


class CallbackPayload(Base):
    __tablename__ = "callback_payloads"

    id = Column(Integer, primary_key=True, index=True)
    payload_id = Column(String, unique=True, index=True)
    submission_id = Column(String, ForeignKey("submissions.submission_id"))
    raw_payload = Column(Text)
    signature = Column(String)
    received_at = Column(DateTime(timezone=True), server_default=func.now())
    is_signature_valid = Column(Integer, default=0)
    score = Column(Float, nullable=True)
    grade_written = Column(Integer, default=0)
    grade_written_at = Column(DateTime(timezone=True), nullable=True)

    submission = relationship("Submission", back_populates="callback_payloads")


class ExceptionLog(Base):
    __tablename__ = "exception_logs"

    id = Column(Integer, primary_key=True, index=True)
    exception_id = Column(String, unique=True, index=True)
    submission_id = Column(String, ForeignKey("submissions.submission_id"))
    exception_type = Column(Enum(ExceptionType))
    error_message = Column(Text)
    stack_trace = Column(Text, nullable=True)
    occurred_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved = Column(Integer, default=0)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(String, nullable=True)

    submission = relationship("Submission", back_populates="exception_logs")


class RetryRecord(Base):
    __tablename__ = "retry_records"

    id = Column(Integer, primary_key=True, index=True)
    retry_id = Column(String, unique=True, index=True)
    submission_id = Column(String, ForeignKey("submissions.submission_id"))
    retry_count = Column(Integer, default=1)
    retry_type = Column(String)
    previous_status = Column(String)
    new_status = Column(String)
    triggered_by = Column(String)
    triggered_at = Column(DateTime(timezone=True), server_default=func.now())
    success = Column(Integer, default=0)

    submission = relationship("Submission", back_populates="retry_records")
