from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

DATABASE_URL = "sqlite:///./data/auditor.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    samples = relationship("Sample", back_populates="project", cascade="all, delete-orphan")
    versions = relationship("Version", back_populates="project", cascade="all, delete-orphan")


class Sample(Base):
    __tablename__ = "samples"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    external_id = Column(String(255))
    content = Column(Text, nullable=False)
    sample_metadata = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="samples")
    annotations = relationship("Annotation", back_populates="sample", cascade="all, delete-orphan")
    conflicts = relationship("Conflict", back_populates="sample", cascade="all, delete-orphan")


class Annotation(Base):
    __tablename__ = "annotations"
    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(Integer, ForeignKey("samples.id"), nullable=False)
    annotator = Column(String(255), nullable=False)
    label = Column(String(255), nullable=False)
    confidence = Column(Float, default=1.0)
    reasoning = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    sample = relationship("Sample", back_populates="annotations")
    review_decisions = relationship("ReviewDecision", back_populates="annotation", cascade="all, delete-orphan")


class Conflict(Base):
    __tablename__ = "conflicts"
    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(Integer, ForeignKey("samples.id"), nullable=False)
    status = Column(String(50), default="pending")
    severity = Column(String(50), default="medium")
    detection_method = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime)
    resolved_by = Column(String(255))
    resolution_notes = Column(Text)
    
    sample = relationship("Sample", back_populates="conflicts")
    review_decisions = relationship("ReviewDecision", back_populates="conflict", cascade="all, delete-orphan")


class ReviewDecision(Base):
    __tablename__ = "review_decisions"
    id = Column(Integer, primary_key=True, index=True)
    conflict_id = Column(Integer, ForeignKey("conflicts.id"), nullable=False)
    annotation_id = Column(Integer, ForeignKey("annotations.id"), nullable=True)
    reviewer = Column(String(255), nullable=False)
    decision = Column(String(50), nullable=False)
    reasoning = Column(Text, nullable=False)
    is_final = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    conflict = relationship("Conflict", back_populates="review_decisions")
    annotation = relationship("Annotation", back_populates="review_decisions")


class Version(Base):
    __tablename__ = "versions"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    description = Column(Text)
    action = Column(String(50), nullable=False)
    affected_samples = Column(Integer, default=0)
    created_by = Column(String(255), default="system")
    created_at = Column(DateTime, default=datetime.utcnow)
    snapshot_data = Column(Text)
    
    project = relationship("Project", back_populates="versions")


def init_db():
    import os
    os.makedirs("./data", exist_ok=True)
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
