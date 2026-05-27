from datetime import datetime
from app import db

class Batch(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    batch_no = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), default='pending')
    created_by = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    remark = db.Column(db.Text)
    
    records = db.relationship('SettlementRecord', backref='batch', lazy=True)
    operation_logs = db.relationship('OperationLog', backref='batch', lazy=True)

class SettlementRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    record_no = db.Column(db.String(50), unique=True, nullable=False)
    batch_id = db.Column(db.Integer, db.ForeignKey('batch.id'), nullable=False)
    property_id = db.Column(db.String(50), nullable=False, index=True)
    room_no = db.Column(db.String(20))
    tenant_name = db.Column(db.String(50))
    checkin_date = db.Column(db.Date)
    checkout_date = db.Column(db.Date, index=True)
    deposit_receipt_no = db.Column(db.String(50), index=True)
    deposit_amount = db.Column(db.Numeric(10, 2))
    
    water_start = db.Column(db.Numeric(10, 2))
    water_end = db.Column(db.Numeric(10, 2))
    water_usage = db.Column(db.Numeric(10, 2))
    water_amount = db.Column(db.Numeric(10, 2))
    
    electricity_start = db.Column(db.Numeric(10, 2))
    electricity_end = db.Column(db.Numeric(10, 2))
    electricity_usage = db.Column(db.Numeric(10, 2))
    electricity_amount = db.Column(db.Numeric(10, 2))
    
    damage_amount = db.Column(db.Numeric(10, 2), default=0)
    cleaning_fee = db.Column(db.Numeric(10, 2), default=0)
    other_fees = db.Column(db.Numeric(10, 2), default=0)
    refund_amount = db.Column(db.Numeric(10, 2))
    actual_refund = db.Column(db.Numeric(10, 2))
    
    status = db.Column(db.String(20), default='pending')
    electricity_tier = db.Column(db.String(20))
    has_refund_reversal = db.Column(db.Boolean, default=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    evidences = db.relationship('Evidence', backref='record', lazy=True)
    operation_logs = db.relationship('OperationLog', backref='record', lazy=True)
    tier_details = db.relationship('ElectricityTierDetail', backref='record', lazy=True, cascade='all, delete-orphan')

class Evidence(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.Integer, db.ForeignKey('settlement_record.id'), nullable=False)
    evidence_type = db.Column(db.String(20), nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    file_name = db.Column(db.String(255), nullable=False)
    uploaded_by = db.Column(db.String(50), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    description = db.Column(db.Text)

class ElectricityTierDetail(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.Integer, db.ForeignKey('settlement_record.id'), nullable=False)
    tier_name = db.Column(db.String(50), nullable=False)
    usage = db.Column(db.Numeric(10, 2), nullable=False)
    unit_price = db.Column(db.Numeric(10, 4), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)

class OperationLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('batch.id'))
    record_id = db.Column(db.Integer, db.ForeignKey('settlement_record.id'))
    operation = db.Column(db.String(50), nullable=False)
    operator = db.Column(db.String(50), nullable=False)
    reason = db.Column(db.Text)
    old_status = db.Column(db.String(20))
    new_status = db.Column(db.String(20))
    operated_at = db.Column(db.DateTime, default=datetime.utcnow)
    ip_address = db.Column(db.String(50))

class RefundReversal(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.Integer, db.ForeignKey('settlement_record.id'), nullable=False)
    original_refund = db.Column(db.Numeric(10, 2), nullable=False)
    reversed_amount = db.Column(db.Numeric(10, 2), nullable=False)
    new_refund = db.Column(db.Numeric(10, 2), nullable=False)
    reason = db.Column(db.Text, nullable=False)
    operator = db.Column(db.String(50), nullable=False)
    operated_at = db.Column(db.DateTime, default=datetime.utcnow)
