from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./annotation_tasks.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Annotator(Base):
    __tablename__ = "annotators"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    tasks = relationship("TaskPackage", back_populates="annotator")

class Sample(Base):
    __tablename__ = "samples"
    
    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text)
    original_annotation = Column(Text, nullable=True)
    current_annotation = Column(Text, nullable=True)
    status = Column(String, default="pending")
    locked_by = Column(Integer, ForeignKey("annotators.id"), nullable=True)
    locked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    skips = relationship("SkipRecord", back_populates="sample")
    reworks = relationship("ReworkRecord", back_populates="sample")
    task_items = relationship("TaskItem", back_populates="sample")

class TaskPackage(Base):
    __tablename__ = "task_packages"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    annotator_id = Column(Integer, ForeignKey("annotators.id"))
    status = Column(String, default="assigned")
    assigned_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    annotator = relationship("Annotator", back_populates="tasks")
    items = relationship("TaskItem", back_populates="package")

class TaskItem(Base):
    __tablename__ = "task_items"
    
    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("task_packages.id"))
    sample_id = Column(Integer, ForeignKey("samples.id"))
    status = Column(String, default="pending")
    annotation_result = Column(Text, nullable=True)
    annotated_at = Column(DateTime, nullable=True)
    
    package = relationship("TaskPackage", back_populates="items")
    sample = relationship("Sample", back_populates="task_items")

class SkipRecord(Base):
    __tablename__ = "skip_records"
    
    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(Integer, ForeignKey("samples.id"))
    annotator_id = Column(Integer, ForeignKey("annotators.id"))
    reason = Column(Text)
    reviewed = Column(Boolean, default=False)
    review_result = Column(String, nullable=True)
    review_note = Column(Text, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("annotators.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    sample = relationship("Sample", back_populates="skips")

class ReworkRecord(Base):
    __tablename__ = "rework_records"
    
    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(Integer, ForeignKey("samples.id"))
    requester_id = Column(Integer, ForeignKey("annotators.id"))
    original_annotation = Column(Text)
    reason = Column(Text)
    status = Column(String, default="pending")
    rework_annotation = Column(Text, nullable=True)
    reworked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    sample = relationship("Sample", back_populates="reworks")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)