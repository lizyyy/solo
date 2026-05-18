from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Date, Time, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), unique=True, nullable=False)
    email = Column(String(100))
    age = Column(Integer)
    gender = Column(String(10))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    treatment_plans = relationship("TreatmentPlan", back_populates="patient")
    reminder_records = relationship("ReminderRecord", back_populates="patient")
    revisit_reports = relationship("RevisitReport", back_populates="patient")


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    department = Column(String(100))
    title = Column(String(100))
    phone = Column(String(20))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    schedules = relationship("DoctorSchedule", back_populates="doctor")


class DoctorSchedule(Base):
    __tablename__ = "doctor_schedules"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    schedule_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    max_patients = Column(Integer, default=10)
    booked_count = Column(Integer, default=0)
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    doctor = relationship("Doctor", back_populates="schedules")


class TreatmentPlan(Base):
    __tablename__ = "treatment_plans"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"))
    treatment_name = Column(String(200), nullable=False)
    treatment_description = Column(Text)
    next_revisit_date = Column(Date, nullable=False)
    revisit_type = Column(String(100))
    status = Column(String(50), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    patient = relationship("Patient", back_populates="treatment_plans")
    reminder_records = relationship("ReminderRecord", back_populates="treatment_plan")


class ReminderStatus:
    PENDING = "pending"
    SCHEDULED = "scheduled"
    SENT = "sent"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    MISSED = "missed"
    COMPLETED = "completed"


class ReminderRecord(Base):
    __tablename__ = "reminder_records"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    treatment_plan_id = Column(Integer, ForeignKey("treatment_plans.id"), nullable=False)
    schedule_id = Column(Integer, ForeignKey("doctor_schedules.id"))
    reminder_date = Column(Date, nullable=False)
    reminder_time = Column(Time)
    status = Column(String(50), default=ReminderStatus.PENDING)
    reminder_type = Column(String(50), default="auto")
    reminder_channel = Column(String(50), default="sms")
    retry_count = Column(Integer, default=0)
    last_reminder_at = Column(DateTime(timezone=True))
    confirmed_at = Column(DateTime(timezone=True))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    patient = relationship("Patient", back_populates="reminder_records")
    treatment_plan = relationship("TreatmentPlan", back_populates="reminder_records")
    schedule = relationship("DoctorSchedule")
    miss_record = relationship("MissedAppointment", uselist=False, back_populates="reminder_record")
    status_histories = relationship("ReminderStatusHistory", back_populates="reminder_record", cascade="all, delete-orphan")


class ReminderStatusHistory(Base):
    __tablename__ = "reminder_status_histories"

    id = Column(Integer, primary_key=True, index=True)
    reminder_record_id = Column(Integer, ForeignKey("reminder_records.id"), nullable=False)
    from_status = Column(String(50))
    to_status = Column(String(50), nullable=False)
    changed_by = Column(String(100))
    change_reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    reminder_record = relationship("ReminderRecord", back_populates="status_histories")


class MissedAppointment(Base):
    __tablename__ = "missed_appointments"

    id = Column(Integer, primary_key=True, index=True)
    reminder_record_id = Column(Integer, ForeignKey("reminder_records.id"), nullable=False)
    miss_date = Column(Date, nullable=False)
    reason_code = Column(String(50))
    reason_description = Column(Text)
    reported_by = Column(String(100))
    is_manual = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    reminder_record = relationship("ReminderRecord", back_populates="miss_record")


class RevisitReport(Base):
    __tablename__ = "revisit_reports"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    reminder_record_id = Column(Integer, ForeignKey("reminder_records.id"))
    treatment_plan_id = Column(Integer, ForeignKey("treatment_plans.id"))
    report_date = Column(Date, nullable=False)
    doctor_name = Column(String(100))
    diagnosis = Column(Text)
    treatment_result = Column(Text)
    next_revisit_date = Column(Date)
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    patient = relationship("Patient", back_populates="revisit_reports")


class ExceptionLog(Base):
    __tablename__ = "exception_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String(100), nullable=False)
    original_input = Column(Text, nullable=False)
    error_message = Column(Text)
    handler = Column(String(100))
    conclusion = Column(String(200))
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True))
