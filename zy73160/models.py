from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Problem(db.Model):
    __tablename__ = 'problems'
    id = db.Column(db.Integer, primary_key=True)
    problem_id = db.Column(db.String(50), unique=True, nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    matrix_data = db.Column(db.Text)
    current_status = db.Column(db.String(20), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    versions = db.relationship('ProblemVersion', backref='problem', lazy=True, cascade='all, delete-orphan')
    answers = db.relationship('ProblemAnswer', backref='problem', lazy=True, cascade='all, delete-orphan')
    check_results = db.relationship('CheckResult', backref='problem', lazy=True, cascade='all, delete-orphan')
    anomalies = db.relationship('AnomalyRecord', backref='problem', lazy=True, cascade='all, delete-orphan')


class ProblemVersion(db.Model):
    __tablename__ = 'problem_versions'
    id = db.Column(db.Integer, primary_key=True)
    problem_id = db.Column(db.Integer, db.ForeignKey('problems.id'), nullable=False)
    version = db.Column(db.Integer, nullable=False)
    remark = db.Column(db.Text)
    screenshot_path = db.Column(db.String(500))
    modified_by = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    change_log = db.Column(db.Text)


class Answer(db.Model):
    __tablename__ = 'answers'
    id = db.Column(db.Integer, primary_key=True)
    answer_id = db.Column(db.String(50), unique=True, nullable=False)
    version = db.Column(db.String(50), nullable=False)
    content = db.Column(db.Text, nullable=False)
    source = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    problems = db.relationship('ProblemAnswer', backref='answer', lazy=True, cascade='all, delete-orphan')


class ProblemAnswer(db.Model):
    __tablename__ = 'problem_answers'
    id = db.Column(db.Integer, primary_key=True)
    problem_id = db.Column(db.Integer, db.ForeignKey('problems.id'), nullable=False)
    answer_id = db.Column(db.Integer, db.ForeignKey('answers.id'), nullable=False)
    coverage_status = db.Column(db.String(20), default='pending')
    match_score = db.Column(db.Float)
    is_manual_override = db.Column(db.Boolean, default=False)
    override_reason = db.Column(db.Text)
    override_by = db.Column(db.String(50))
    override_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class CheckTask(db.Model):
    __tablename__ = 'check_tasks'
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(200), nullable=False)
    status = db.Column(db.String(20), default='running')
    params_version = db.Column(db.String(50))
    parameters = db.Column(db.Text)
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    created_by = db.Column(db.String(50))
    report_path = db.Column(db.String(500))
    results = db.relationship('CheckResult', backref='task', lazy=True, cascade='all, delete-orphan')


class CheckResult(db.Model):
    __tablename__ = 'check_results'
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('check_tasks.id'), nullable=False)
    problem_id = db.Column(db.Integer, db.ForeignKey('problems.id'), nullable=False)
    processing_status = db.Column(db.String(20), default='pending')
    calc_result = db.Column(db.Text)
    expected_result = db.Column(db.Text)
    diff_detail = db.Column(db.Text)
    is_anomaly = db.Column(db.Boolean, default=False)
    anomaly_type = db.Column(db.String(50))
    anomaly_explanation = db.Column(db.Text)
    is_manual_judgment = db.Column(db.Boolean, default=False)
    judgment_result = db.Column(db.String(20))
    judgment_reason = db.Column(db.Text)
    judgment_by = db.Column(db.String(50))
    judgment_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AnomalyRecord(db.Model):
    __tablename__ = 'anomaly_records'
    id = db.Column(db.Integer, primary_key=True)
    problem_id = db.Column(db.Integer, db.ForeignKey('problems.id'), nullable=False)
    anomaly_type = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, nullable=False)
    root_cause = db.Column(db.Text)
    is_resolved = db.Column(db.Boolean, default=False)
    resolution = db.Column(db.Text)
    detected_at = db.Column(db.DateTime, default=datetime.utcnow)
    resolved_at = db.Column(db.DateTime)
    reported_by = db.Column(db.String(50))


class CheckState(db.Model):
    __tablename__ = 'check_states'
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = db.Column(db.String(50))
