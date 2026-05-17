from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./parcel_management.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Recipient(Base):
    __tablename__ = "recipients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=False, index=True)
    address = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    parcels = relationship("Parcel", back_populates="recipient")


class Parcel(Base):
    __tablename__ = "parcels"

    id = Column(Integer, primary_key=True, index=True)
    tracking_number = Column(String(100), nullable=False, unique=True, index=True)
    courier_company = Column(String(100))
    recipient_id = Column(Integer, ForeignKey("recipients.id"))
    inbound_time = Column(DateTime, nullable=False, default=datetime.utcnow)
    status = Column(String(50), nullable=False, default="pending")
    shelf_location = Column(String(100))
    weight = Column(String(50))
    remarks = Column(Text)
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_deleted = Column(Boolean, default=False)
    closed_at = Column(DateTime)
    closed_by = Column(String(100))
    close_reason = Column(String(500))

    recipient = relationship("Recipient", back_populates="parcels")
    reminder_records = relationship("ReminderRecord", back_populates="parcel")
    rejection = relationship("Rejection", back_populates="parcel", uselist=False)
    return_report = relationship("ReturnReport", back_populates="parcel", uselist=False)
    operation_logs = relationship("OperationLog", back_populates="parcel")


class ReminderRecord(Base):
    __tablename__ = "reminder_records"

    id = Column(Integer, primary_key=True, index=True)
    parcel_id = Column(Integer, ForeignKey("parcels.id"), nullable=False)
    reminder_type = Column(String(50), nullable=False)
    reminder_channel = Column(String(50), default="sms")
    reminder_content = Column(Text)
    sent_at = Column(DateTime, default=datetime.utcnow)
    sent_by = Column(String(100))
    is_success = Column(Boolean, default=True)
    deduplication_key = Column(String(200), index=True)

    parcel = relationship("Parcel", back_populates="reminder_records")


class Rejection(Base):
    __tablename__ = "rejections"

    id = Column(Integer, primary_key=True, index=True)
    parcel_id = Column(Integer, ForeignKey("parcels.id"), nullable=False, unique=True)
    reason = Column(Text, nullable=False)
    rejected_by = Column(String(100))
    rejected_at = Column(DateTime, default=datetime.utcnow)
    contact_result = Column(String(500))
    follow_up_action = Column(String(200))
    remarks = Column(Text)
    is_confirmed = Column(Boolean, default=False)
    confirmed_by = Column(String(100))
    confirmed_at = Column(DateTime)

    parcel = relationship("Parcel", back_populates="rejection")


class ReturnReport(Base):
    __tablename__ = "return_reports"

    id = Column(Integer, primary_key=True, index=True)
    parcel_id = Column(Integer, ForeignKey("parcels.id"), nullable=False, unique=True)
    return_tracking_number = Column(String(100))
    return_courier_company = Column(String(100))
    return_reason = Column(Text)
    return_address = Column(String(500))
    return_contact = Column(String(100))
    return_phone = Column(String(20))
    reported_by = Column(String(100))
    reported_at = Column(DateTime, default=datetime.utcnow)
    is_confirmed = Column(Boolean, default=False)
    confirmed_by = Column(String(100))
    confirmed_at = Column(DateTime)
    actual_shipped_at = Column(DateTime)
    received_at = Column(DateTime)
    remarks = Column(Text)

    parcel = relationship("Parcel", back_populates="return_report")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    parcel_id = Column(Integer, ForeignKey("parcels.id"))
    operation_type = Column(String(100), nullable=False)
    original_input = Column(Text)
    operator = Column(String(100))
    conclusion = Column(Text)
    remarks = Column(Text)
    operation_time = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String(50))

    parcel = relationship("Parcel", back_populates="operation_logs")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
