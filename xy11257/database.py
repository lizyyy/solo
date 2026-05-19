from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, Boolean, ForeignKey, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./safety_inspection.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class HiddenDanger(Base):
    __tablename__ = "hidden_dangers"
    
    id = Column(String(100), primary_key=True)
    danger_no = Column(String(50), unique=True, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    location = Column(String(200))
    level = Column(String(20))
    status = Column(String(20), default="registered")
    inspector = Column(String(100))
    inspection_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    photos = relationship("Photo", back_populates="danger")
    assignments = relationship("Assignment", back_populates="danger")
    rectifications = relationship("Rectification", back_populates="danger")
    reviews = relationship("Review", back_populates="danger")
    archives = relationship("Archive", back_populates="danger")

class Photo(Base):
    __tablename__ = "photos"
    
    id = Column(String(100), primary_key=True)
    danger_id = Column(String(100), ForeignKey("hidden_dangers.id"))
    photo_path = Column(String(500))
    photo_type = Column(String(50))
    description = Column(Text)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    danger = relationship("HiddenDanger", back_populates="photos")

class Person(Base):
    __tablename__ = "persons"
    
    id = Column(String(100), primary_key=True)
    name = Column(String(100), nullable=False)
    department = Column(String(200))
    phone = Column(String(50))
    role = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

class Assignment(Base):
    __tablename__ = "assignments"
    
    id = Column(String(100), primary_key=True)
    danger_id = Column(String(100), ForeignKey("hidden_dangers.id"))
    assignee_id = Column(String(100), ForeignKey("persons.id"))
    deadline = Column(DateTime)
    requirements = Column(Text)
    assigned_by = Column(String(100))
    assigned_at = Column(DateTime, default=datetime.utcnow)
    
    danger = relationship("HiddenDanger", back_populates="assignments")
    assignee = relationship("Person")

class Rectification(Base):
    __tablename__ = "rectifications"
    
    id = Column(String(100), primary_key=True)
    danger_id = Column(String(100), ForeignKey("hidden_dangers.id"))
    rectification_date = Column(DateTime)
    measures = Column(Text)
    result = Column(String(200))
    completed_by = Column(String(100))
    completed_at = Column(DateTime, default=datetime.utcnow)
    
    danger = relationship("HiddenDanger", back_populates="rectifications")
    photos = relationship("RectificationPhoto", back_populates="rectification")

class RectificationPhoto(Base):
    __tablename__ = "rectification_photos"
    
    id = Column(String(100), primary_key=True)
    rectification_id = Column(String(100), ForeignKey("rectifications.id"))
    photo_path = Column(String(500))
    description = Column(Text)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    rectification = relationship("Rectification", back_populates="photos")

class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(String(100), primary_key=True)
    danger_id = Column(String(100), ForeignKey("hidden_dangers.id"))
    reviewer_id = Column(String(100), ForeignKey("persons.id"))
    review_date = Column(DateTime)
    result = Column(String(50))
    comments = Column(Text)
    reviewed_at = Column(DateTime, default=datetime.utcnow)
    
    danger = relationship("HiddenDanger", back_populates="reviews")
    reviewer = relationship("Person")

class Archive(Base):
    __tablename__ = "archives"
    
    id = Column(String(100), primary_key=True)
    danger_id = Column(String(100), ForeignKey("hidden_dangers.id"))
    archived_by = Column(String(100))
    archive_reason = Column(Text)
    archived_at = Column(DateTime, default=datetime.utcnow)
    
    danger = relationship("HiddenDanger", back_populates="archives")

class ImportError(Base):
    __tablename__ = "import_errors"
    
    id = Column(String(100), primary_key=True)
    import_type = Column(String(50))
    source_file = Column(String(500))
    row_number = Column(Integer)
    original_data = Column(Text)
    error_message = Column(Text)
    suggestion = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

class OperationLog(Base):
    __tablename__ = "operation_logs"
    
    id = Column(String(100), primary_key=True)
    operation_type = Column(String(50))
    danger_id = Column(String(100))
    operator = Column(String(100))
    details = Column(Text)
    old_status = Column(String(20))
    new_status = Column(String(20))
    created_at = Column(DateTime, default=datetime.utcnow)

def init_db():
    Base.metadata.create_all(bind=engine)
