from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Cabin(Base):
    __tablename__ = "cabins"
    
    id = Column(Integer, primary_key=True, index=True)
    cabin_code = Column(String(50), unique=True, index=True, nullable=False)
    cabin_name = Column(String(100), nullable=False)
    area = Column(Float)
    volume = Column(Float)
    location = Column(String(100))
    vessel_name = Column(String(100))
    description = Column(Text)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)


class WorkTicket(Base):
    __tablename__ = "work_tickets"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_no = Column(String(50), unique=True, index=True, nullable=False)
    cabin_code = Column(String(50), ForeignKey("cabins.cabin_code"), nullable=False)
    operation_type = Column(String(50))
    paint_type = Column(String(100))
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    workers_count = Column(Integer)
    supervisor = Column(String(50))
    status = Column(String(20), default="pending")
    created_at = Column(DateTime)
    updated_at = Column(DateTime)


class SensorLog(Base):
    __tablename__ = "sensor_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(String(50), index=True, nullable=False)
    cabin_code = Column(String(50), ForeignKey("cabins.cabin_code"), nullable=False)
    timestamp = Column(DateTime, index=True, nullable=False)
    voc_value = Column(Float, nullable=False)
    voc_unit = Column(String(20), default="ppm")
    temperature = Column(Float)
    humidity = Column(Float)
    ventilation_rate = Column(Float)
    air_changes_per_hour = Column(Float)
    is_valid = Column(Boolean, default=True)


class VentilationRule(Base):
    __tablename__ = "ventilation_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    rule_code = Column(String(50), unique=True, index=True, nullable=False)
    rule_name = Column(String(100), nullable=False)
    cabin_code = Column(String(50), nullable=True)
    operation_type = Column(String(50), nullable=True)
    paint_type = Column(String(50), nullable=True)
    min_air_changes_per_hour = Column(Float, nullable=False)
    voc_threshold_ppm = Column(Float)
    voc_threshold_mg_m3 = Column(Float)
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    description = Column(Text)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)


class RiskAnomaly(Base):
    __tablename__ = "risk_anomalies"
    
    id = Column(Integer, primary_key=True, index=True)
    anomaly_type = Column(String(50), index=True, nullable=False)
    severity = Column(String(20), default="medium")
    cabin_code = Column(String(50), nullable=True)
    work_ticket_id = Column(Integer, ForeignKey("work_tickets.id"), nullable=True)
    sensor_log_id = Column(Integer, ForeignKey("sensor_logs.id"), nullable=True)
    sensor_id = Column(String(50), nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime)
    description = Column(Text)
    details = Column(Text)
    is_confirmed = Column(Boolean, default=False)
    confirmed_by = Column(String(50))
    confirmed_at = Column(DateTime)
    confirmation_notes = Column(Text)
    created_at = Column(DateTime)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    operation = Column(String(50), nullable=False)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(Integer, nullable=True)
    details = Column(Text)
    performed_at = Column(DateTime)
    performed_by = Column(String(50), default="system")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
