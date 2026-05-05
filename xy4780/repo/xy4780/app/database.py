from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from app.config import settings, ApplicationStatus, UserRole

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    applicant_id = Column(Integer, nullable=False)
    applicant_name = Column(String(100), nullable=False)
    department = Column(String(100), nullable=True)
    project_name = Column(String(200), nullable=False)
    project_description = Column(Text, nullable=True)
    dataset_id = Column(String(50), nullable=False)
    dataset_name = Column(String(200), nullable=False)
    
    status = Column(SQLEnum(ApplicationStatus), default=ApplicationStatus.DRAFT, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    
    ethics_approval_file_id = Column(Integer, nullable=True)
    ethics_approval_date = Column(DateTime, nullable=True)
    ethics_reviewer_id = Column(Integer, nullable=True)
    ethics_reviewer_name = Column(String(100), nullable=True)
    ethics_comments = Column(Text, nullable=True)
    
    deidentification_report_id = Column(Integer, nullable=True)
    deidentification_passed = Column(Integer, default=0)
    deidentification_reviewer_id = Column(Integer, nullable=True)
    deidentification_reviewer_name = Column(String(100), nullable=True)
    deidentification_comments = Column(Text, nullable=True)
    
    download_url = Column(String(500), nullable=True)
    download_expiry_date = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    audit_logs = relationship("AuditLog", back_populates="application")
    idempotent_keys = relationship("IdempotentKey", back_populates="application")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    operator_id = Column(Integer, nullable=False)
    operator_name = Column(String(100), nullable=False)
    operator_role = Column(SQLEnum(UserRole), nullable=False)
    
    action = Column(String(50), nullable=False)
    from_status = Column(SQLEnum(ApplicationStatus), nullable=True)
    to_status = Column(SQLEnum(ApplicationStatus), nullable=True)
    reason = Column(Text, nullable=True)
    idempotent_key = Column(String(100), nullable=True)
    version = Column(Integer, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    application = relationship("Application", back_populates="audit_logs")


class IdempotentKey(Base):
    __tablename__ = "idempotent_keys"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    idempotent_key = Column(String(100), unique=True, nullable=False)
    action = Column(String(50), nullable=False)
    operator_id = Column(Integer, nullable=False)
    processed = Column(Integer, default=0)
    result_status = Column(SQLEnum(ApplicationStatus), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)
    
    application = relationship("Application", back_populates="idempotent_keys")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False)
    department = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
