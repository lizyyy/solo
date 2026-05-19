from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import enum

SQLALCHEMY_DATABASE_URL = "sqlite:///./k8s_resource_checker.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class ResourceStatus(str, enum.Enum):
    PENDING = "pending"
    NEEDS_REVIEW = "needs_review"
    PROCESSED = "processed"
    FIXED = "fixed"


class IssueType(str, enum.Enum):
    MISSING_REQUESTS = "missing_requests"
    MISSING_LIMITS = "missing_limits"
    MISSING_BOTH = "missing_both"
    RATIO_MISMATCH = "ratio_mismatch"
    NORMAL = "normal"


class YamlDirectory(Base):
    __tablename__ = "yaml_directories"

    id = Column(Integer, primary_key=True, index=True)
    path = Column(String, unique=True, index=True)
    imported_at = Column(DateTime, default=datetime.utcnow)
    total_files = Column(Integer, default=0)
    total_containers = Column(Integer, default=0)

    containers = relationship("ContainerResource", back_populates="directory")


class ContainerResource(Base):
    __tablename__ = "container_resources"

    id = Column(Integer, primary_key=True, index=True)
    directory_id = Column(Integer, ForeignKey("yaml_directories.id"))
    namespace = Column(String, index=True)
    workload_name = Column(String)
    workload_type = Column(String)
    container_name = Column(String)
    cpu_requests = Column(String)
    memory_requests = Column(String)
    cpu_limits = Column(String)
    memory_limits = Column(String)
    issue_type = Column(Enum(IssueType))
    status = Column(Enum(ResourceStatus), default=ResourceStatus.PENDING)
    cpu_ratio = Column(Float)
    memory_ratio = Column(Float)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    yaml_file_path = Column(String)

    directory = relationship("YamlDirectory", back_populates="containers")


class OptimizationReport(Base):
    __tablename__ = "optimization_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_type = Column(String)
    namespace = Column(String, nullable=True)
    total_containers = Column(Integer, default=0)
    missing_requests_count = Column(Integer, default=0)
    missing_limits_count = Column(Integer, default=0)
    ratio_issues_count = Column(Integer, default=0)
    generated_at = Column(DateTime, default=datetime.utcnow)
    summary = Column(Text)
    export_format = Column(String, default="json")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
