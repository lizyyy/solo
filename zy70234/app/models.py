from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class ProjectType:
    FASTING = "fasting"
    POST_MEAL = "post_meal"
    UNRESTRICTED = "unrestricted"


class QueueStatus:
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    RESCHEDULED = "rescheduled"
    CANCELLED = "cancelled"
    INVALID = "invalid"


class CheckProject(Base):
    __tablename__ = "check_projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    code = Column(String, unique=True, index=True)
    project_type = Column(String)
    description = Column(String, nullable=True)
    estimated_minutes = Column(Integer, default=15)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    dependencies = relationship(
        "ProjectDependency",
        foreign_keys="ProjectDependency.dependent_project_id",
        back_populates="dependent_project",
    )
    dependents = relationship(
        "ProjectDependency",
        foreign_keys="ProjectDependency.dependency_project_id",
        back_populates="dependency_project",
    )


class ProjectDependency(Base):
    __tablename__ = "project_dependencies"

    id = Column(Integer, primary_key=True, index=True)
    dependent_project_id = Column(Integer, ForeignKey("check_projects.id"))
    dependency_project_id = Column(Integer, ForeignKey("check_projects.id"))
    dependency_type = Column(String, default="required")
    created_at = Column(DateTime, default=datetime.utcnow)

    dependent_project = relationship(
        "CheckProject", foreign_keys=[dependent_project_id], back_populates="dependencies"
    )
    dependency_project = relationship(
        "CheckProject", foreign_keys=[dependency_project_id], back_populates="dependents"
    )


class Package(Base):
    __tablename__ = "packages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    code = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    projects = relationship("PackageProject", back_populates="package")


class PackageProject(Base):
    __tablename__ = "package_projects"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("packages.id"))
    project_id = Column(Integer, ForeignKey("check_projects.id"))
    sort_order = Column(Integer, default=0)

    package = relationship("Package", back_populates="projects")
    project = relationship("CheckProject")


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    id_card = Column(String, unique=True, index=True)
    phone = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class QueueNumber(Base):
    __tablename__ = "queue_numbers"

    id = Column(Integer, primary_key=True, index=True)
    queue_number = Column(String, unique=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    package_id = Column(Integer, ForeignKey("packages.id"))
    project_id = Column(Integer, ForeignKey("check_projects.id"))
    status = Column(String, default=QueueStatus.PENDING)
    estimated_start_time = Column(DateTime, nullable=True)
    actual_start_time = Column(DateTime, nullable=True)
    actual_end_time = Column(DateTime, nullable=True)
    source = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient")
    package = relationship("Package")
    project = relationship("CheckProject")


class ProblemRecord(Base):
    __tablename__ = "problem_records"

    id = Column(Integer, primary_key=True, index=True)
    source_endpoint = Column(String)
    source_data = Column(JSON)
    error_message = Column(Text)
    error_type = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
