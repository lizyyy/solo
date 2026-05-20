from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_name = Column(String, index=True, nullable=False)
    content_hash = Column(String, unique=True, index=True, nullable=False)
    submitted_by = Column(String, nullable=False)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, default="pending")
    description = Column(Text)

    materials = relationship("Material", back_populates="batch")
    allocation_results = relationship("AllocationResult", back_populates="batch")
    audit_logs = relationship("AuditLog", back_populates="batch")


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    student_id = Column(String, index=True, nullable=False)
    student_name = Column(String, nullable=False)
    department = Column(String, nullable=False)
    major = Column(String)
    gpa = Column(Float)
    research_interest = Column(Text)
    preferred_tutors = Column(Text)
    application_materials = Column(Text)

    batch = relationship("Batch", back_populates="materials")


class AllocationResult(Base):
    __tablename__ = "allocation_results"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    material_id = Column(Integer, ForeignKey("materials.id"))
    student_id = Column(String, index=True)
    student_name = Column(String)
    tutor_id = Column(String, nullable=False)
    tutor_name = Column(String, nullable=False)
    department = Column(String)
    allocation_reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_valid = Column(Integer, default=1)

    batch = relationship("Batch", back_populates="allocation_results")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    result_id = Column(Integer, ForeignKey("allocation_results.id"))
    modified_by = Column(String, nullable=False)
    modified_at = Column(DateTime(timezone=True), server_default=func.now())
    change_reason = Column(Text, nullable=False)
    field_name = Column(String)
    old_value = Column(Text)
    new_value = Column(Text)

    batch = relationship("Batch", back_populates="audit_logs")
