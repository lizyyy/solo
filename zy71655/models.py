from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Athlete(db.Model):
    __tablename__ = 'athletes'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    gender = db.Column(db.String(10))
    age = db.Column(db.Integer)
    weight = db.Column(db.Float)
    max_hr = db.Column(db.Integer)
    threshold_pace = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    runs = db.relationship('Run', backref='athlete', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'gender': self.gender,
            'age': self.age,
            'weight': self.weight,
            'max_hr': self.max_hr,
            'threshold_pace': self.threshold_pace
        }

class Run(db.Model):
    __tablename__ = 'runs'
    
    id = db.Column(db.Integer, primary_key=True)
    athlete_id = db.Column(db.Integer, db.ForeignKey('athletes.id'), nullable=False)
    title = db.Column(db.String(200))
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime)
    total_distance = db.Column(db.Float)
    total_duration = db.Column(db.Float)
    avg_pace = db.Column(db.Float)
    avg_hr = db.Column(db.Float)
    total_elevation_gain = db.Column(db.Float)
    temperature = db.Column(db.Float)
    humidity = db.Column(db.Float)
    status = db.Column(db.String(20), default='imported')
    coach_notes = db.Column(db.Text)
    source_file = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    track_points = db.relationship('TrackPoint', backref='run', lazy=True, cascade='all, delete-orphan')
    hr_records = db.relationship('HeartRateRecord', backref='run', lazy=True, cascade='all, delete-orphan')
    segments = db.relationship('Segment', backref='run', lazy=True, cascade='all, delete-orphan')
    anomalies = db.relationship('Anomaly', backref='run', lazy=True, cascade='all, delete-orphan')
    reports = db.relationship('AnalysisReport', backref='run', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self, include_related=False):
        data = {
            'id': self.id,
            'athlete_id': self.athlete_id,
            'athlete_name': self.athlete.name if self.athlete else None,
            'title': self.title,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'total_distance': self.total_distance,
            'total_duration': self.total_duration,
            'avg_pace': self.avg_pace,
            'avg_hr': self.avg_hr,
            'total_elevation_gain': self.total_elevation_gain,
            'status': self.status,
            'coach_notes': self.coach_notes,
            'anomalies_count': len(self.anomalies)
        }
        if include_related:
            data['segments'] = [s.to_dict() for s in self.segments]
            data['anomalies'] = [a.to_dict() for a in self.anomalies]
        return data

class TrackPoint(db.Model):
    __tablename__ = 'track_points'
    
    id = db.Column(db.Integer, primary_key=True)
    run_id = db.Column(db.Integer, db.ForeignKey('runs.id'), nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    distance = db.Column(db.Float)
    altitude = db.Column(db.Float)
    grade = db.Column(db.Float)
    speed = db.Column(db.Float)
    heart_rate = db.Column(db.Integer)
    cadence = db.Column(db.Integer)
    is_gap_detected = db.Column(db.Boolean, default=False)
    gap_reason = db.Column(db.String(200))
    
    def to_dict(self):
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat(),
            'latitude': self.latitude,
            'longitude': self.longitude,
            'distance': self.distance,
            'altitude': self.altitude,
            'grade': self.grade,
            'speed': self.speed,
            'heart_rate': self.heart_rate,
            'cadence': self.cadence,
            'is_gap_detected': self.is_gap_detected
        }

class HeartRateRecord(db.Model):
    __tablename__ = 'heart_rate_records'
    
    id = db.Column(db.Integer, primary_key=True)
    run_id = db.Column(db.Integer, db.ForeignKey('runs.id'), nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False)
    heart_rate = db.Column(db.Integer, nullable=False)
    source = db.Column(db.String(50))
    is_drifted = db.Column(db.Boolean, default=False)
    drift_amount = db.Column(db.Float)
    
    def to_dict(self):
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat(),
            'heart_rate': self.heart_rate,
            'source': self.source,
            'is_drifted': self.is_drifted,
            'drift_amount': self.drift_amount
        }

