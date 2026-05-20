from sqlalchemy import Column, String, Float, Integer, DateTime, Boolean, ForeignKey, Text, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

Base = declarative_base()

class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    INVOICED = "invoiced"

class Customer(Base):
    __tablename__ = "customers"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    contact = Column(String)
    email = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

class PricingRule(Base):
    __tablename__ = "pricing_rules"
    id = Column(String, primary_key=True)
    version = Column(String, nullable=False)
    customer_id = Column(String, ForeignKey("customers.id"))
    free_quota = Column(Integer, default=0)
    price_per_call = Column(Float, nullable=False)
    effective_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime)
    is_active = Column(Boolean, default=True)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

class CallDetail(Base):
    __tablename__ = "call_details"
    id = Column(String, primary_key=True)
    customer_id = Column(String, ForeignKey("customers.id"))
    api_name = Column(String, nullable=False)
    call_time = Column(DateTime, nullable=False)
    response_time_ms = Column(Integer)
    status_code = Column(Integer)
    rule_version = Column(String)
    billing_period_id = Column(String, ForeignKey("billing_periods.id"))
    is_billed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class BillingPeriod(Base):
    __tablename__ = "billing_periods"
    id = Column(String, primary_key=True)
    customer_id = Column(String, ForeignKey("customers.id"))
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    is_locked = Column(Boolean, default=False)
    locked_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

class BillingSummary(Base):
    __tablename__ = "billing_summaries"
    id = Column(String, primary_key=True)
    billing_period_id = Column(String, ForeignKey("billing_periods.id"))
    rule_version = Column(String, nullable=False)
    total_calls = Column(Integer, default=0)
    free_calls = Column(Integer, default=0)
    billable_calls = Column(Integer, default=0)
    base_amount = Column(Float, default=0.0)
    manual_discount = Column(Float, default=0.0)
    final_amount = Column(Float, default=0.0)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Adjustment(Base):
    __tablename__ = "adjustments"
    id = Column(String, primary_key=True)
    billing_summary_id = Column(String, ForeignKey("billing_summaries.id"))
    adjustment_type = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    reason = Column(Text, nullable=False)
    adjusted_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(String, primary_key=True)
    billing_period_id = Column(String, ForeignKey("billing_periods.id"))
    invoice_number = Column(String, unique=True)
    total_amount = Column(Float, nullable=False)
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.DRAFT)
    rejection_reason = Column(Text)
    submitted_at = Column(DateTime)
    approved_at = Column(DateTime)
    rejected_at = Column(DateTime)
    invoiced_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class VarianceRecord(Base):
    __tablename__ = "variance_records"
    id = Column(String, primary_key=True)
    invoice_id = Column(String, ForeignKey("invoices.id"))
    rule_version = Column(String)
    variance_type = Column(String)
    expected_amount = Column(Float)
    actual_amount = Column(Float)
    variance_amount = Column(Float)
    description = Column(Text)
    source_rule = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
