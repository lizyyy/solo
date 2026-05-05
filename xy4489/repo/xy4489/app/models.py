from datetime import datetime, date
from app import db

class Student(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    id_number = db.Column(db.String(50), unique=True, nullable=False)
    phone = db.Column(db.String(20))
    email = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    certificates = db.relationship('Certificate', backref='student', lazy='dynamic', cascade='all, delete-orphan')
    medical_records = db.relationship('MedicalRecord', backref='student', lazy='dynamic', cascade='all, delete-orphan')
    course_participations = db.relationship('CourseParticipation', backref='student', lazy='dynamic')

class Instructor(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    id_number = db.Column(db.String(50), unique=True, nullable=False)
    phone = db.Column(db.String(20))
    email = db.Column(db.String(100))
    license_number = db.Column(db.String(50), unique=True, nullable=False)
    license_expiry = db.Column(db.Date, nullable=False)
    max_students_per_dive = db.Column(db.Integer, default=4)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    courses = db.relationship('CourseSchedule', backref='instructor', lazy='dynamic')

class Certificate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('student.id'), nullable=False)
    cert_type = db.Column(db.String(50), nullable=False)
    cert_number = db.Column(db.String(50), unique=True, nullable=False)
    issue_date = db.Column(db.Date, nullable=False)
    expiry_date = db.Column(db.Date, nullable=False)
    issuing_organization = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class MedicalRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('student.id'), nullable=False)
    exam_date = db.Column(db.Date, nullable=False)
    expiry_date = db.Column(db.Date, nullable=False)
    doctor_name = db.Column(db.String(100))
    hospital = db.Column(db.String(100))
    fit_for_diving = db.Column(db.Boolean, default=True)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Cylinder(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    serial_number = db.Column(db.String(50), unique=True, nullable=False)
    capacity_liters = db.Column(db.Float, nullable=False)
    material = db.Column(db.String(20))
    manufacture_date = db.Column(db.Date)
    last_inspection_date = db.Column(db.Date, nullable=False)
    next_inspection_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), default='available')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    fill_records = db.relationship('CylinderFillRecord', backref='cylinder', lazy='dynamic')

class CylinderFillRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cylinder_id = db.Column(db.Integer, db.ForeignKey('cylinder.id'), nullable=False)
    fill_date = db.Column(db.DateTime, default=datetime.utcnow)
    pressure_bar = db.Column(db.Float, nullable=False)
    gas_type = db.Column(db.String(20), default='Air')
    filler_name = db.Column(db.String(100))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class DiveSite(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    location = db.Column(db.String(200))
    max_depth_meters = db.Column(db.Float)
    difficulty_level = db.Column(db.String(20))
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    forecasts = db.relationship('WeatherForecast', backref='dive_site', lazy='dynamic')
    courses = db.relationship('CourseSchedule', backref='dive_site', lazy='dynamic')

class WeatherForecast(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    dive_site_id = db.Column(db.Integer, db.ForeignKey('dive_site.id'), nullable=False)
    forecast_date = db.Column(db.Date, nullable=False)
    wind_speed_kmh = db.Column(db.Float, nullable=False)
    wind_direction = db.Column(db.String(20))
    wave_height_m = db.Column(db.Float, nullable=False)
    water_temp_c = db.Column(db.Float)
    visibility_m = db.Column(db.Float)
    current_strength = db.Column(db.String(20))
    forecast_source = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CourseSchedule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    course_name = db.Column(db.String(100), nullable=False)
    course_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    instructor_id = db.Column(db.Integer, db.ForeignKey('instructor.id'), nullable=False)
    dive_site_id = db.Column(db.Integer, db.ForeignKey('dive_site.id'), nullable=False)
    max_students = db.Column(db.Integer, default=4)
    status = db.Column(db.String(20), default='scheduled')
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    participations = db.relationship('CourseParticipation', backref='course', lazy='dynamic', cascade='all, delete-orphan')
    risk_assessments = db.relationship('RiskAssessment', backref='course', lazy='dynamic')

class CourseParticipation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('course_schedule.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('student.id'), nullable=False)
    cylinder_id = db.Column(db.Integer, db.ForeignKey('cylinder.id'))
    status = db.Column(db.String(20), default='registered')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class RiskAssessment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('course_schedule.id'), nullable=False)
    assessment_date = db.Column(db.DateTime, default=datetime.utcnow)
    overall_status = db.Column(db.String(20), nullable=False)
    risks = db.Column(db.Text)
    warnings = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    reviews = db.relationship('ReviewRecord', backref='risk_assessment', lazy='dynamic')

class ReviewRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    risk_assessment_id = db.Column(db.Integer, db.ForeignKey('risk_assessment.id'), nullable=False)
    reviewer_name = db.Column(db.String(100), nullable=False)
    review_date = db.Column(db.DateTime, default=datetime.utcnow)
    original_status = db.Column(db.String(20), nullable=False)
    revised_status = db.Column(db.String(20), nullable=False)
    reason = db.Column(db.Text, nullable=False)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
