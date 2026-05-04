from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class InspectionBatch(db.Model):
    __tablename__ = 'inspection_batches'
    
    id = db.Column(db.Integer, primary_key=True)
    batch_name = db.Column(db.String(200), nullable=False)
    inspection_date = db.Column(db.Date, nullable=False)
    inspector = db.Column(db.String(100))
    weather = db.Column(db.String(100))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    points = db.relationship('Point', backref='batch', lazy='dynamic', cascade='all, delete-orphan')
    temperature_records = db.relationship('TemperatureRecord', backref='batch', lazy='dynamic', cascade='all, delete-orphan')
    device_logs = db.relationship('DeviceLog', backref='batch', lazy='dynamic', cascade='all, delete-orphan')
    photos = db.relationship('Photo', backref='batch', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'batch_name': self.batch_name,
            'inspection_date': self.inspection_date.isoformat() if self.inspection_date else None,
            'inspector': self.inspector,
            'weather': self.weather,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Point(db.Model):
    __tablename__ = 'points'
    
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('inspection_batches.id'), nullable=False)
    point_code = db.Column(db.String(100), nullable=False)
    point_name = db.Column(db.String(200))
    point_type = db.Column(db.String(50))
    location = db.Column(db.String(200))
    section = db.Column(db.String(100))
    x_coordinate = db.Column(db.Float)
    y_coordinate = db.Column(db.Float)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    temperature_records = db.relationship('TemperatureRecord', backref='point', lazy='dynamic', cascade='all, delete-orphan')
    photos = db.relationship('Photo', backref='point', lazy='dynamic')
    risk_records = db.relationship('RiskRecord', backref='point', lazy='dynamic', cascade='all, delete-orphan')
    
    __table_args__ = (db.UniqueConstraint('batch_id', 'point_code'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'batch_id': self.batch_id,
            'point_code': self.point_code,
            'point_name': self.point_name,
            'point_type': self.point_type,
            'location': self.location,
            'section': self.section,
            'x_coordinate': self.x_coordinate,
            'y_coordinate': self.y_coordinate,
            'description': self.description
        }

class TemperatureRecord(db.Model):
    __tablename__ = 'temperature_records'
    
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('inspection_batches.id'), nullable=False)
    point_id = db.Column(db.Integer, db.ForeignKey('points.id'), nullable=False)
    record_time = db.Column(db.DateTime, nullable=False)
    temperature = db.Column(db.Float, nullable=False)
    ambient_temperature = db.Column(db.Float)
    max_temperature = db.Column(db.Float)
    min_temperature = db.Column(db.Float)
    temperature_difference = db.Column(db.Float)
    emissivity = db.Column(db.Float)
    distance = db.Column(db.Float)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'batch_id': self.batch_id,
            'point_id': self.point_id,
            'record_time': self.record_time.isoformat() if self.record_time else None,
            'temperature': self.temperature,
            'ambient_temperature': self.ambient_temperature,
            'max_temperature': self.max_temperature,
            'min_temperature': self.min_temperature,
            'temperature_difference': self.temperature_difference,
            'emissivity': self.emissivity,
            'distance': self.distance,
            'notes': self.notes
        }

class DeviceLog(db.Model):
    __tablename__ = 'device_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('inspection_batches.id'), nullable=False)
    log_time = db.Column(db.DateTime, nullable=False)
    device_code = db.Column(db.String(100))
    device_name = db.Column(db.String(200))
    log_level = db.Column(db.String(20))
    message = db.Column(db.Text, nullable=False)
    is_alert = db.Column(db.Boolean, default=False)
    is_closed = db.Column(db.Boolean, default=False)
    closed_by = db.Column(db.String(100))
    closed_at = db.Column(db.DateTime)
    close_reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'batch_id': self.batch_id,
            'log_time': self.log_time.isoformat() if self.log_time else None,
            'device_code': self.device_code,
            'device_name': self.device_name,
            'log_level': self.log_level,
            'message': self.message,
            'is_alert': self.is_alert,
            'is_closed': self.is_closed,
            'closed_by': self.closed_by,
            'closed_at': self.closed_at.isoformat() if self.closed_at else None,
            'close_reason': self.close_reason
        }

class Photo(db.Model):
    __tablename__ = 'photos'
    
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('inspection_batches.id'), nullable=False)
    point_id = db.Column(db.Integer, db.ForeignKey('points.id'))
    filename = db.Column(db.String(255), nullable=False)
    original_name = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    photo_type = db.Column(db.String(50))
    captured_at = db.Column(db.DateTime)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'batch_id': self.batch_id,
            'point_id': self.point_id,
            'filename': self.filename,
            'original_name': self.original_name,
            'file_path': self.file_path,
            'photo_type': self.photo_type,
            'captured_at': self.captured_at.isoformat() if self.captured_at else None,
            'notes': self.notes
        }

class RiskRecord(db.Model):
    __tablename__ = 'risk_records'
    
    id = db.Column(db.Integer, primary_key=True)
    point_id = db.Column(db.Integer, db.ForeignKey('points.id'), nullable=False)
    risk_type = db.Column(db.String(50), nullable=False)
    risk_level = db.Column(db.String(20), nullable=False)
    description = db.Column(db.Text)
    detected_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    temperature_value = db.Column(db.Float)
    temperature_trend = db.Column(db.String(100))
    related_log_id = db.Column(db.Integer, db.ForeignKey('device_logs.id'))
    manual_judgment = db.Column(db.String(20))
    judgment_notes = db.Column(db.Text)
    judged_by = db.Column(db.String(100))
    judged_at = db.Column(db.DateTime)
    is_closed = db.Column(db.Boolean, default=False)
    closed_by = db.Column(db.String(100))
    closed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    related_log = db.relationship('DeviceLog', backref='related_risks')
    review_records = db.relationship('ReviewRecord', backref='risk', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'point_id': self.point_id,
            'risk_type': self.risk_type,
            'risk_level': self.risk_level,
            'description': self.description,
            'detected_at': self.detected_at.isoformat() if self.detected_at else None,
            'temperature_value': self.temperature_value,
            'temperature_trend': self.temperature_trend,
            'related_log_id': self.related_log_id,
            'manual_judgment': self.manual_judgment,
            'judgment_notes': self.judgment_notes,
            'judged_by': self.judged_by,
            'judged_at': self.judged_at.isoformat() if self.judged_at else None,
            'is_closed': self.is_closed,
            'closed_by': self.closed_by,
            'closed_at': self.closed_at.isoformat() if self.closed_at else None
        }

class ReviewRecord(db.Model):
    __tablename__ = 'review_records'
    
    id = db.Column(db.Integer, primary_key=True)
    risk_id = db.Column(db.Integer, db.ForeignKey('risk_records.id'), nullable=False)
    reviewer = db.Column(db.String(100), nullable=False)
    review_time = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    review_result = db.Column(db.String(20), nullable=False)
    review_notes = db.Column(db.Text)
    follow_up_actions = db.Column(db.Text)
    recommended_review_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'risk_id': self.risk_id,
            'reviewer': self.reviewer,
            'review_time': self.review_time.isoformat() if self.review_time else None,
            'review_result': self.review_result,
            'review_notes': self.review_notes,
            'follow_up_actions': self.follow_up_actions,
            'recommended_review_date': self.recommended_review_date.isoformat() if self.recommended_review_date else None
        }
