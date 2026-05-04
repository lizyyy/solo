from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Tank(db.Model):
    __tablename__ = 'tanks'
    
    id = db.Column(db.Integer, primary_key=True)
    tank_code = db.Column(db.String(20), unique=True, nullable=False)
    tank_name = db.Column(db.String(100))
    tank_type = db.Column(db.String(50))
    location = db.Column(db.String(100))
    volume_liters = db.Column(db.Float)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    water_quality_records = db.relationship('WaterQualityRecord', backref='tank', lazy=True, cascade='all, delete-orphan')
    feeding_records = db.relationship('FeedingRecord', backref='tank', lazy=True, cascade='all, delete-orphan')
    water_change_records = db.relationship('WaterChangeRecord', backref='tank', lazy=True, cascade='all, delete-orphan')
    fish_records = db.relationship('FishRecord', backref='tank', lazy=True, cascade='all, delete-orphan')
    risks = db.relationship('Risk', backref='tank', lazy=True, cascade='all, delete-orphan')
    observations = db.relationship('Observation', backref='tank', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'tank_code': self.tank_code,
            'tank_name': self.tank_name,
            'tank_type': self.tank_type,
            'location': self.location,
            'volume_liters': self.volume_liters,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class WaterQualityRecord(db.Model):
    __tablename__ = 'water_quality_records'
    
    id = db.Column(db.Integer, primary_key=True)
    tank_id = db.Column(db.Integer, db.ForeignKey('tanks.id'), nullable=False)
    record_date = db.Column(db.Date, nullable=False)
    record_time = db.Column(db.Time)
    
    temp = db.Column(db.Float)
    salinity = db.Column(db.Float)
    ph = db.Column(db.Float)
    ammonia = db.Column(db.Float)
    
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'tank_id': self.tank_id,
            'tank_code': self.tank.tank_code if self.tank else None,
            'record_date': self.record_date.isoformat() if self.record_date else None,
            'record_time': self.record_time.isoformat() if self.record_time else None,
            'temp': self.temp,
            'salinity': self.salinity,
            'ph': self.ph,
            'ammonia': self.ammonia,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class FeedingRecord(db.Model):
    __tablename__ = 'feeding_records'
    
    id = db.Column(db.Integer, primary_key=True)
    tank_id = db.Column(db.Integer, db.ForeignKey('tanks.id'), nullable=False)
    record_date = db.Column(db.Date, nullable=False)
    record_time = db.Column(db.Time)
    
    feed_type = db.Column(db.String(100))
    feed_amount_g = db.Column(db.Float)
    feeder_name = db.Column(db.String(100))
    notes = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'tank_id': self.tank_id,
            'tank_code': self.tank.tank_code if self.tank else None,
            'record_date': self.record_date.isoformat() if self.record_date else None,
            'record_time': self.record_time.isoformat() if self.record_time else None,
            'feed_type': self.feed_type,
            'feed_amount_g': self.feed_amount_g,
            'feeder_name': self.feeder_name,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class WaterChangeRecord(db.Model):
    __tablename__ = 'water_change_records'
    
    id = db.Column(db.Integer, primary_key=True)
    tank_id = db.Column(db.Integer, db.ForeignKey('tanks.id'), nullable=False)
    change_date = db.Column(db.Date, nullable=False)
    
    change_percent = db.Column(db.Float)
    change_volume_liters = db.Column(db.Float)
    new_salinity = db.Column(db.Float)
    new_temp = db.Column(db.Float)
    notes = db.Column(db.Text)
    
    next_scheduled_date = db.Column(db.Date)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'tank_id': self.tank_id,
            'tank_code': self.tank.tank_code if self.tank else None,
            'change_date': self.change_date.isoformat() if self.change_date else None,
            'change_percent': self.change_percent,
            'change_volume_liters': self.change_volume_liters,
            'new_salinity': self.new_salinity,
            'new_temp': self.new_temp,
            'notes': self.notes,
            'next_scheduled_date': self.next_scheduled_date.isoformat() if self.next_scheduled_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class FishRecord(db.Model):
    __tablename__ = 'fish_records'
    
    id = db.Column(db.Integer, primary_key=True)
    tank_id = db.Column(db.Integer, db.ForeignKey('tanks.id'), nullable=False)
    
    fish_species = db.Column(db.String(100), nullable=False)
    fish_name = db.Column(db.String(100))
    quantity = db.Column(db.Integer, default=1)
    
    introduction_date = db.Column(db.Date, nullable=False)
    is_quarantined = db.Column(db.Boolean, default=True)
    quarantine_end_date = db.Column(db.Date)
    
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'tank_id': self.tank_id,
            'tank_code': self.tank.tank_code if self.tank else None,
            'fish_species': self.fish_species,
            'fish_name': self.fish_name,
            'quantity': self.quantity,
            'introduction_date': self.introduction_date.isoformat() if self.introduction_date else None,
            'is_quarantined': self.is_quarantined,
            'quarantine_end_date': self.quarantine_end_date.isoformat() if self.quarantine_end_date else None,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Observation(db.Model):
    __tablename__ = 'observations'
    
    id = db.Column(db.Integer, primary_key=True)
    tank_id = db.Column(db.Integer, db.ForeignKey('tanks.id'), nullable=False)
    
    observation_date = db.Column(db.Date, nullable=False)
    observation_time = db.Column(db.Time)
    
    observer_name = db.Column(db.String(100))
    observation_type = db.Column(db.String(50))
    description = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(20), default='normal')
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'tank_id': self.tank_id,
            'tank_code': self.tank.tank_code if self.tank else None,
            'observation_date': self.observation_date.isoformat() if self.observation_date else None,
            'observation_time': self.observation_time.isoformat() if self.observation_time else None,
            'observer_name': self.observer_name,
            'observation_type': self.observation_type,
            'description': self.description,
            'severity': self.severity,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Risk(db.Model):
    __tablename__ = 'risks'
    
    id = db.Column(db.Integer, primary_key=True)
    tank_id = db.Column(db.Integer, db.ForeignKey('tanks.id'), nullable=False)
    
    risk_type = db.Column(db.String(50), nullable=False)
    risk_level = db.Column(db.String(20), default='warning')
    description = db.Column(db.Text, nullable=False)
    
    detected_date = db.Column(db.Date, nullable=False)
    detected_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    source_record_id = db.Column(db.Integer)
    source_record_type = db.Column(db.String(50))
    
    review_status = db.Column(db.String(20), default='pending')
    review_comment = db.Column(db.Text)
    reviewed_by = db.Column(db.String(100))
    reviewed_at = db.Column(db.DateTime)
    
    resolution_status = db.Column(db.String(20), default='open')
    resolution_comment = db.Column(db.Text)
    resolved_at = db.Column(db.DateTime)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'tank_id': self.tank_id,
            'tank_code': self.tank.tank_code if self.tank else None,
            'tank_name': self.tank.tank_name if self.tank else None,
            'risk_type': self.risk_type,
            'risk_level': self.risk_level,
            'description': self.description,
            'detected_date': self.detected_date.isoformat() if self.detected_date else None,
            'detected_at': self.detected_at.isoformat() if self.detected_at else None,
            'source_record_id': self.source_record_id,
            'source_record_type': self.source_record_type,
            'review_status': self.review_status,
            'review_comment': self.review_comment,
            'reviewed_by': self.reviewed_by,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'resolution_status': self.resolution_status,
            'resolution_comment': self.resolution_comment,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

RISK_TYPES = {
    'WATER_QUALITY_OUT_OF_RANGE': '水质参数超出范围',
    'WATER_QUALITY_DRIFT': '水质参数漂移',
    'FEEDING_MISSING': '投喂记录缺失',
    'WATER_CHANGE_OVERDUE': '换水超期',
    'QUARANTINE_INCOMPLETE': '新鱼隔离未满',
    'OBSERVATION_ABNORMAL': '异常观察记录'
}

RISK_LEVELS = {
    'critical': '严重',
    'warning': '警告',
    'info': '提示'
}

REVIEW_STATUSES = {
    'pending': '待复核',
    'confirmed': '确认风险',
    'dismissed': '误报驳回',
    'resolved': '已处理'
}
