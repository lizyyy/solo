import enum
from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class CustomerDemandStatus(str, enum.Enum):
    PENDING = "pending"
    MATCHING = "matching"
    TRIAL_SCHEDULED = "trial_scheduled"
    COMPLETED = "completed"
    CLOSED = "closed"


class AuntStatus(str, enum.Enum):
    AVAILABLE = "available"
    ON_TRIAL = "on_trial"
    WORKING = "working"
    INACTIVE = "inactive"


class TrialScheduleStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class DepositStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    REFUNDED = "refunded"
    CONVERTED = "converted"


class ReviewStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    REJECTED = "rejected"


class ConversionStatus(str, enum.Enum):
    PENDING = "pending"
    ELIGIBLE = "eligible"
    NOT_ELIGIBLE = "not_eligible"
    CONVERTED = "converted"
    REJECTED = "rejected"
    CLOSED = "closed"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String(100), index=True)
    entity_type = Column(String(100), index=True)
    entity_id = Column(Integer, index=True)
    original_input = Column(Text)
    handler = Column(String(100))
    conclusion = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CustomerDemand(Base):
    __tablename__ = "customer_demands"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String(100), index=True)
    customer_phone = Column(String(20), index=True)
    address = Column(String(255))
    service_type = Column(String(100))
    required_skills = Column(String(255))
    salary_expectation = Column(Float)
    work_time = Column(String(255))
    remarks = Column(Text)
    status = Column(Enum(CustomerDemandStatus), default=CustomerDemandStatus.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_closed = Column(Boolean, default=False)
    closed_reason = Column(Text)
    closed_by = Column(String(100))

    trial_schedules = relationship("TrialSchedule", back_populates="customer_demand")


class AuntProfile(Base):
    __tablename__ = "aunt_profiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), index=True)
    phone = Column(String(20), index=True)
    id_card = Column(String(20), unique=True, index=True)
    age = Column(Integer)
    experience_years = Column(Integer)
    skills = Column(String(255))
    certificates = Column(String(255))
    address = Column(String(255))
    remarks = Column(Text)
    status = Column(Enum(AuntStatus), default=AuntStatus.AVAILABLE)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    trial_schedules = relationship("TrialSchedule", back_populates="aunt")


class TrialSchedule(Base):
    __tablename__ = "trial_schedules"

    id = Column(Integer, primary_key=True, index=True)
    demand_id = Column(Integer, ForeignKey("customer_demands.id"))
    aunt_id = Column(Integer, ForeignKey("aunt_profiles.id"))
    trial_start_time = Column(DateTime, index=True)
    trial_end_time = Column(DateTime, index=True)
    trial_address = Column(String(255))
    trial_fee = Column(Float)
    status = Column(Enum(TrialScheduleStatus), default=TrialScheduleStatus.SCHEDULED)
    remarks = Column(Text)
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_cancelled = Column(Boolean, default=False)
    cancelled_reason = Column(Text)
    cancelled_by = Column(String(100))

    customer_demand = relationship("CustomerDemand", back_populates="trial_schedules")
    aunt = relationship("AuntProfile", back_populates="trial_schedules")
    deposits = relationship("Deposit", back_populates="trial_schedule")
    reviews = relationship("Review", back_populates="trial_schedule")
    conversion = relationship("Conversion", back_populates="trial_schedule", uselist=False)


class Deposit(Base):
    __tablename__ = "deposits"

    id = Column(Integer, primary_key=True, index=True)
    trial_schedule_id = Column(Integer, ForeignKey("trial_schedules.id"))
    amount = Column(Float)
    payment_method = Column(String(50))
    transaction_id = Column(String(100))
    paid_at = Column(DateTime)
    refunded_at = Column(DateTime)
    refund_reason = Column(Text)
    status = Column(Enum(DepositStatus), default=DepositStatus.PENDING)
    remarks = Column(Text)
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    trial_schedule = relationship("TrialSchedule", back_populates="deposits")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    trial_schedule_id = Column(Integer, ForeignKey("trial_schedules.id"))
    customer_id = Column(Integer)
    reviewer = Column(String(100))
    overall_rating = Column(Integer)
    skill_rating = Column(Integer)
    attitude_rating = Column(Integer)
    punctuality_rating = Column(Integer)
    hygiene_rating = Column(Integer)
    communication_rating = Column(Integer)
    comment = Column(Text)
    suggestion = Column(Text)
    status = Column(Enum(ReviewStatus), default=ReviewStatus.DRAFT)
    reviewed_by = Column(String(100))
    review_comment = Column(Text)
    reviewed_at = Column(DateTime)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_modified = Column(Boolean, default=False)
    modified_by = Column(String(100))
    modified_reason = Column(Text)

    trial_schedule = relationship("TrialSchedule", back_populates="reviews")


class Conversion(Base):
    __tablename__ = "conversions"

    id = Column(Integer, primary_key=True, index=True)
    trial_schedule_id = Column(Integer, ForeignKey("trial_schedules.id"), unique=True)
    status = Column(Enum(ConversionStatus), default=ConversionStatus.PENDING)
    contract_start_date = Column(DateTime)
    contract_end_date = Column(DateTime)
    contract_salary = Column(Float)
    contract_remarks = Column(Text)
    conclusion = Column(Text)
    decided_by = Column(String(100))
    decided_at = Column(DateTime)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_withdrawn = Column(Boolean, default=False)
    withdrawn_reason = Column(Text)
    withdrawn_by = Column(String(100))

    trial_schedule = relationship("TrialSchedule", back_populates="conversion")
