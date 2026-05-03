from datetime import datetime
from app import db

class Scaffold(db.Model):
    __tablename__ = 'scaffolds'
    
    id = db.Column(db.Integer, primary_key=True)
    scaffold_no = db.Column(db.String(50), unique=True, nullable=False)
    area = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(200))
    height = db.Column(db.Float)
    type = db.Column(db.String(50))
    status = db.Column(db.String(20), default='applied')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    applications = db.relationship('ErectionApplication', backref='scaffold', lazy=True)
    acceptances = db.relationship('AcceptanceRecord', backref='scaffold', lazy=True)
    rectifications = db.relationship('RectificationRecord', backref='scaffold', lazy=True)
    work_permits = db.relationship('WorkPermit', backref='scaffold', lazy=True)

class ErectionApplication(db.Model):
    __tablename__ = 'erection_applications'
    
    id = db.Column(db.Integer, primary_key=True)
    scaffold_id = db.Column(db.Integer, db.ForeignKey('scaffolds.id'), nullable=False)
    application_no = db.Column(db.String(50), unique=True, nullable=False)
    applicant = db.Column(db.String(100))
    department = db.Column(db.String(100))
    application_date = db.Column(db.DateTime)
    expected_erection_date = db.Column(db.DateTime)
    description = db.Column(db.Text)
    status = db.Column(db.String(20), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class AcceptanceRecord(db.Model):
    __tablename__ = 'acceptance_records'
    
    id = db.Column(db.Integer, primary_key=True)
    scaffold_id = db.Column(db.Integer, db.ForeignKey('scaffolds.id'), nullable=False)
    acceptance_no = db.Column(db.String(50), unique=True, nullable=False)
    acceptance_date = db.Column(db.DateTime)
    next_reinspection_date = db.Column(db.DateTime)
    inspector = db.Column(db.String(100))
    photos = db.Column(db.JSON)
    issues_found = db.Column(db.Text)
    status = db.Column(db.String(20), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class RectificationRecord(db.Model):
    __tablename__ = 'rectification_records'
    
    id = db.Column(db.Integer, primary_key=True)
    scaffold_id = db.Column(db.Integer, db.ForeignKey('scaffolds.id'))
    rectification_no = db.Column(db.String(50), unique=True, nullable=False)
    issue_description = db.Column(db.Text)
    issue_date = db.Column(db.DateTime)
    responsible_person = db.Column(db.String(100))
    deadline = db.Column(db.DateTime)
    rectification_date = db.Column(db.DateTime)
    rectification_measures = db.Column(db.Text)
    verifier = db.Column(db.String(100))
    status = db.Column(db.String(20), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class WorkPermit(db.Model):
    __tablename__ = 'work_permits'
    
    id = db.Column(db.Integer, primary_key=True)
    scaffold_id = db.Column(db.Integer, db.ForeignKey('scaffolds.id'))
    permit_no = db.Column(db.String(50), unique=True, nullable=False)
    work_type = db.Column(db.String(30), nullable=False)
    area = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(200))
    start_time = db.Column(db.DateTime)
    end_time = db.Column(db.DateTime)
    applicant = db.Column(db.String(100))
    supervisor = db.Column(db.String(100))
    safety_measures = db.Column(db.Text)
    status = db.Column(db.String(20), default='active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class ConflictRecord(db.Model):
    __tablename__ = 'conflict_records'
    
    id = db.Column(db.Integer, primary_key=True)
    conflict_type = db.Column(db.String(50), nullable=False)
    area = db.Column(db.String(100), nullable=False)
    work_permit_1_id = db.Column(db.Integer, db.ForeignKey('work_permits.id'))
    work_permit_2_id = db.Column(db.Integer, db.ForeignKey('work_permits.id'))
    description = db.Column(db.Text)
    detection_time = db.Column(db.DateTime, default=datetime.utcnow)
    resolved = db.Column(db.Boolean, default=False)
    resolved_at = db.Column(db.DateTime)
    resolution_notes = db.Column(db.Text)

class OverdueRecord(db.Model):
    __tablename__ = 'overdue_records'
    
    id = db.Column(db.Integer, primary_key=True)
    scaffold_id = db.Column(db.Integer, db.ForeignKey('scaffolds.id'), nullable=False)
    acceptance_record_id = db.Column(db.Integer, db.ForeignKey('acceptance_records.id'))
    overdue_days = db.Column(db.Integer, default=0)
    detected_at = db.Column(db.DateTime, default=datetime.utcnow)
    resolved = db.Column(db.Boolean, default=False)
    resolved_at = db.Column(db.DateTime)
    resolution_notes = db.Column(db.Text)

class DailySummary(db.Model):
    __tablename__ = 'daily_summaries'
    
    id = db.Column(db.Integer, primary_key=True)
    summary_date = db.Column(db.Date, unique=True, nullable=False)
    total_scaffolds = db.Column(db.Integer, default=0)
    disabled_scaffolds = db.Column(db.Integer, default=0)
    overdue_scaffolds = db.Column(db.Integer, default=0)
    pending_rectifications = db.Column(db.Integer, default=0)
    closed_rectifications = db.Column(db.Integer, default=0)
    active_conflicts = db.Column(db.Integer, default=0)
    high_risk_areas = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
