from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class TrainingClass(db.Model):
    __tablename__ = 'training_classes'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    training_date = db.Column(db.Date, nullable=False)
    instructor = db.Column(db.String(100))
    location = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    notes = db.Column(db.Text)
    
    students = db.relationship('Student', backref='training_class', lazy=True, cascade='all, delete-orphan')
    groups = db.relationship('Group', backref='training_class', lazy=True, cascade='all, delete-orphan')
    compression_data = db.relationship('CompressionData', backref='training_class', lazy=True, cascade='all, delete-orphan')
    aed_logs = db.relationship('AEDLog', backref='training_class', lazy=True, cascade='all, delete-orphan')
    compression_results = db.relationship('CompressionResult', backref='training_class', lazy=True, cascade='all, delete-orphan')
    aed_results = db.relationship('AEDResult', backref='training_class', lazy=True, cascade='all, delete-orphan')
    device_conflicts = db.relationship('DeviceConflict', backref='training_class', lazy=True, cascade='all, delete-orphan')
    retraining_records = db.relationship('Retraining', backref='training_class', lazy=True, cascade='all, delete-orphan')

class Student(db.Model):
    __tablename__ = 'students'
    
    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey('training_classes.id'), nullable=False)
    student_id = db.Column(db.String(50), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    gender = db.Column(db.String(10))
    age = db.Column(db.Integer)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    compression_data = db.relationship('CompressionData', backref='student', lazy=True)
    aed_logs = db.relationship('AEDLog', backref='student', lazy=True)
    compression_results = db.relationship('CompressionResult', backref='student', lazy=True)
    aed_results = db.relationship('AEDResult', backref='student', lazy=True)
    retraining_records = db.relationship('Retraining', backref='student', lazy=True)

class Group(db.Model):
    __tablename__ = 'groups'
    
    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey('training_classes.id'), nullable=False)
    group_number = db.Column(db.Integer, nullable=False)
    group_name = db.Column(db.String(100))
    device_id = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    students = db.relationship('Student', backref='group_info', lazy=True)

class CompressionData(db.Model):
    __tablename__ = 'compression_data'
    
    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey('training_classes.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'))
    device_id = db.Column(db.String(50))
    press_number = db.Column(db.Integer)
    depth_cm = db.Column(db.Float, nullable=False)
    rate = db.Column(db.Float)
    timestamp = db.Column(db.DateTime)
    session_id = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class AEDLog(db.Model):
    __tablename__ = 'aed_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey('training_classes.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'))
    device_id = db.Column(db.String(50))
    step_code = db.Column(db.String(50), nullable=False)
    step_name = db.Column(db.String(100))
    timestamp = db.Column(db.DateTime)
    duration_seconds = db.Column(db.Float)
    success = db.Column(db.Boolean, default=True)
    session_id = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class CompressionResult(db.Model):
    __tablename__ = 'compression_results'
    
    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey('training_classes.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    total_presses = db.Column(db.Integer, default=0)
    valid_presses = db.Column(db.Integer, default=0)
    depth_pass_count = db.Column(db.Integer, default=0)
    depth_pass_rate = db.Column(db.Float, default=0.0)
    rate_pass_count = db.Column(db.Integer, default=0)
    rate_pass_rate = db.Column(db.Float, default=0.0)
    avg_depth = db.Column(db.Float, default=0.0)
    avg_rate = db.Column(db.Float, default=0.0)
    min_depth = db.Column(db.Float)
    max_depth = db.Column(db.Float)
    min_rate = db.Column(db.Float)
    max_rate = db.Column(db.Float)
    consecutive_30_pass = db.Column(db.Boolean, default=False)
    overall_pass = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    notes = db.relationship('Note', backref='compression_result', lazy=True)

class AEDResult(db.Model):
    __tablename__ = 'aed_results'
    
    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey('training_classes.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    session_id = db.Column(db.String(50))
    steps_completed = db.Column(db.Integer, default=0)
    steps_missed = db.Column(db.Text)
    steps_missed_count = db.Column(db.Integer, default=0)
    steps_order_wrong_order = db.Column(db.Text)
    avg_step_duration = db.Column(db.Float, default=0.0)
    total_duration = db.Column(db.Float, default=0.0)
    failed_steps = db.Column(db.Text)
    overall_pass = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    notes = db.relationship('Note', backref='aed_result', lazy=True)

class DeviceConflict(db.Model):
    __tablename__ = 'device_conflicts'
    
    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey('training_classes.id'), nullable=False)
    device_id = db.Column(db.String(50), nullable=False)
    conflict_type = db.Column(db.String(50), nullable=False)
    student_1_id = db.Column(db.Integer, db.ForeignKey('students.id'))
    student_2_id = db.Column(db.Integer, db.ForeignKey('students.id'))
    time_start = db.Column(db.DateTime)
    time_end = db.Column(db.DateTime)
    duration_minutes = db.Column(db.Float)
    description = db.Column(db.Text)
    resolved = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Retraining(db.Model):
    __tablename__ = 'retraining'
    
    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey('training_classes.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    reason = db.Column(db.Text, nullable=False)
    reason_type = db.Column(db.String(50))
    severity = db.Column(db.String(20), default='normal')
    retraining_items = db.Column(db.Text)
    completed = db.Column(db.Boolean, default=False)
    completed_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Note(db.Model):
    __tablename__ = 'notes'
    
    id = db.Column(db.Integer, primary_key=True)
    compression_result_id = db.Column(db.Integer, db.ForeignKey('compression_results.id'))
    aed_result_id = db.Column(db.Integer, db.ForeignKey('aed_results.id'))
    note_type = db.Column(db.String(50), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_by = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UploadRecord(db.Model):
    __tablename__ = 'upload_records'
    
    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey('training_classes.id'))
    file_type = db.Column(db.String(50), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    stored_filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer)
    row_count = db.Column(db.Integer)
    processed = db.Column(db.Boolean, default=False)
    processed_at = db.Column(db.DateTime)
    error_message = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