class Segment(db.Model):
    __tablename__ = 'segments'
    
    id = db.Column(db.Integer, primary_key=True)
    run_id = db.Column(db.Integer, db.ForeignKey('runs.id'), nullable=False)
    segment_number = db.Column(db.Integer, nullable=False)
    start_distance = db.Column(db.Float)
    end_distance = db.Column(db.Float)
    duration = db.Column(db.Float)
    avg_pace = db.Column(db.Float)
    avg_hr = db.Column(db.Float)
    max_hr = db.Column(db.Integer)
    min_hr = db.Column(db.Integer)
    avg_grade = db.Column(db.Float)
    elevation_gain = db.Column(db.Float)
    elevation_loss = db.Column(db.Float)
    cadence = db.Column(db.Float)
    pace_deviation = db.Column(db.Float)
    is_half_marathon_split = db.Column(db.Boolean, default=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'segment_number': self.segment_number,
            'start_distance': self.start_distance,
            'end_distance': self.end_distance,
            'duration': self.duration,
            'avg_pace': self.avg_pace,
            'avg_hr': self.avg_hr,
            'max_hr': self.max_hr,
            'min_hr': self.min_hr,
            'avg_grade': self.avg_grade,
            'elevation_gain': self.elevation_gain,
            'elevation_loss': self.elevation_loss,
            'cadence': self.cadence,
            'pace_deviation': self.pace_deviation
        }

class Anomaly(db.Model):
    __tablename__ = 'anomalies'
    
    id = db.Column(db.Integer, primary_key=True)
    run_id = db.Column(db.Integer, db.ForeignKey('runs.id'), nullable=False)
    anomaly_type = db.Column(db.String(50), nullable=False)
    severity = db.Column(db.String(20), default='medium')
    start_distance = db.Column(db.Float)
    end_distance = db.Column(db.Float)
    start_time = db.Column(db.DateTime)
    end_time = db.Column(db.DateTime)
    description = db.Column(db.Text)
    expected_value = db.Column(db.Float)
    actual_value = db.Column(db.Float)
    deviation_percent = db.Column(db.Float)
    impact = db.Column(db.String(500))
    is_confirmed = db.Column(db.Boolean, default=False)
    confirmed_by = db.Column(db.String(100))
    confirmed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'run_id': self.run_id,
            'anomaly_type': self.anomaly_type,
            'severity': self.severity,
            'start_distance': self.start_distance,
            'end_distance': self.end_distance,
            'description': self.description,
            'expected_value': self.expected_value,
            'actual_value': self.actual_value,
            'deviation_percent': self.deviation_percent,
            'impact': self.impact,
            'is_confirmed': self.is_confirmed
        }

class AnalysisReport(db.Model):
    __tablename__ = 'analysis_reports'
    
    id = db.Column(db.Integer, primary_key=True)
    run_id = db.Column(db.Integer, db.ForeignKey('runs.id'), nullable=False)
    report_type = db.Column(db.String(50), default='full')
    title = db.Column(db.String(200))
    summary = db.Column(db.Text)
    pace_trend = db.Column(db.Text)
    hr_trend = db.Column(db.Text)
    pacing_strategy = db.Column(db.Text)
    fatigue_analysis = db.Column(db.Text)
    recommendations = db.Column(db.Text)
    chart_paths = db.Column(db.Text)
    generated_at = db.Column(db.DateTime, default=datetime.utcnow)
    generated_by = db.Column(db.String(100), default='system')
    
    def to_dict(self):
        return {
            'id': self.id,
            'run_id': self.run_id,
            'report_type': self.report_type,
            'title': self.title,
            'summary': self.summary,
            'pace_trend': self.pace_trend,
            'hr_trend': self.hr_trend,
            'pacing_strategy': self.pacing_strategy,
            'fatigue_analysis': self.fatigue_analysis,
            'recommendations': self.recommendations,
            'chart_paths': self.chart_paths,
            'generated_at': self.generated_at.isoformat() if self.generated_at else None
        }

def init_db(app):
    with app.app_context():
        db.create_all()
