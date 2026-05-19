from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, ForeignKey, Boolean, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import datetime
import enum

SQLALCHEMY_DATABASE_URL = "sqlite:///./license_tracker.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class ExceptionStatus(str, enum.Enum):
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    NEEDS_MANUAL_REVIEW = "needs_manual_review"


class LockfileType(str, enum.Enum):
    PIPFILE_LOCK = "Pipfile.lock"
    REQUIREMENTS_TXT = "requirements.txt"
    POETRY_LOCK = "poetry.lock"
    PACKAGE_JSON = "package.json"
    CARGO_LOCK = "Cargo.lock"


class Dependency(Base):
    __tablename__ = "dependencies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    version = Column(String, index=True)
    package_manager = Column(String, index=True)
    lockfile_type = Column(String, index=True)
    lockfile_path = Column(String, index=True)
    license_name = Column(String, index=True)
    license_url = Column(String)
    description = Column(Text)
    project_path = Column(String, index=True)
    imported_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_checked_at = Column(DateTime, default=datetime.datetime.utcnow)

    exceptions = relationship("LicenseException", back_populates="dependency")
    paths = relationship("DependencyPath", back_populates="dependency")


class DependencyPath(Base):
    __tablename__ = "dependency_paths"

    id = Column(Integer, primary_key=True, index=True)
    dependency_id = Column(Integer, ForeignKey("dependencies.id"))
    file_path = Column(String, index=True, nullable=False)
    import_line = Column(String)
    line_number = Column(Integer)
    module_name = Column(String, index=True)
    discovered_at = Column(DateTime, default=datetime.datetime.utcnow)

    dependency = relationship("Dependency", back_populates="paths")


class License(Base):
    __tablename__ = "licenses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False, unique=True)
    spdx_identifier = Column(String, index=True, unique=True)
    is_approved = Column(Boolean, default=False)
    is_copyleft = Column(Boolean, default=False)
    risk_level = Column(String, default="low")
    description = Column(Text)
    requirements = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class LicenseException(Base):
    __tablename__ = "license_exceptions"

    id = Column(Integer, primary_key=True, index=True)
    dependency_id = Column(Integer, ForeignKey("dependencies.id"))
    dependency_name = Column(String, index=True)
    license_name = Column(String, index=True)
    reason = Column(Text, nullable=False)
    requested_by = Column(String, index=True)
    approved_by = Column(String)
    status = Column(String, index=True, default=ExceptionStatus.PENDING_REVIEW)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    review_notes = Column(Text)
    requires_manual_review = Column(Boolean, default=False)

    dependency = relationship("Dependency", back_populates="exceptions")


class ExceptionReviewLog(Base):
    __tablename__ = "exception_review_logs"

    id = Column(Integer, primary_key=True, index=True)
    exception_id = Column(Integer, ForeignKey("license_exceptions.id"))
    reviewer = Column(String, nullable=False)
    action = Column(String, nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
