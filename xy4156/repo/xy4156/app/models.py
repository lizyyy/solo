from app import db
from datetime import datetime
from sqlalchemy import Enum
import enum


class HazardClass(enum.Enum):
    EXPLOSIVE = "爆炸品"
    FLAMMABLE = "易燃品"
    OXIDIZING = "氧化剂"
    TOXIC = "有毒品"
    CORROSIVE = "腐蚀品"
    COMPRESSED_GAS = "压缩气体"
    RADIOACTIVE = "放射性"
    ORDINARY = "普通试剂"


class WasteStatus(enum.Enum):
    ACTIVE = "正常接收"
    WARNING = "即将满"
    FULL = "已满"
    EXPIRED = "逾期"
    DISPOSED = "已处置"


class ReviewStatus(enum.Enum):
    PENDING = "待复核"
    APPROVED = "已通过"
    REJECTED = "已驳回"


class ReagentLedger(db.Model):
    __tablename__ = 'reagent_ledger'
    
    id = db.Column(db.Integer, primary_key=True)
    reagent_name = db.Column(db.String(200), nullable=False)
    cas_number = db.Column(db.String(50))
    hazard_class = db.Column(db.Enum(HazardClass), nullable=False)
    hazard_details = db.Column(db.Text)
    incompatible_with = db.Column(db.Text)
    is_low_temp = db.Column(db.Boolean, default=False)
    min_temp = db.Column(db.Float)
    max_temp = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    batches = db.relationship('Batch', backref='ledger', lazy=True)
    bottles = db.relationship('Bottle', backref='ledger', lazy=True)


class Cabinet(db.Model):
    __tablename__ = 'cabinet'
    
    id = db.Column(db.Integer, primary_key=True)
    cabinet_code = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(200))
    hazard_class = db.Column(db.Enum(HazardClass))
    is_low_temp = db.Column(db.Boolean, default=False)
    min_temp = db.Column(db.Float)
    max_temp = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    bottles = db.relationship('Bottle', backref='cabinet', lazy=True)
    temp_records = db.relationship('TemperatureRecord', backref='cabinet', lazy=True)


class Batch(db.Model):
    __tablename__ = 'batch'
    
    id = db.Column(db.Integer, primary_key=True)
    batch_number = db.Column(db.String(100), unique=True, nullable=False)
    ledger_id = db.Column(db.Integer, db.ForeignKey('reagent_ledger.id'), nullable=False)
    total_volume = db.Column(db.Float, nullable=False)
    remaining_volume = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20), default="mL")
    supplier = db.Column(db.String(200))
    manufactured_date = db.Column(db.Date)
    expiry_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    bottles = db.relationship('Bottle', backref='batch', lazy=True)
    dispensed_records = db.relationship('DispenseRecord', backref='batch', lazy=True)


class Bottle(db.Model):
    __tablename__ = 'bottle'
    
    id = db.Column(db.Integer, primary_key=True)
    bottle_code = db.Column(db.String(100), unique=True, nullable=False)
    ledger_id = db.Column(db.Integer, db.ForeignKey('reagent_ledger.id'), nullable=False)
    batch_id = db.Column(db.Integer, db.ForeignKey('batch.id'), nullable=False)
    cabinet_id = db.Column(db.Integer, db.ForeignKey('cabinet.id'))
    volume = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20), default="mL")
    status = db.Column(db.String(50), default="在库")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    dispensed_records = db.relationship('DispenseRecord', backref='bottle', lazy=True)


class DispenseRecord(db.Model):
    __tablename__ = 'dispense_record'
    
    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.String(100), unique=True, nullable=False)
    batch_id = db.Column(db.Integer, db.ForeignKey('batch.id'), nullable=False)
    bottle_id = db.Column(db.Integer, db.ForeignKey('bottle.id'))
    dispensed_volume = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20), default="mL")
    experiment_name = db.Column(db.String(200))
    user_name = db.Column(db.String(100))
    dispense_time = db.Column(db.DateTime, nullable=False)
    review_status = db.Column(db.Enum(ReviewStatus), default=ReviewStatus.PENDING)
    reviewed_by = db.Column(db.String(100))
    reviewed_at = db.Column(db.DateTime)
    review_comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TemperatureRecord(db.Model):
    __tablename__ = 'temperature_record'
    
    id = db.Column(db.Integer, primary_key=True)
    cabinet_id = db.Column(db.Integer, db.ForeignKey('cabinet.id'), nullable=False)
    temperature = db.Column(db.Float, nullable=False)
    record_time = db.Column(db.DateTime, nullable=False)
    is_alert = db.Column(db.Boolean, default=False)
    alert_reason = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class WasteBucket(db.Model):
    __tablename__ = 'waste_bucket'
    
    id = db.Column(db.Integer, primary_key=True)
    bucket_code = db.Column(db.String(50), unique=True, nullable=False)
    waste_type = db.Column(db.String(100), nullable=False)
    hazard_class = db.Column(db.Enum(HazardClass))
    max_volume = db.Column(db.Float, nullable=False)
    current_volume = db.Column(db.Float, default=0)
    unit = db.Column(db.String(20), default="L")
    status = db.Column(db.Enum(WasteStatus), default=WasteStatus.ACTIVE)
    start_date = db.Column(db.Date, nullable=False)
    expiry_days = db.Column(db.Integer, default=90)
    disposal_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    waste_records = db.relationship('WasteRecord', backref='bucket', lazy=True)


class WasteRecord(db.Model):
    __tablename__ = 'waste_record'
    
    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.String(100), unique=True, nullable=False)
    bucket_id = db.Column(db.Integer, db.ForeignKey('waste_bucket.id'), nullable=False)
    waste_name = db.Column(db.String(200))
    volume = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20), default="mL")
    user_name = db.Column(db.String(100))
    record_time = db.Column(db.DateTime, nullable=False)
    review_status = db.Column(db.Enum(ReviewStatus), default=ReviewStatus.PENDING)
    reviewed_by = db.Column(db.String(100))
    reviewed_at = db.Column(db.DateTime)
    review_comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class AuditLog(db.Model):
    __tablename__ = 'audit_log'
    
    id = db.Column(db.Integer, primary_key=True)
    action = db.Column(db.String(100), nullable=False)
    resource_type = db.Column(db.String(50))
    resource_id = db.Column(db.String(100))
    user_name = db.Column(db.String(100))
    details = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
