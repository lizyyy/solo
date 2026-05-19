from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base


class VerificationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class ExceptionType(str, enum.Enum):
    NO_EXCEPTION = "no_exception"
    BLACKLISTED = "blacklisted"
    INVALID_PLATE = "invalid_plate"
    EXPIRED_VISIT = "expired_visit"
    WRONG_GATE = "wrong_gate"
    ID_MISMATCH = "id_mismatch"


class Visitor(Base):
    __tablename__ = "visitors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    id_card = Column(String(50), unique=True, nullable=False)
    phone = Column(String(20))
    company = Column(String(200))
    visit_purpose = Column(String(500))
    host_name = Column(String(100))
    host_department = Column(String(100))
    expected_start = Column(DateTime, nullable=False)
    expected_end = Column(DateTime, nullable=False)
    license_plate = Column(String(20))
    gate_number = Column(String(10))
    status = Column(Enum(VerificationStatus), default=VerificationStatus.PENDING)
    responsible_person = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    notes = Column(Text)

    verifications = relationship("VerificationRecord", back_populates="visitor")


class TemporaryPlate(Base):
    __tablename__ = "temporary_plates"

    id = Column(Integer, primary_key=True, index=True)
    plate_number = Column(String(20), unique=True, nullable=False)
    visitor_id = Column(Integer, ForeignKey("visitors.id"))
    issued_by = Column(String(100))
    issued_at = Column(DateTime(timezone=True), server_default=func.now())
    valid_from = Column(DateTime, nullable=False)
    valid_to = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True)
    notes = Column(Text)


class Blacklist(Base):
    __tablename__ = "blacklist"

    id = Column(Integer, primary_key=True, index=True)
    identifier = Column(String(100), unique=True, nullable=False)
    identifier_type = Column(String(20), nullable=False)
    reason = Column(String(500), nullable=False)
    added_by = Column(String(100))
    added_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime)
    notes = Column(Text)


class VerificationRecord(Base):
    __tablename__ = "verification_records"

    id = Column(Integer, primary_key=True, index=True)
    visitor_id = Column(Integer, ForeignKey("visitors.id"))
    plate_number = Column(String(20))
    id_card = Column(String(50))
    gate_number = Column(String(10))
    verified_at = Column(DateTime(timezone=True), server_default=func.now())
    verified_by = Column(String(100))
    status = Column(Enum(VerificationStatus), nullable=False)
    exception_type = Column(Enum(ExceptionType), default=ExceptionType.NO_EXCEPTION)
    exception_details = Column(Text)
    notes = Column(Text)

    visitor = relationship("Visitor", back_populates="verifications")
