from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import enum

SQLALCHEMY_DATABASE_URL = "sqlite:///./shield_measurement.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class RiskStatus(str, enum.Enum):
    NORMAL = "normal"
    WARNING = "warning"
    CRITICAL = "critical"


class RingRecord(Base):
    __tablename__ = "ring_records"

    id = Column(Integer, primary_key=True, index=True)
    ring_number = Column(Integer, unique=True, index=True, nullable=False)
    
    segment_layout = Column(Text, nullable=True)
    jack_stroke = Column(Text, nullable=True)
    grouting_volume = Column(Float, nullable=True)
    measurement_deviation = Column(Text, nullable=True)
    
    misalignment_risk = Column(SQLEnum(RiskStatus), default=RiskStatus.NORMAL)
    attitude_risk = Column(SQLEnum(RiskStatus), default=RiskStatus.NORMAL)
    grouting_risk = Column(SQLEnum(RiskStatus), default=RiskStatus.NORMAL)
    recheck_gap_risk = Column(SQLEnum(RiskStatus), default=RiskStatus.NORMAL)
    overall_risk = Column(SQLEnum(RiskStatus), default=RiskStatus.NORMAL)
    
    misalignment_details = Column(Text, nullable=True)
    attitude_details = Column(Text, nullable=True)
    grouting_details = Column(Text, nullable=True)
    recheck_gap_details = Column(Text, nullable=True)
    
    manual_review_note = Column(Text, nullable=True)
    manual_override = Column(SQLEnum(RiskStatus), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    analyzed_at = Column(DateTime, nullable=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
