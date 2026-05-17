from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, ForeignKey, Boolean, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./school_uniform.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class ClassInfo(Base):
    __tablename__ = "classes"
    
    id = Column(Integer, primary_key=True, index=True)
    grade = Column(String(50), nullable=False)
    class_name = Column(String(50), nullable=False)
    teacher_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    students = relationship("Student", back_populates="class_info")


class Student(Base):
    __tablename__ = "students"
    
    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"))
    student_no = Column(String(50))
    name = Column(String(100), nullable=False)
    gender = Column(String(10))
    height = Column(Float)
    weight = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    class_info = relationship("ClassInfo", back_populates="students")
    size_records = relationship("SizeRecord", back_populates="student")


class SizeRecord(Base):
    __tablename__ = "size_records"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    import_batch_id = Column(Integer, ForeignKey("import_batches.id"))
    original_size = Column(String(100))
    standardized_size = Column(String(50))
    size_type = Column(String(50))
    is_duplicate = Column(Boolean, default=False)
    is_supplement = Column(Boolean, default=False)
    quantity = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    student = relationship("Student", back_populates="size_records")
    import_batch = relationship("ImportBatch", back_populates="size_records")
    exception_notes = relationship("ExceptionNote", back_populates="size_record")


class ImportBatch(Base):
    __tablename__ = "import_batches"
    
    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String(255))
    status = Column(String(50), default="pending")
    total_records = Column(Integer, default=0)
    processed_records = Column(Integer, default=0)
    has_exceptions = Column(Boolean, default=False)
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime)
    
    size_records = relationship("SizeRecord", back_populates="import_batch")
    exception_notes = relationship("ExceptionNote", back_populates="import_batch")


class ExceptionNote(Base):
    __tablename__ = "exception_notes"
    
    id = Column(Integer, primary_key=True, index=True)
    size_record_id = Column(Integer, ForeignKey("size_records.id"))
    import_batch_id = Column(Integer, ForeignKey("import_batches.id"))
    exception_type = Column(String(50))
    message = Column(Text)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(String(100))
    resolved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    size_record = relationship("SizeRecord", back_populates="exception_notes")
    import_batch = relationship("ImportBatch", back_populates="exception_notes")


class OrderReport(Base):
    __tablename__ = "order_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    report_type = Column(String(50))
    file_name = Column(String(255))
    file_path = Column(String(500))
    generated_by = Column(String(100))
    total_students = Column(Integer, default=0)
    total_quantity = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
