from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.database import Base


class JourneyStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    REGISTERED = "registered"
    ARCHIVED = "archived"
    REJECTED = "rejected"


class JourneyAsset(Base):
    __tablename__ = "journey_assets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True, nullable=False)
    description = Column(Text)
    steps_definition = Column(Text, nullable=False)
    dependent_services = Column(Text)
    run_frequency = Column(String(100), nullable=False)
    status = Column(Enum(JourneyStatus), default=JourneyStatus.DRAFT)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    registered_at = Column(DateTime(timezone=True))

    failure_samples = relationship("FailureSample", back_populates="journey", cascade="all, delete-orphan")
    registration_reports = relationship("RegistrationReport", back_populates="journey", cascade="all, delete-orphan")


class FailureSample(Base):
    __tablename__ = "failure_samples"

    id = Column(Integer, primary_key=True, index=True)
    journey_id = Column(Integer, ForeignKey("journey_assets.id"), nullable=False)
    sample_data = Column(Text, nullable=False)
    error_message = Column(Text)
    occurred_at = Column(DateTime(timezone=True), server_default=func.now())
    archived = Column(Integer, default=0)
    archived_at = Column(DateTime(timezone=True))

    journey = relationship("JourneyAsset", back_populates="failure_samples")


class RegistrationReport(Base):
    __tablename__ = "registration_reports"

    id = Column(Integer, primary_key=True, index=True)
    journey_id = Column(Integer, ForeignKey("journey_assets.id"), nullable=False)
    report_content = Column(Text, nullable=False)
    reporter = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    journey = relationship("JourneyAsset", back_populates="registration_reports")