from datetime import datetime
from app import db

class ConstructionApplication(db.Model):
    __tablename__ = 'construction_applications'
    
    id = db.Column(db.Integer, primary_key=True)
    application_id = db.Column(db.String(50), unique=True, nullable=False)
    project_name = db.Column(db.String(200), nullable=False)
    road_name = db.Column(db.String(200), nullable=False)
    road_section = db.Column(db.String(200), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    construction_type = db.Column(db.String(100))
    applicant = db.Column(db.String(100))
    contact_info = db.Column(db.String(200))
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    risks = db.relationship('RiskAssessment', backref='application', lazy='dynamic', 
                          cascade='all, delete-orphan')
    reviews = db.relationship('ReviewRecord', backref='application', lazy='dynamic',
                            cascade='all, delete-orphan')

class UndergroundPipeline(db.Model):
    __tablename__ = 'underground_pipelines'
    
    id = db.Column(db.Integer, primary_key=True)
    pipeline_id = db.Column(db.String(50), unique=True, nullable=False)
    pipeline_type = db.Column(db.String(50), nullable=False)  # gas, water, electricity, etc.
    material = db.Column(db.String(50))
    diameter = db.Column(db.Float)
    depth = db.Column(db.Float)
    buffer_distance = db.Column(db.Float, default=1.0)  # meters
    geometry = db.Column(db.Text, nullable=False)  # GeoJSON LineString
    road_name = db.Column(db.String(200))
    road_section = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class BusStop(db.Model):
    __tablename__ = 'bus_stops'
    
    id = db.Column(db.Integer, primary_key=True)
    stop_id = db.Column(db.String(50), unique=True, nullable=False)
    stop_name = db.Column(db.String(200), nullable=False)
    road_name = db.Column(db.String(200), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    bus_routes = db.Column(db.Text)  # JSON array of routes
    contact_person = db.Column(db.String(100))
    contact_phone = db.Column(db.String(50))
    notification_status = db.Column(db.String(20), default='pending')  # pending, notified
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class CalendarEvent(db.Model):
    __tablename__ = 'calendar_events'
    
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.String(50), unique=True, nullable=False)
    event_type = db.Column(db.String(50), nullable=False)  # noise_prohibition, exam
    event_name = db.Column(db.String(200), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time)
    end_time = db.Column(db.Time)
    affected_roads = db.Column(db.Text)  # JSON array of road names
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class RiskAssessment(db.Model):
    __tablename__ = 'risk_assessments'
    
    id = db.Column(db.Integer, primary_key=True)
    application_id = db.Column(db.Integer, db.ForeignKey('construction_applications.id'), nullable=False)
    risk_type = db.Column(db.String(50), nullable=False)
    # risk_type: duplicate_excavation, pipeline_buffer_violation, bus_stop_notification, schedule_conflict
    risk_level = db.Column(db.String(20), nullable=False)  # low, medium, high, critical
    description = db.Column(db.Text, nullable=False)
    affected_elements = db.Column(db.Text)  # JSON array of affected items
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    reviewed = db.Column(db.Boolean, default=False)
    review_decision = db.Column(db.String(20))  # approve, reject, modify
    review_comment = db.Column(db.Text)
    reviewed_at = db.Column(db.DateTime)
    reviewer = db.Column(db.String(100))

class ReviewRecord(db.Model):
    __tablename__ = 'review_records'
    
    id = db.Column(db.Integer, primary_key=True)
    application_id = db.Column(db.Integer, db.ForeignKey('construction_applications.id'), nullable=False)
    reviewer = db.Column(db.String(100), nullable=False)
    review_date = db.Column(db.DateTime, default=datetime.utcnow)
    decision = db.Column(db.String(20), nullable=False)  # approve, reject, modify, pending
    comments = db.Column(db.Text)
    next_steps = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
