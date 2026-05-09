from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

Base = declarative_base()

class Resident(Base):
    __tablename__ = 'residents'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    address = Column(String(200), nullable=False)
    phone = Column(String(20))
    bank_account = Column(String(50))
    created_at = Column(DateTime, default=datetime.now)
    
    bills = relationship('Bill', back_populates='resident')
    complaints = relationship('Complaint', back_populates='resident')


class Bill(Base):
    __tablename__ = 'bills'
    
    id = Column(Integer, primary_key=True)
    resident_id = Column(Integer, ForeignKey('residents.id'), nullable=False)
    bill_month = Column(String(7), nullable=False)
    utility_type = Column(String(20), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(String(20), default='unpaid')
    due_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    resident = relationship('Resident', back_populates='bills')
    reminders = relationship('Reminder', back_populates='bill')
    deduction_records = relationship('DeductionRecord', back_populates='bill')
    history = relationship('BillHistory', back_populates='bill')


class BillHistory(Base):
    __tablename__ = 'bill_history'
    
    id = Column(Integer, primary_key=True)
    bill_id = Column(Integer, ForeignKey('bills.id'), nullable=False)
    action = Column(String(50), nullable=False)
    old_status = Column(String(20))
    new_status = Column(String(20))
    note = Column(Text)
    operator = Column(String(100))
    created_at = Column(DateTime, default=datetime.now)
    
    bill = relationship('Bill', back_populates='history')


class ReminderStrategy(Base):
    __tablename__ = 'reminder_strategies'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    utility_type = Column(String(20), nullable=False)
    days_after_due = Column(Integer, nullable=False)
    channel = Column(String(20), nullable=False)
    message_template = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    max_reminders = Column(Integer, default=3)
    created_at = Column(DateTime, default=datetime.now)


class Reminder(Base):
    __tablename__ = 'reminders'
    
    id = Column(Integer, primary_key=True)
    bill_id = Column(Integer, ForeignKey('bills.id'), nullable=False)
    strategy_id = Column(Integer, ForeignKey('reminder_strategies.id'))
    reminder_count = Column(Integer, default=1)
    channel = Column(String(20), nullable=False)
    message = Column(Text)
    sent_at = Column(DateTime, default=datetime.now)
    status = Column(String(20), default='sent')
    
    bill = relationship('Bill', back_populates='reminders')


class DeductionRecord(Base):
    __tablename__ = 'deduction_records'
    
    id = Column(Integer, primary_key=True)
    bill_id = Column(Integer, ForeignKey('bills.id'), nullable=False)
    bank_transaction_id = Column(String(100))
    amount = Column(Float, nullable=False)
    status = Column(String(20), default='pending')
    failed_reason = Column(Text)
    processed_at = Column(DateTime, default=datetime.now)
    
    bill = relationship('Bill', back_populates='deduction_records')


class SupplyStatus(Base):
    __tablename__ = 'supply_status'
    
    id = Column(Integer, primary_key=True)
    resident_id = Column(Integer, ForeignKey('residents.id'), nullable=False)
    utility_type = Column(String(20), nullable=False)
    status = Column(String(20), default='active')
    reason = Column(Text)
    changed_at = Column(DateTime, default=datetime.now)
    changed_by = Column(String(100))


class Complaint(Base):
    __tablename__ = 'complaints'
    
    id = Column(Integer, primary_key=True)
    resident_id = Column(Integer, ForeignKey('residents.id'), nullable=False)
    complaint_type = Column(String(50), nullable=False)
    description = Column(Text)
    status = Column(String(20), default='open')
    shield_reminders = Column(Boolean, default=False)
    shield_until = Column(DateTime)
    created_at = Column(DateTime, default=datetime.now)
    resolved_at = Column(DateTime)
    
    resident = relationship('Resident', back_populates='complaints')


class ReminderReport(Base):
    __tablename__ = 'reminder_reports'
    
    id = Column(Integer, primary_key=True)
    report_month = Column(String(7), nullable=False)
    utility_type = Column(String(20), nullable=False)
    total_bills = Column(Integer, default=0)
    unpaid_bills = Column(Integer, default=0)
    reminders_sent = Column(Integer, default=0)
    successful_deductions = Column(Integer, default=0)
    complaints_received = Column(Integer, default=0)
    supply_cut_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)


engine = create_engine('sqlite:///utility_billing.db')
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
