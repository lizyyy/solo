from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///data/admission.db")
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class SampleList(Base):
    __tablename__ = "sample_list"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String(50), index=True, nullable=False)
    student_name = Column(String(100))
    score = Column(Float)
    raw_score = Column(String(100))
    rank = Column(Integer)
    volunteer_1 = Column(String(200))
    volunteer_2 = Column(String(200))
    volunteer_3 = Column(String(200))
    remark = Column(Text)
    source_file = Column(String(200))
    import_batch = Column(String(100), index=True)
    is_negative = Column(Boolean, default=False)
    is_missing = Column(Boolean, default=False)
    needs_review = Column(Boolean, default=False)
    review_status = Column(String(50), default="pending")
    reviewer = Column(String(100))
    review_time = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    comments = relationship("TeacherComment", back_populates="sample")
    admission = relationship("AdmissionRecord", back_populates="sample", uselist=False)


class TeacherComment(Base):
    __tablename__ = "teacher_comment"

    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(Integer, ForeignKey("sample_list.id"))
    teacher_name = Column(String(100))
    comment = Column(Text, nullable=False)
    comment_type = Column(String(50))
    import_batch = Column(String(100), index=True)
    version = Column(Integer, default=1)
    is_latest = Column(Boolean, default=True)
    previous_version_id = Column(Integer, ForeignKey("teacher_comment.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(100))

    sample = relationship("SampleList", back_populates="comments")
    previous_version = relationship("TeacherComment", remote_side=[id])


class AdmissionRecord(Base):
    __tablename__ = "admission_record"

    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(Integer, ForeignKey("sample_list.id"), unique=True)
    matched_volunteer = Column(Integer)
    matched_major = Column(String(200))
    match_score = Column(Float)
    is_borderline = Column(Boolean, default=False)
    borderline_reason = Column(String(500))
    admission_status = Column(String(50), default="provisional")
    review_note = Column(Text)
    reviewed_by = Column(String(100))
    reviewed_at = Column(DateTime)
    batch_id = Column(String(100), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sample = relationship("SampleList", back_populates="admission")
    version_history = relationship("AdmissionVersion", back_populates="admission")


class AdmissionVersion(Base):
    __tablename__ = "admission_version"

    id = Column(Integer, primary_key=True, index=True)
    admission_id = Column(Integer, ForeignKey("admission_record.id"))
    version = Column(Integer)
    matched_volunteer = Column(Integer)
    matched_major = Column(String(200))
    admission_status = Column(String(50))
    change_reason = Column(String(500))
    changed_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

    admission = relationship("AdmissionRecord", back_populates="version_history")


class ImportBatch(Base):
    __tablename__ = "import_batch"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(100), unique=True, index=True)
    batch_type = Column(String(50))
    file_name = Column(String(200))
    total_records = Column(Integer, default=0)
    new_records = Column(Integer, default=0)
    updated_records = Column(Integer, default=0)
    duplicate_records = Column(Integer, default=0)
    imported_by = Column(String(100))
    import_note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class BorderlineCase(Base):
    __tablename__ = "borderline_case"

    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(Integer, ForeignKey("sample_list.id"))
    case_type = Column(String(50))
    description = Column(String(500))
    original_value = Column(String(200))
    suggested_value = Column(String(200))
    status = Column(String(50), default="pending")
    assigned_to = Column(String(100), default="student_assistant")
    resolution = Column(Text)
    resolved_at = Column(DateTime)
    resolved_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

    sample = relationship("SampleList")


class WorkflowStep(Base):
    __tablename__ = "workflow_step"

    id = Column(Integer, primary_key=True, index=True)
    step_name = Column(String(100))
    step_order = Column(Integer)
    status = Column(String(50), default="pending")
    batch_id = Column(String(100), index=True)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    operator = Column(String(100))
    note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    os.makedirs(os.path.dirname(DATABASE_URL.replace("sqlite:///", "")), exist_ok=True)
    Base.metadata.create_all(bind=engine)
