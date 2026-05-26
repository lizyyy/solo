from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, unique=True, index=True, nullable=False)
    source_type = Column(String, nullable=False)
    file_name = Column(String)
    file_hash = Column(String, index=True)
    total_records = Column(Integer, default=0)
    processed_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="completed")

    records = relationship("ProcessedRecord", back_populates="batch")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    phone_masked = Column(String)
    id_card_masked = Column(String)
    disease_type = Column(String)
    birthday = Column(String)
    address_masked = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    purchase_records = relationship("PurchaseRecord", back_populates="customer")


class PurchaseRecord(Base):
    __tablename__ = "purchase_records"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(String, unique=True, index=True, nullable=False)
    customer_id = Column(String, ForeignKey("customers.customer_id"))
    drug_name = Column(String, nullable=False)
    drug_spec = Column(String)
    purchase_date = Column(DateTime, nullable=False)
    quantity = Column(Integer)
    dosage = Column(String)
    doctor = Column(String)
    batch_no = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="purchase_records")


class FollowupRule(Base):
    __tablename__ = "followup_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(String, unique=True, index=True, nullable=False)
    rule_type = Column(String, nullable=False)
    disease_type = Column(String)
    drug_name = Column(String)
    interval_days = Column(Integer)
    forbidden_drugs = Column(JSON)
    description = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ProcessedRecord(Base):
    __tablename__ = "processed_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    record_type = Column(String, nullable=False)
    source_id = Column(String)
    status = Column(String, nullable=False)
    result_category = Column(String, nullable=False)
    raw_data = Column(JSON)
    processed_data = Column(JSON)
    error_message = Column(String)
    suggestion = Column(Text)
    rule_matched = Column(JSON)
    trace_id = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="records")


class FollowupReminder(Base):
    __tablename__ = "followup_reminders"

    id = Column(Integer, primary_key=True, index=True)
    reminder_id = Column(String, unique=True, index=True, nullable=False)
    customer_id = Column(String, nullable=False)
    customer_name = Column(String)
    drug_name = Column(String)
    last_purchase_date = Column(DateTime)
    next_followup_date = Column(DateTime)
    reminder_type = Column(String)
    content = Column(Text)
    status = Column(String, default="pending")
    trace_id = Column(String, index=True)
    report_id = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
