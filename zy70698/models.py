from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String)
    course_date = Column(DateTime)
    max_students = Column(Integer)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    registrations = relationship("Registration", back_populates="course")
    material_kits = relationship("CourseMaterialKit", back_populates="course")


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    phone = Column(String, unique=True, index=True)
    email = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    registrations = relationship("Registration", back_populates="student")


class MaterialKit(Base):
    __tablename__ = "material_kits"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String)
    unit = Column(String)
    total_quantity = Column(Integer, default=0)
    reserved_quantity = Column(Integer, default=0)
    available_quantity = Column(Integer, default=0)
    warning_threshold = Column(Integer, default=10)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    course_kits = relationship("CourseMaterialKit", back_populates="material_kit")
    stock_records = relationship("StockRecord", back_populates="material_kit")


class CourseMaterialKit(Base):
    __tablename__ = "course_material_kits"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    material_kit_id = Column(Integer, ForeignKey("material_kits.id"))
    quantity_per_student = Column(Integer, default=1)

    course = relationship("Course", back_populates="material_kits")
    material_kit = relationship("MaterialKit", back_populates="course_kits")


class Registration(Base):
    __tablename__ = "registrations"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    student_id = Column(Integer, ForeignKey("students.id"))
    status = Column(String, default="registered")
    registered_at = Column(DateTime(timezone=True), server_default=func.now())
    cancelled_at = Column(DateTime(timezone=True))
    notes = Column(String)

    course = relationship("Course", back_populates="registrations")
    student = relationship("Student", back_populates="registrations")


class DropRecord(Base):
    __tablename__ = "drop_records"

    id = Column(Integer, primary_key=True, index=True)
    registration_id = Column(Integer, ForeignKey("registrations.id"))
    course_id = Column(Integer, ForeignKey("courses.id"))
    student_id = Column(Integer, ForeignKey("students.id"))
    drop_type = Column(String)
    transferred_to_course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)
    reason = Column(String)
    needs_review = Column(Boolean, default=False)
    reviewed = Column(Boolean, default=False)
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class StockRecord(Base):
    __tablename__ = "stock_records"

    id = Column(Integer, primary_key=True, index=True)
    material_kit_id = Column(Integer, ForeignKey("material_kits.id"))
    change_type = Column(String)
    change_quantity = Column(Integer)
    previous_quantity = Column(Integer)
    new_quantity = Column(Integer)
    related_registration_id = Column(Integer, ForeignKey("registrations.id"), nullable=True)
    related_drop_id = Column(Integer, ForeignKey("drop_records.id"), nullable=True)
    notes = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    material_kit = relationship("MaterialKit", back_populates="stock_records")


class PreparationReport(Base):
    __tablename__ = "preparation_reports"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    report_date = Column(DateTime(timezone=True), server_default=func.now())
    total_registered = Column(Integer)
    total_dropped = Column(Integer)
    net_registered = Column(Integer)
    materials_summary = Column(String)
    has_warnings = Column(Boolean, default=False)
    warning_details = Column(String)
    generated_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
