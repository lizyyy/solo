from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, Text, Float, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./visitor_verification.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Visitor(Base):
    __tablename__ = "visitors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    phone = Column(String, index=True)
    id_card = Column(String, index=True)
    company = Column(String)
    visit_person = Column(String)
    visit_reason = Column(String)
    expected_arrival = Column(DateTime)
    expected_departure = Column(DateTime)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    source_file = Column(String)
    source_line = Column(Integer)


class TemporaryPlate(Base):
    __tablename__ = "temporary_plates"

    id = Column(Integer, primary_key=True, index=True)
    plate_number = Column(String, index=True)
    owner_name = Column(String)
    owner_phone = Column(String)
    valid_from = Column(DateTime)
    valid_to = Column(DateTime)
    reason = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    source_file = Column(String)


class Blacklist(Base):
    __tablename__ = "blacklists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    id_card = Column(String, index=True)
    phone = Column(String, index=True)
    plate_number = Column(String, index=True, nullable=True)
    reason = Column(String)
    level = Column(String, default="normal")
    added_by = Column(String)
    added_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    source_file = Column(String)


class VerificationRecord(Base):
    __tablename__ = "verification_records"

    id = Column(Integer, primary_key=True, index=True)
    visitor_id = Column(Integer, ForeignKey("visitors.id"), nullable=True)
    visitor_name = Column(String)
    visitor_phone = Column(String)
    plate_number = Column(String, nullable=True)
    verify_time = Column(DateTime, default=datetime.utcnow)
    status = Column(String, index=True)
    handler = Column(String, index=True)
    remark = Column(Text)
    is_anomaly = Column(Boolean, default=False)
    anomaly_type = Column(String, nullable=True)
    detail = Column(Text)

    visitor = relationship("Visitor", back_populates="verifications")


Visitor.verifications = relationship("VerificationRecord", back_populates="visitor")


class ImportErrorRecord(Base):
    __tablename__ = "import_error_records"

    id = Column(Integer, primary_key=True, index=True)
    import_type = Column(String, index=True)
    source_file = Column(String)
    original_line = Column(Integer)
    original_data = Column(Text)
    error_message = Column(String)
    suggestion = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved = Column(Boolean, default=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
