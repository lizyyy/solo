from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./cleaning.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_name = Column(String, index=True)
    source_teacher = Column(String, index=True)
    status = Column(String, default="created")  # created, uploaded, cleaning, cleaned, reviewed, closed
    total_records = Column(Integer, default=0)
    valid_records = Column(Integer, default=0)
    exception_records = Column(Integer, default=0)
    duplicate_records = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    handler = Column(String, nullable=True)
    remark = Column(Text, nullable=True)

    raw_records = relationship("RawRecord", back_populates="task")
    cleaned_records = relationship("CleanedRecord", back_populates="task")
    reports = relationship("CleanReport", back_populates="task")


class RawRecord(Base):
    __tablename__ = "raw_records"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    row_number = Column(Integer)
    original_data = Column(Text)  # JSON格式保存原始数据
    source_file = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", back_populates="raw_records")
    cleaned_record = relationship("CleanedRecord", back_populates="raw_record", uselist=False)


class CleanedRecord(Base):
    __tablename__ = "cleaned_records"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    raw_record_id = Column(Integer, ForeignKey("raw_records.id"))
    student_name = Column(String, index=True)
    passport_number = Column(String, index=True)
    id_card_number = Column(String, index=True)
    gender = Column(String)
    birth_date = Column(String)
    school = Column(String)
    grade = Column(String)
    guardian_name = Column(String)
    guardian_phone = Column(String, index=True)
    guardian_relation = Column(String)
    guardian_email = Column(String)
    diet_restriction = Column(Text)
    special_needs = Column(Text)
    status = Column(String, default="pending")  # pending, valid, exception, duplicate, merged
    is_duplicate = Column(Boolean, default=False)
    duplicate_with = Column(Integer, nullable=True)
    exception_reason = Column(Text, nullable=True)
    is_manual_corrected = Column(Boolean, default=False)
    last_handler = Column(String, nullable=True)
    last_conclusion = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    task = relationship("Task", back_populates="cleaned_records")
    raw_record = relationship("RawRecord", back_populates="cleaned_record")
    guardians = relationship("Guardian", back_populates="cleaned_record")
    diet_restrictions = relationship("DietRestriction", back_populates="cleaned_record")
    audit_logs = relationship("AuditLog", back_populates="cleaned_record")


class Guardian(Base):
    __tablename__ = "guardians"

    id = Column(Integer, primary_key=True, index=True)
    cleaned_record_id = Column(Integer, ForeignKey("cleaned_records.id"))
    name = Column(String)
    phone = Column(String, index=True)
    relation = Column(String)
    email = Column(String)
    is_primary = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    cleaned_record = relationship("CleanedRecord", back_populates="guardians")


class DietRestriction(Base):
    __tablename__ = "diet_restrictions"

    id = Column(Integer, primary_key=True, index=True)
    cleaned_record_id = Column(Integer, ForeignKey("cleaned_records.id"))
    restriction_type = Column(String)  # allergy, religion, preference, other
    description = Column(Text)
    severity = Column(String)  # mild, moderate, severe
    created_at = Column(DateTime, default=datetime.utcnow)

    cleaned_record = relationship("CleanedRecord", back_populates="diet_restrictions")


class CleanReport(Base):
    __tablename__ = "clean_reports"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    report_type = Column(String)  # summary, exception, duplicate, validation
    content = Column(Text)  # JSON格式报告内容
    generated_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", back_populates="reports")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    cleaned_record_id = Column(Integer, ForeignKey("cleaned_records.id"), nullable=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    action = Column(String)  # create, update, correct, merge, close, reopen
    handler = Column(String)
    conclusion = Column(Text)
    original_value = Column(Text)
    new_value = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    cleaned_record = relationship("CleanedRecord", back_populates="audit_logs")


class HeaderMapping(Base):
    __tablename__ = "header_mappings"

    id = Column(Integer, primary_key=True, index=True)
    source_teacher = Column(String, index=True)
    source_header = Column(String)
    standard_field = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
