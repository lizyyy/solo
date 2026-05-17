from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, ForeignKey, Enum, Float, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import enum

SQLALCHEMY_DATABASE_URL = "sqlite:///./travel_policy_exception.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class ExceptionStatus(str, enum.Enum):
    PENDING_APPROVAL = "pending_approval"
    EXCEPTION_REVIEW = "exception_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class ExceptionType(str, enum.Enum):
    HOTEL = "hotel"
    FLIGHT = "flight"
    BOTH = "both"


class ApprovalAction(str, enum.Enum):
    SUBMIT = "submit"
    ESCALATE = "escalate"
    APPROVE = "approve"
    REJECT = "reject"


class Employee(Base):
    __tablename__ = "employees"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    department = Column(String, index=True)
    level = Column(String)
    manager_id = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Destination(Base):
    __tablename__ = "destinations"

    id = Column(String, primary_key=True, index=True)
    city_code = Column(String, unique=True, index=True, nullable=False)
    city_name = Column(String, nullable=False)
    country = Column(String)
    region = Column(String)
    hotel_tier = Column(String)
    flight_class_allowed = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class PolicyClause(Base):
    __tablename__ = "policy_clauses"

    id = Column(String, primary_key=True, index=True)
    clause_code = Column(String, unique=True, index=True, nullable=False)
    category = Column(String, index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    max_hotel_rate = Column(Float)
    max_flight_discount = Column(Float)
    allowed_advance_days = Column(Integer)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ExceptionRequest(Base):
    __tablename__ = "exception_requests"

    id = Column(String, primary_key=True, index=True)
    request_idempotency_key = Column(String, unique=True, index=True, nullable=False)
    trip_id = Column(String, index=True, nullable=False)
    employee_id = Column(String, ForeignKey("employees.id"), nullable=False)
    destination_id = Column(String, ForeignKey("destinations.id"))
    exception_type = Column(Enum(ExceptionType), nullable=False)
    status = Column(Enum(ExceptionStatus), default=ExceptionStatus.PENDING_APPROVAL, index=True)
    
    hotel_policy_clause_id = Column(String, ForeignKey("policy_clauses.id"))
    hotel_actual_rate = Column(Float)
    hotel_justification = Column(Text)
    
    flight_policy_clause_id = Column(String, ForeignKey("policy_clauses.id"))
    flight_actual_discount = Column(Float)
    flight_justification = Column(Text)
    
    combined_justification = Column(Text)
    
    current_approver_id = Column(String, ForeignKey("employees.id"))
    submitted_at = Column(DateTime)
    reviewed_at = Column(DateTime)
    approved_at = Column(DateTime)
    rejected_at = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    employee = relationship("Employee", foreign_keys=[employee_id])
    current_approver = relationship("Employee", foreign_keys=[current_approver_id])
    destination = relationship("Destination")
    hotel_policy = relationship("PolicyClause", foreign_keys=[hotel_policy_clause_id])
    flight_policy = relationship("PolicyClause", foreign_keys=[flight_policy_clause_id])
    audit_logs = relationship("AuditLog", back_populates="request", cascade="all, delete-orphan")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, index=True)
    request_id = Column(String, ForeignKey("exception_requests.id"), nullable=False)
    actor_id = Column(String, ForeignKey("employees.id"), nullable=False)
    action = Column(Enum(ApprovalAction), nullable=False)
    from_status = Column(Enum(ExceptionStatus))
    to_status = Column(Enum(ExceptionStatus), nullable=False)
    comment = Column(Text)
    ip_address = Column(String)
    user_agent = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    request = relationship("ExceptionRequest", back_populates="audit_logs")
    actor = relationship("Employee")


class ImportValidation(Base):
    __tablename__ = "import_validations"

    id = Column(String, primary_key=True, index=True)
    batch_id = Column(String, index=True, nullable=False)
    row_number = Column(Integer, nullable=False)
    is_valid = Column(Boolean, default=False)
    raw_data = Column(Text)
    error_code = Column(String)
    error_message = Column(Text)
    error_field = Column(String)
    suggestion = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()