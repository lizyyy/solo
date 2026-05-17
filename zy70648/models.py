from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Float
from sqlalchemy.orm import relationship
from database import Base
import datetime


class CourseSession(Base):
    __tablename__ = "course_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_code = Column(String, unique=True, index=True)
    course_name = Column(String, index=True)
    session_date = Column(DateTime)
    total_hours = Column(Float, default=4.0)
    required_attendance_rate = Column(Float, default=0.8)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    attendance_records = relationship("AttendanceRecord", back_populates="session")
    make_up_signs = relationship("MakeUpSign", back_populates="session")
    graduation_reports = relationship("GraduationReport", back_populates="session")


class Student(Base):
    __tablename__ = "students"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, unique=True, index=True)
    name = Column(String)
    email = Column(String)
    phone = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    attendance_records = relationship("AttendanceRecord", back_populates="student")
    make_up_signs = relationship("MakeUpSign", back_populates="student")
    graduation_reports = relationship("GraduationReport", back_populates="student")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("course_sessions.id"))
    student_id = Column(Integer, ForeignKey("students.id"))
    sign_in_time = Column(DateTime)
    sign_out_time = Column(DateTime)
    status = Column(String, default="present")
    source = Column(String, default="machine")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    session = relationship("CourseSession", back_populates="attendance_records")
    student = relationship("Student", back_populates="attendance_records")
    conflicts = relationship("ConflictRecord", back_populates="attendance_record")


class MakeUpSign(Base):
    __tablename__ = "make_up_signs"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("course_sessions.id"))
    student_id = Column(Integer, ForeignKey("students.id"))
    teacher_id = Column(String)
    teacher_name = Column(String)
    reason = Column(Text)
    sign_date = Column(DateTime)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    session = relationship("CourseSession", back_populates="make_up_signs")
    student = relationship("Student", back_populates="make_up_signs")
    conflicts = relationship("ConflictRecord", back_populates="make_up_sign")


class ConflictRecord(Base):
    __tablename__ = "conflict_records"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("course_sessions.id"))
    student_id = Column(Integer, ForeignKey("students.id"))
    attendance_record_id = Column(Integer, ForeignKey("attendance_records.id"), nullable=True)
    make_up_sign_id = Column(Integer, ForeignKey("make_up_signs.id"), nullable=True)
    conflict_type = Column(String)
    conflict_reason = Column(Text)
    status = Column(String, default="pending")
    resolved_by = Column(String, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution = Column(Text, nullable=True)
    original_attendance_data = Column(Text)
    original_makeup_data = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    attendance_record = relationship("AttendanceRecord", back_populates="conflicts")
    make_up_sign = relationship("MakeUpSign", back_populates="conflicts")


class GraduationReport(Base):
    __tablename__ = "graduation_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("course_sessions.id"))
    student_id = Column(Integer, ForeignKey("students.id"))
    total_sessions = Column(Integer)
    attended_sessions = Column(Integer)
    attendance_rate = Column(Float)
    make_up_count = Column(Integer)
    conflict_count = Column(Integer)
    is_eligible = Column(Boolean)
    eligibility_reason = Column(Text)
    generated_at = Column(DateTime, default=datetime.datetime.utcnow)
    generated_by = Column(String, nullable=True)
    
    session = relationship("CourseSession", back_populates="graduation_reports")
    student = relationship("Student", back_populates="graduation_reports")


class ExceptionLog(Base):
    __tablename__ = "exception_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String)
    original_input = Column(Text)
    handler = Column(String)
    conclusion = Column(Text)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
