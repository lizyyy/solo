from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class SessionStatus(str, enum.Enum):
    PENDING = "pending"
    MATCHED = "matched"
    DISPUTED = "disputed"
    APPROVED = "approved"
    REJECTED = "rejected"


class DiscrepancyType(str, enum.Enum):
    CROSS_DAY = "cross_day"
    SUBSIDY_LIMIT = "subsidy_limit"
    REFUND_DEDUCTION = "refund_deduction"
    PRICE_MISMATCH = "price_mismatch"
    ATTENDANCE_MISMATCH = "attendance_mismatch"
    MIN_BOXOFFICE = "min_boxoffice"
    OTHER = "other"


class FilmContract(Base):
    __tablename__ = "film_contracts"

    id = Column(Integer, primary_key=True, index=True)
    film_name = Column(String(200), index=True, nullable=False)
    film_code = Column(String(50), unique=True, index=True)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    minimum_boxoffice = Column(Float, default=0)
    subsidy_per_ticket = Column(Float, default=0)
    subsidy_daily_cap = Column(Float, default=0)
    subsidy_total_cap = Column(Float, default=0)
    refund_deduction_rate = Column(Float, default=0.05)
    boxoffice_share_rate = Column(Float, default=0.43)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    sessions = relationship("Session", back_populates="contract")
    boxoffice_records = relationship("BoxOfficeRecord", back_populates="contract")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_code = Column(String(100), unique=True, index=True)
    film_name = Column(String(200), index=True)
    film_code = Column(String(50), index=True)
    hall_name = Column(String(100))
    show_time = Column(DateTime, index=True)
    end_time = Column(DateTime)
    is_cross_day = Column(Boolean, default=False)
    scheduled_seats = Column(Integer, default=0)
    ticket_price = Column(Float, default=0)
    contract_id = Column(Integer, ForeignKey("film_contracts.id"))
    source_file = Column(String(500))
    imported_at = Column(DateTime, server_default=func.now())

    contract = relationship("FilmContract", back_populates="sessions")
    boxoffice = relationship("BoxOfficeRecord", back_populates="session", uselist=False)
    reconciliation = relationship("ReconciliationRecord", back_populates="session", uselist=False)


class BoxOfficeRecord(Base):
    __tablename__ = "boxoffice_records"

    id = Column(Integer, primary_key=True, index=True)
    session_code = Column(String(100), index=True)
    film_name = Column(String(200), index=True)
    film_code = Column(String(50), index=True)
    show_time = Column(DateTime, index=True)
    tickets_sold = Column(Integer, default=0)
    tickets_refunded = Column(Integer, default=0)
    gross_boxoffice = Column(Float, default=0)
    refund_amount = Column(Float, default=0)
    net_boxoffice = Column(Float, default=0)
    service_fee = Column(Float, default=0)
    contract_id = Column(Integer, ForeignKey("film_contracts.id"))
    source_file = Column(String(500))
    imported_at = Column(DateTime, server_default=func.now())

    contract = relationship("FilmContract", back_populates="boxoffice_records")
    session = relationship("Session", back_populates="boxoffice")
    reconciliation = relationship("ReconciliationRecord", back_populates="boxoffice", uselist=False)


class ReconciliationRecord(Base):
    __tablename__ = "reconciliation_records"

    id = Column(Integer, primary_key=True, index=True)
    reconciliation_batch = Column(String(100), index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    boxoffice_id = Column(Integer, ForeignKey("boxoffice_records.id"))
    contract_id = Column(Integer, ForeignKey("film_contracts.id"))
    
    expected_subsidy = Column(Float, default=0)
    actual_subsidy = Column(Float, default=0)
    subsidy_discrepancy = Column(Float, default=0)
    
    expected_min_boxoffice = Column(Float, default=0)
    actual_boxoffice = Column(Float, default=0)
    min_boxoffice_discrepancy = Column(Float, default=0)
    
    refund_deduction = Column(Float, default=0)
    
    total_discrepancy = Column(Float, default=0)
    discrepancy_types = Column(String(500))
    discrepancy_explanation = Column(Text)
    
    status = Column(Enum(SessionStatus), default=SessionStatus.PENDING)
    reviewer_notes = Column(Text)
    reviewed_by = Column(String(100))
    reviewed_at = Column(DateTime)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    session = relationship("Session", back_populates="reconciliation")
    boxoffice = relationship("BoxOfficeRecord", back_populates="reconciliation")
    review_logs = relationship("ReviewLog", back_populates="reconciliation")


class ReviewLog(Base):
    __tablename__ = "review_logs"

    id = Column(Integer, primary_key=True, index=True)
    reconciliation_id = Column(Integer, ForeignKey("reconciliation_records.id"))
    previous_status = Column(Enum(SessionStatus))
    new_status = Column(Enum(SessionStatus))
    reviewer = Column(String(100))
    notes = Column(Text)
    discrepancy_explanation = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    reconciliation = relationship("ReconciliationRecord", back_populates="review_logs")


class ReconciliationSummary(Base):
    __tablename__ = "reconciliation_summaries"

    id = Column(Integer, primary_key=True, index=True)
    reconciliation_batch = Column(String(100), unique=True, index=True)
    total_sessions = Column(Integer, default=0)
    matched_sessions = Column(Integer, default=0)
    disputed_sessions = Column(Integer, default=0)
    approved_sessions = Column(Integer, default=0)
    rejected_sessions = Column(Integer, default=0)
    
    total_expected_subsidy = Column(Float, default=0)
    total_actual_subsidy = Column(Float, default=0)
    total_subsidy_discrepancy = Column(Float, default=0)
    
    total_expected_min_boxoffice = Column(Float, default=0)
    total_actual_boxoffice = Column(Float, default=0)
    total_min_boxoffice_discrepancy = Column(Float, default=0)
    
    total_refund_deduction = Column(Float, default=0)
    grand_total_discrepancy = Column(Float, default=0)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
