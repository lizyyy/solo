from sqlalchemy import create_engine, Column, Integer, String, Date, DateTime, Text, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from .config import DB_PATH, CONFIG_DIR

Base = declarative_base()

class Doctor(Base):
    __tablename__ = "doctors"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    specialty = Column(String(100), default="正畸")
    max_daily = Column(Integer, default=8)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    appointments = relationship("Appointment", back_populates="doctor")
    
    def __repr__(self):
        return f"<Doctor(id={self.id}, name='{self.name}')>"

class Patient(Base):
    __tablename__ = "patients"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String(50), nullable=False, unique=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20))
    review_interval_days = Column(Integer, default=28)
    current_stage = Column(String(50))
    reminder_type = Column(String(20), default="短信")
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    appointments = relationship("Appointment", back_populates="patient")
    
    def __repr__(self):
        return f"<Patient(id={self.id}, patient_id='{self.patient_id}', name='{self.name}')>"

class Appointment(Base):
    __tablename__ = "appointments"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    appointment_code = Column(String(100), nullable=False, unique=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    appointment_date = Column(Date, nullable=False)
    is_emergency = Column(Boolean, default=False)
    emergency_reason = Column(String(200))
    status = Column(String(20), default="待确认")
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")
    reschedule_history = relationship("RescheduleHistory", back_populates="appointment")
    reminders = relationship("Reminder", back_populates="appointment")
    
    __table_args__ = (
        UniqueConstraint('patient_id', 'appointment_date', 'is_emergency', name='uix_patient_date_emergency'),
    )
    
    def __repr__(self):
        return f"<Appointment(id={self.id}, code='{self.appointment_code}')>"

class RescheduleHistory(Base):
    __tablename__ = "reschedule_history"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    original_date = Column(Date, nullable=False)
    new_date = Column(Date, nullable=False)
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    appointment = relationship("Appointment", back_populates="reschedule_history")
    
    def __repr__(self):
        return f"<RescheduleHistory(id={self.id}, appt_id={self.appointment_id})>"

class Reminder(Base):
    __tablename__ = "reminders"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    reminder_type = Column(String(20), nullable=False)
    reminder_date = Column(Date, nullable=False)
    is_sent = Column(Boolean, default=False)
    is_withdrawn = Column(Boolean, default=False)
    sent_at = Column(DateTime)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    appointment = relationship("Appointment", back_populates="reminders")
    
    def __repr__(self):
        return f"<Reminder(id={self.id}, appt_id={self.appointment_id})>"

def get_engine():
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    engine = create_engine(f"sqlite:///{DB_PATH}", echo=False)
    return engine

def get_session():
    engine = get_engine()
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    return Session()

def init_db():
    engine = get_engine()
    Base.metadata.create_all(engine)
    return engine
