from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./address_correction.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    role = Column(String, default="sre")
    created_at = Column(DateTime, default=datetime.utcnow)

    operations = relationship("OperationLog", back_populates="operator")


class AddressRecord(Base):
    __tablename__ = "address_records"

    id = Column(Integer, primary_key=True, index=True)
    original_address = Column(Text, nullable=False)
    geocoding_result = Column(Text)
    geocoding_version = Column(String, default="v1")
    candidate_coordinates = Column(Text)
    manual_correction = Column(Text)
    delivery_range = Column(String)
    hit_report = Column(Text)
    status = Column(String, default="pending")
    is_failed = Column(Boolean, default=False)
    failure_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    processed_by = Column(Integer, ForeignKey("users.id"))
    processed_at = Column(DateTime)

    operations = relationship("OperationLog", back_populates="record")
    reviews = relationship("ReviewRecord", back_populates="address_record")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("address_records.id"))
    operator_id = Column(Integer, ForeignKey("users.id"))
    operation_type = Column(String)
    old_value = Column(Text)
    new_value = Column(Text)
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    record = relationship("AddressRecord", back_populates="operations")
    operator = relationship("User", back_populates="operations")


class ReviewRecord(Base):
    __tablename__ = "review_records"

    id = Column(Integer, primary_key=True, index=True)
    address_record_id = Column(Integer, ForeignKey("address_records.id"))
    reviewer_id = Column(Integer, ForeignKey("users.id"))
    review_result = Column(String)
    review_comment = Column(Text)
    reviewed_at = Column(DateTime, default=datetime.utcnow)

    address_record = relationship("AddressRecord", back_populates="reviews")


class GeocodingVersion(Base):
    __tablename__ = "geocoding_versions"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String, unique=True)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
