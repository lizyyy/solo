from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class DataImport(db.Model):
    __tablename__ = 'data_imports'
    
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    file_hash = db.Column(db.String(64), unique=True, nullable=False)
    row_count = db.Column(db.Integer, default=0)
    import_time = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(50), default='imported')
    processed_count = db.Column(db.Integer, default=0)
    
    sales_records = db.relationship('SalesRecord', backref='data_import', lazy=True, cascade='all, delete-orphan')
    predictions = db.relationship('IcePrediction', backref='data_import', lazy=True, cascade='all, delete-orphan')

class Location(db.Model):
    __tablename__ = 'locations'
    
    id = db.Column(db.Integer, primary_key=True)
    location_id = db.Column(db.String(100), unique=True, nullable=False)
    name = db.Column(db.String(255), nullable=False)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    zone = db.Column(db.String(100))
    capacity = db.Column(db.Float, default=100.0)
    is_outdoor = db.Column(db.Boolean, default=True)
    priority = db.Column(db.Integer, default=1)
    
    sales_records = db.relationship('SalesRecord', backref='location', lazy=True)
    predictions = db.relationship('IcePrediction', backref='location', lazy=True)

class SalesRecord(db.Model):
    __tablename__ = 'sales_records'
    
    id = db.Column(db.Integer, primary_key=True)
    import_id = db.Column(db.Integer, db.ForeignKey('data_imports.id'), nullable=False)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    time_hour = db.Column(db.Integer)
    sales_volume = db.Column(db.Float, nullable=False)
    ice_consumed = db.Column(db.Float, default=0.0)
    temperature = db.Column(db.Float)
    humidity = db.Column(db.Float)
    is_weekend = db.Column(db.Boolean, default=False)
    is_holiday = db.Column(db.Boolean, default=False)
    event_type = db.Column(db.String(100))
    
    __table_args__ = (
        db.UniqueConstraint('import_id', 'location_id', 'date', 'time_hour', name='_sales_unique'),
    )

class WeatherFeature(db.Model):
    __tablename__ = 'weather_features'
    
    id = db.Column(db.Integer, primary_key=True)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    hour = db.Column(db.Integer)
    temperature = db.Column(db.Float)
    humidity = db.Column(db.Float)
    wind_speed = db.Column(db.Float)
    uv_index = db.Column(db.Float)
    is_high_temp = db.Column(db.Boolean, default=False)
    temp_category = db.Column(db.String(20))
    heat_score = db.Column(db.Float, default=0.0)

class IcePrediction(db.Model):
    __tablename__ = 'ice_predictions'
    
    id = db.Column(db.Integer, primary_key=True)
    import_id = db.Column(db.Integer, db.ForeignKey('data_imports.id'), nullable=False)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id'), nullable=False)
    prediction_date = db.Column(db.Date, nullable=False)
    prediction_hour = db.Column(db.Integer)
    predicted_depletion_hours = db.Column(db.Float)
    ice_remaining = db.Column(db.Float)
    recommended_refill = db.Column(db.Float, default=0.0)
    urgency_score = db.Column(db.Float, default=0.0)
    priority_level = db.Column(db.String(20), default='low')
    prediction_reason = db.Column(db.Text)
    human_reviewed = db.Column(db.Boolean, default=False)
    review_status = db.Column(db.String(50), default='pending')
    review_note = db.Column(db.Text)
    reviewed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint('import_id', 'location_id', 'prediction_date', 'prediction_hour', name='_prediction_unique'),
    )

class ExportLog(db.Model):
    __tablename__ = 'export_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    import_id = db.Column(db.Integer, db.ForeignKey('data_imports.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    export_time = db.Column(db.DateTime, default=datetime.utcnow)
    record_count = db.Column(db.Integer, default=0)
    status = db.Column(db.String(50), default='success')
