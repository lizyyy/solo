from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class VolunteerStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class ShiftStatus(str, enum.Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class CheckInStatus(str, enum.Enum):
    PENDING = "pending"
    CHECKED_IN = "checked_in"
    CHECKED_OUT = "checked_out"
    LATE = "late"
    ABSENT = "absent"


class SwapStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class CertificationStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class ReportStatus(str, enum.Enum):
    DRAFT = "draft"
    GENERATED = "generated"
    EXPORTED = "exported"


class ExceptionType(str, enum.Enum):
    CHECKIN_ERROR = "checkin_error"
    SWAP_ERROR = "swap_error"
    CERTIFICATION_ERROR = "certification_error"
    CAPACITY_ERROR = "capacity_error"
    LOCATION_ERROR = "location_error"
    MANUAL_CORRECTION = "manual_correction"


class Volunteer(Base):
    __tablename__ = "volunteers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), unique=True, nullable=False)
    email = Column(String(100))
    status = Column(Enum(VolunteerStatus), default=VolunteerStatus.ACTIVE)
    total_hours = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    checkins = relationship("CheckInRecord", back_populates="volunteer")
    swap_requests = relationship("ShiftSwap", foreign_keys="ShiftSwap.requester_id", back_populates="requester")
    swap_accepts = relationship("ShiftSwap", foreign_keys="ShiftSwap.acceptor_id", back_populates="acceptor")
    certifications = relationship("DurationCertification", back_populates="volunteer")


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    address = Column(String(200))
    latitude = Column(Float)
    longitude = Column(Float)
    radius_meters = Column(Integer, default=100)
    is_active = Column(Boolean, default=True)
    require_location_check = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    shifts = relationship("Shift", back_populates="location")


class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"))
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    capacity = Column(Integer, nullable=False)
    actual_count = Column(Integer, default=0)
    status = Column(Enum(ShiftStatus), default=ShiftStatus.PLANNED)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    location = relationship("Location", back_populates="shifts")
    checkins = relationship("CheckInRecord", back_populates="shift")
    swaps = relationship("ShiftSwap", back_populates="shift")


class CheckInRecord(Base):
    __tablename__ = "checkin_records"

    id = Column(Integer, primary_key=True, index=True)
    volunteer_id = Column(Integer, ForeignKey("volunteers.id"))
    shift_id = Column(Integer, ForeignKey("shifts.id"))
    checkin_time = Column(DateTime(timezone=True))
    checkout_time = Column(DateTime(timezone=True))
    checkin_lat = Column(Float)
    checkin_lng = Column(Float)
    checkout_lat = Column(Float)
    checkout_lng = Column(Float)
    status = Column(Enum(CheckInStatus), default=CheckInStatus.PENDING)
    actual_duration = Column(Float, default=0.0)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    volunteer = relationship("Volunteer", back_populates="checkins")
    shift = relationship("Shift", back_populates="checkins")
    certifications = relationship("DurationCertification", back_populates="checkin")
    corrections = relationship("ManualCorrection", back_populates="checkin")


class ShiftSwap(Base):
    __tablename__ = "shift_swaps"

    id = Column(Integer, primary_key=True, index=True)
    shift_id = Column(Integer, ForeignKey("shifts.id"))
    requester_id = Column(Integer, ForeignKey("volunteers.id"))
    acceptor_id = Column(Integer, ForeignKey("volunteers.id"))
    reason = Column(Text)
    status = Column(Enum(SwapStatus), default=SwapStatus.PENDING)
    approver_id = Column(Integer)
    approval_remarks = Column(Text)
    approved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    shift = relationship("Shift", back_populates="swaps")
    requester = relationship("Volunteer", foreign_keys=[requester_id], back_populates="swap_requests")
    acceptor = relationship("Volunteer", foreign_keys=[acceptor_id], back_populates="swap_accepts")


class DurationCertification(Base):
    __tablename__ = "duration_certifications"

    id = Column(Integer, primary_key=True, index=True)
    volunteer_id = Column(Integer, ForeignKey("volunteers.id"))
    checkin_id = Column(Integer, ForeignKey("checkin_records.id"))
    claimed_duration = Column(Float, nullable=False)
    verified_duration = Column(Float)
    status = Column(Enum(CertificationStatus), default=CertificationStatus.PENDING)
    verifier_id = Column(Integer)
    verification_remarks = Column(Text)
    verified_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    volunteer = relationship("Volunteer", back_populates="certifications")
    checkin = relationship("CheckInRecord", back_populates="certifications")


class ServiceReport(Base):
    __tablename__ = "service_reports"

    id = Column(Integer, primary_key=True, index=True)
    volunteer_id = Column(Integer)
    start_date = Column(DateTime(timezone=True))
    end_date = Column(DateTime(timezone=True))
    total_hours = Column(Float, default=0.0)
    shift_count = Column(Integer, default=0)
    status = Column(Enum(ReportStatus), default=ReportStatus.DRAFT)
    export_format = Column(String(20))
    exported_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    details = relationship("ReportDetail", back_populates="report")


class ReportDetail(Base):
    __tablename__ = "report_details"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("service_reports.id"))
    shift_id = Column(Integer)
    shift_name = Column(String(100))
    location_name = Column(String(100))
    checkin_time = Column(DateTime(timezone=True))
    checkout_time = Column(DateTime(timezone=True))
    duration = Column(Float)
    status = Column(String(50))

    report = relationship("ServiceReport", back_populates="details")


class ExceptionLog(Base):
    __tablename__ = "exception_logs"

    id = Column(Integer, primary_key=True, index=True)
    exception_type = Column(Enum(ExceptionType), nullable=False)
    related_type = Column(String(50))
    related_id = Column(Integer)
    raw_input = Column(Text, nullable=False)
    error_message = Column(Text)
    handling_conclusion = Column(Text, nullable=False)
    handler_id = Column(Integer)
    handled_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ManualCorrection(Base):
    __tablename__ = "manual_corrections"

    id = Column(Integer, primary_key=True, index=True)
    checkin_id = Column(Integer, ForeignKey("checkin_records.id"))
    old_status = Column(String(50))
    new_status = Column(String(50))
    old_checkin_time = Column(DateTime(timezone=True))
    new_checkin_time = Column(DateTime(timezone=True))
    old_checkout_time = Column(DateTime(timezone=True))
    new_checkout_time = Column(DateTime(timezone=True))
    old_duration = Column(Float)
    new_duration = Column(Float)
    reason = Column(Text, nullable=False)
    corrector_id = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    checkin = relationship("CheckInRecord", back_populates="corrections")