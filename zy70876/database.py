from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./graduate_school.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Advisor(Base):
    __tablename__ = "advisors"
    
    id = Column(Integer, primary_key=True, index=True)
    advisor_id = Column(String, unique=True, index=True)
    name = Column(String, index=True)
    department = Column(String, index=True)
    major = Column(String, index=True)
    research_direction = Column(String)
    total_quota = Column(Integer, default=0)
    used_quota = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    students = relationship("Student", back_populates="advisor")
    allocations = relationship("AllocationRecord", back_populates="advisor")


class Student(Base):
    __tablename__ = "students"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, unique=True, index=True)
    name = Column(String, index=True)
    department = Column(String, index=True)
    major = Column(String, index=True)
    exam_score = Column(Float)
    advisor_id = Column(Integer, ForeignKey("advisors.id"))
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    advisor = relationship("Advisor", back_populates="students")
    preferences = relationship("Preference", back_populates="student")
    adjustment_records = relationship("AdjustmentRecord", back_populates="student")
    allocations = relationship("AllocationRecord", back_populates="student")


class Preference(Base):
    __tablename__ = "preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    advisor_id = Column(Integer, ForeignKey("advisors.id"))
    priority = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    student = relationship("Student", back_populates="preferences")


class Batch(Base):
    __tablename__ = "batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_code = Column(String, unique=True, index=True)
    batch_name = Column(String)
    batch_type = Column(String)
    status = Column(String, default="active")
    created_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    adjustment_records = relationship("AdjustmentRecord", back_populates="batch")
    allocations = relationship("AllocationRecord", back_populates="batch")


class AdjustmentRecord(Base):
    __tablename__ = "adjustment_records"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    batch_id = Column(Integer, ForeignKey("batches.id"))
    from_advisor_id = Column(Integer, ForeignKey("advisors.id"))
    to_advisor_id = Column(Integer, ForeignKey("advisors.id"))
    reason = Column(Text)
    status = Column(String, default="pending")
    created_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    student = relationship("Student", back_populates="adjustment_records")
    batch = relationship("Batch", back_populates="adjustment_records")


class AllocationRecord(Base):
    __tablename__ = "allocation_records"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    advisor_id = Column(Integer, ForeignKey("advisors.id"))
    batch_id = Column(Integer, ForeignKey("batches.id"))
    status = Column(String, default="pending")
    allocation_type = Column(String)
    created_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    student = relationship("Student", back_populates="allocations")
    advisor = relationship("Advisor", back_populates="allocations")
    batch = relationship("Batch", back_populates="allocations")
    audit_logs = relationship("AuditLog", back_populates="allocation")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    allocation_id = Column(Integer, ForeignKey("allocation_records.id"))
    action = Column(String)
    reason = Column(Text)
    operator = Column(String)
    previous_status = Column(String)
    new_status = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    allocation = relationship("AllocationRecord", back_populates="audit_logs")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
