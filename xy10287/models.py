from app import db
from datetime import datetime

class InspectionRecord(db.Model):
    __tablename__ = 'inspection_records'
    
    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.String(100), unique=True, nullable=False)
    pump_room = db.Column(db.String(100), nullable=False)
    pump_name = db.Column(db.String(100), nullable=False)
    inspection_date = db.Column(db.DateTime, nullable=False)
    inspector = db.Column(db.String(100), nullable=False)
    noise_description = db.Column(db.Text, nullable=False)
    original_data = db.Column(db.Text)
    batch_id = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    acoustic_feature = db.relationship('AcousticFeature', backref='record', uselist=False, cascade='all, delete-orphan')
    anomaly_result = db.relationship('AnomalyResult', backref='record', uselist=False, cascade='all, delete-orphan')
    review = db.relationship('ReviewRecord', backref='record', uselist=False, cascade='all, delete-orphan')

class AcousticFeature(db.Model):
    __tablename__ = 'acoustic_features'
    
    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.String(100), db.ForeignKey('inspection_records.record_id'), unique=True, nullable=False)
    rms_level = db.Column(db.Float)
    peak_frequency = db.Column(db.Float)
    spectral_centroid = db.Column(db.Float)
    harmonic_ratio = db.Column(db.Float)
    noise_type_keywords = db.Column(db.Text)
    feature_vector = db.Column(db.Text)
    extraction_method = db.Column(db.String(100))
    extracted_at = db.Column(db.DateTime, default=datetime.utcnow)

class AnomalyResult(db.Model):
    __tablename__ = 'anomaly_results'
    
    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.String(100), db.ForeignKey('inspection_records.record_id'), unique=True, nullable=False)
    anomaly_type = db.Column(db.String(100))
    anomaly_level = db.Column(db.String(20))
    confidence_score = db.Column(db.Float)
    rule_matched = db.Column(db.Text)
    explanation = db.Column(db.Text)
    status = db.Column(db.String(20), default='pending')
    batch_id = db.Column(db.String(100), nullable=False)
    processed_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ReviewRecord(db.Model):
    __tablename__ = 'review_records'
    
    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.String(100), db.ForeignKey('inspection_records.record_id'), unique=True, nullable=False)
    reviewer = db.Column(db.String(100), nullable=False)
    review_comment = db.Column(db.Text)
    final_anomaly_type = db.Column(db.String(100))
    final_anomaly_level = db.Column(db.String(20))
    reviewed_at = db.Column(db.DateTime, default=datetime.utcnow)

class BatchRun(db.Model):
    __tablename__ = 'batch_runs'
    
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.String(100), unique=True, nullable=False)
    input_file = db.Column(db.String(200))
    total_records = db.Column(db.Integer, default=0)
    cleaned_records = db.Column(db.Integer, default=0)
    normal_count = db.Column(db.Integer, default=0)
    anomaly_count = db.Column(db.Integer, default=0)
    reviewed_count = db.Column(db.Integer, default=0)
    export_file = db.Column(db.String(200))
    run_at = db.Column(db.DateTime, default=datetime.utcnow)
