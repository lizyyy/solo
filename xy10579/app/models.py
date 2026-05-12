from app import db
from datetime import datetime
from enum import Enum

class MeterType(Enum):
    WATER = 'water'
    ELECTRIC = 'electric'

class MeterStatus(Enum):
    ACTIVE = 'active'
    INACTIVE = 'inactive'
    SUSPENDED = 'suspended'

class ReadingType(Enum):
    ACTUAL = 'actual'
    ESTIMATED = 'estimated'
    CORRECTED = 'corrected'

class ReadingStatus(Enum):
    PENDING = 'pending'
    CONFIRMED = 'confirmed'
    DISPUTED = 'disputed'
    CORRECTED = 'corrected'

class AbnormalType(Enum):
    NEGATIVE_USAGE = 'negative_usage'
    HIGH_USAGE = 'high_usage'
    LOW_USAGE = 'low_usage'
    BACKWARD_READING = 'backward_reading'
    MISSING_READING = 'missing_reading'

class AbnormalStatus(Enum):
    DETECTED = 'detected'
    REVIEWING = 'reviewing'
    RESOLVED = 'resolved'
    DISMISSED = 'dismissed'

class BillStatus(Enum):
    DRAFT = 'draft'
    ISSUED = 'issued'
    PAID = 'paid'
    OVERDUE = 'overdue'
    CANCELLED = 'cancelled'
    CORRECTED = 'corrected'

class CorrectionType(Enum):
    READING_ERROR = 'reading_error'
    ESTIMATE_ERROR = 'estimate_error'
    PRICE_ADJUSTMENT = 'price_adjustment'
    METER_ERROR = 'meter_error'

class Meter(db.Model):
    __tablename__ = 'meters'
    
    id = db.Column(db.Integer, primary_key=True)
    meter_no = db.Column(db.String(50), unique=True, nullable=False)
    type = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), default=MeterStatus.ACTIVE.value)
    location = db.Column(db.String(200))
    customer_id = db.Column(db.String(50))
    customer_name = db.Column(db.String(100))
    initial_reading = db.Column(db.Float, default=0.0)
    current_reading = db.Column(db.Float, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    readings = db.relationship('MeterReading', backref='meter', lazy=True, cascade='all, delete-orphan')
    bills = db.relationship('Bill', backref='meter', lazy=True, cascade='all, delete-orphan')
    abnormals = db.relationship('AbnormalRecord', backref='meter', lazy=True, cascade='all, delete-orphan')

class MeterReading(db.Model):
    __tablename__ = 'meter_readings'
    
    id = db.Column(db.Integer, primary_key=True)
    meter_id = db.Column(db.Integer, db.ForeignKey('meters.id'), nullable=False)
    reading_value = db.Column(db.Float, nullable=False)
    previous_reading = db.Column(db.Float)
    usage = db.Column(db.Float)
    reading_type = db.Column(db.String(20), nullable=False)
    reading_time = db.Column(db.DateTime, default=datetime.utcnow)
    billing_period = db.Column(db.String(50))
    status = db.Column(db.String(20), default=ReadingStatus.CONFIRMED.value)
    reader = db.Column(db.String(100))
    remarks = db.Column(db.Text)
    is_estimated = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    history = db.relationship('ReadingHistory', backref='reading', lazy=True, cascade='all, delete-orphan')

class ReadingHistory(db.Model):
    __tablename__ = 'reading_history'
    
    id = db.Column(db.Integer, primary_key=True)
    reading_id = db.Column(db.Integer, db.ForeignKey('meter_readings.id'), nullable=False)
    old_value = db.Column(db.Float)
    new_value = db.Column(db.Float)
    old_type = db.Column(db.String(20))
    new_type = db.Column(db.String(20))
    old_status = db.Column(db.String(20))
    new_status = db.Column(db.String(20))
    operator = db.Column(db.String(100))
    reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class AbnormalRecord(db.Model):
    __tablename__ = 'abnormal_records'
    
    id = db.Column(db.Integer, primary_key=True)
    meter_id = db.Column(db.Integer, db.ForeignKey('meters.id'), nullable=False)
    reading_id = db.Column(db.Integer, db.ForeignKey('meter_readings.id'))
    abnormal_type = db.Column(db.String(50), nullable=False)
    detected_value = db.Column(db.Float)
    expected_min = db.Column(db.Float)
    expected_max = db.Column(db.Float)
    description = db.Column(db.Text)
    status = db.Column(db.String(20), default=AbnormalStatus.DETECTED.value)
    reviewer = db.Column(db.String(100))
    review_remark = db.Column(db.Text)
    reviewed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    history = db.relationship('AbnormalHistory', backref='abnormal', lazy=True, cascade='all, delete-orphan')

class AbnormalHistory(db.Model):
    __tablename__ = 'abnormal_history'
    
    id = db.Column(db.Integer, primary_key=True)
    abnormal_id = db.Column(db.Integer, db.ForeignKey('abnormal_records.id'), nullable=False)
    old_status = db.Column(db.String(20))
    new_status = db.Column(db.String(20))
    operator = db.Column(db.String(100))
    remark = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Bill(db.Model):
    __tablename__ = 'bills'
    
    id = db.Column(db.Integer, primary_key=True)
    bill_no = db.Column(db.String(50), unique=True, nullable=False)
    meter_id = db.Column(db.Integer, db.ForeignKey('meters.id'), nullable=False)
    billing_period = db.Column(db.String(50))
    reading_id = db.Column(db.Integer, db.ForeignKey('meter_readings.id'))
    previous_reading = db.Column(db.Float)
    current_reading = db.Column(db.Float)
    usage = db.Column(db.Float)
    unit_price = db.Column(db.Float)
    amount = db.Column(db.Float)
    status = db.Column(db.String(20), default=BillStatus.DRAFT.value)
    issued_at = db.Column(db.DateTime)
    paid_at = db.Column(db.DateTime)
    is_estimated = db.Column(db.Boolean, default=False)
    parent_bill_id = db.Column(db.Integer, db.ForeignKey('bills.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    corrections = db.relationship('CorrectionRecord', backref='bill', lazy=True, cascade='all, delete-orphan')
    history = db.relationship('BillHistory', backref='bill', lazy=True, cascade='all, delete-orphan')

class CorrectionRecord(db.Model):
    __tablename__ = 'correction_records'
    
    id = db.Column(db.Integer, primary_key=True)
    bill_id = db.Column(db.Integer, db.ForeignKey('bills.id'), nullable=False)
    correction_type = db.Column(db.String(50), nullable=False)
    old_previous_reading = db.Column(db.Float)
    old_current_reading = db.Column(db.Float)
    old_usage = db.Column(db.Float)
    old_amount = db.Column(db.Float)
    new_previous_reading = db.Column(db.Float)
    new_current_reading = db.Column(db.Float)
    new_usage = db.Column(db.Float)
    new_amount = db.Column(db.Float)
    difference_amount = db.Column(db.Float)
    operator = db.Column(db.String(100))
    reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class BillHistory(db.Model):
    __tablename__ = 'bill_history'
    
    id = db.Column(db.Integer, primary_key=True)
    bill_id = db.Column(db.Integer, db.ForeignKey('bills.id'), nullable=False)
    old_status = db.Column(db.String(20))
    new_status = db.Column(db.String(20))
    old_amount = db.Column(db.Float)
    new_amount = db.Column(db.Float)
    operator = db.Column(db.String(100))
    reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class SystemConfig(db.Model):
    __tablename__ = 'system_config'
    
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.String(500))
    description = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
