from app import db
from datetime import datetime

class Dataset(db.Model):
    __tablename__ = 'datasets'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    source_type = db.Column(db.String(50), nullable=False)
    connection_info = db.Column(db.Text, nullable=False)
    table_name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    rules = db.relationship('QualityRule', backref='dataset', lazy='dynamic', cascade='all, delete-orphan', foreign_keys='QualityRule.dataset_id')
    tasks = db.relationship('CheckTask', backref='dataset', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'source_type': self.source_type,
            'table_name': self.table_name,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class QualityRule(db.Model):
    __tablename__ = 'quality_rules'
    
    RULE_TYPES = [
        'null_rate',
        'uniqueness',
        'value_range',
        'daily_fluctuation',
        'cross_table_consistency'
    ]
    
    CONFIRMATION_TYPES = [
        'true_positive',
        'false_positive',
        'pending'
    ]
    
    id = db.Column(db.Integer, primary_key=True)
    dataset_id = db.Column(db.Integer, db.ForeignKey('datasets.id'), nullable=False)
    rule_name = db.Column(db.String(100), nullable=False)
    rule_type = db.Column(db.String(50), nullable=False)
    column_name = db.Column(db.String(100))
    threshold_config = db.Column(db.Text, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    target_dataset_id = db.Column(db.Integer, db.ForeignKey('datasets.id'))
    target_column_name = db.Column(db.String(100))
    join_condition = db.Column(db.Text)
    
    results = db.relationship('CheckResult', backref='rule', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'dataset_id': self.dataset_id,
            'rule_name': self.rule_name,
            'rule_type': self.rule_type,
            'column_name': self.column_name,
            'threshold_config': self.threshold_config,
            'is_active': self.is_active,
            'target_dataset_id': self.target_dataset_id,
            'target_column_name': self.target_column_name,
            'join_condition': self.join_condition,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class CheckTask(db.Model):
    __tablename__ = 'check_tasks'
    
    STATUS_TYPES = [
        'pending',
        'running',
        'completed',
        'failed',
        'duplicate'
    ]
    
    id = db.Column(db.Integer, primary_key=True)
    dataset_id = db.Column(db.Integer, db.ForeignKey('datasets.id'), nullable=False)
    task_hash = db.Column(db.String(64), unique=True, nullable=False)
    status = db.Column(db.String(20), default='pending')
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    end_time = db.Column(db.DateTime)
    error_message = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    results = db.relationship('CheckResult', backref='task', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'dataset_id': self.dataset_id,
            'task_hash': self.task_hash,
            'status': self.status,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat()
        }

class CheckResult(db.Model):
    __tablename__ = 'check_results'
    
    RESULT_TYPES = [
        'passed',
        'failed',
        'config_error'
    ]
    
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('check_tasks.id'), nullable=False)
    rule_id = db.Column(db.Integer, db.ForeignKey('quality_rules.id'), nullable=False)
    result_type = db.Column(db.String(20), nullable=False)
    actual_value = db.Column(db.Float)
    expected_value = db.Column(db.Float)
    message = db.Column(db.Text)
    checked_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    samples = db.relationship('AnomalySample', backref='result', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'rule_id': self.rule_id,
            'result_type': self.result_type,
            'actual_value': self.actual_value,
            'expected_value': self.expected_value,
            'message': self.message,
            'checked_at': self.checked_at.isoformat()
        }

class AnomalySample(db.Model):
    __tablename__ = 'anomaly_samples'
    
    CONFIRMATION_TYPES = [
        'pending',
        'true_positive',
        'false_positive',
        'recurrence'
    ]
    
    id = db.Column(db.Integer, primary_key=True)
    result_id = db.Column(db.Integer, db.ForeignKey('check_results.id'), nullable=False)
    sample_data = db.Column(db.Text, nullable=False)
    sample_index = db.Column(db.Integer)
    confirmation_status = db.Column(db.String(20), default='pending')
    confirmed_by = db.Column(db.String(100))
    confirmed_at = db.Column(db.DateTime)
    confirmation_note = db.Column(db.Text)
    is_recurrence = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'result_id': self.result_id,
            'sample_data': self.sample_data,
            'sample_index': self.sample_index,
            'confirmation_status': self.confirmation_status,
            'confirmed_by': self.confirmed_by,
            'confirmed_at': self.confirmed_at.isoformat() if self.confirmed_at else None,
            'confirmation_note': self.confirmation_note,
            'is_recurrence': self.is_recurrence,
            'created_at': self.created_at.isoformat()
        }

class DailyReport(db.Model):
    __tablename__ = 'daily_reports'
    
    id = db.Column(db.Integer, primary_key=True)
    report_date = db.Column(db.Date, nullable=False, unique=True)
    dataset_id = db.Column(db.Integer, db.ForeignKey('datasets.id'), nullable=False)
    quality_score = db.Column(db.Float, nullable=False)
    total_rules = db.Column(db.Integer, default=0)
    passed_rules = db.Column(db.Integer, default=0)
    failed_rules = db.Column(db.Integer, default=0)
    config_errors = db.Column(db.Integer, default=0)
    total_anomalies = db.Column(db.Integer, default=0)
    confirmed_true = db.Column(db.Integer, default=0)
    confirmed_false = db.Column(db.Integer, default=0)
    pending_confirmation = db.Column(db.Integer, default=0)
    recurrence_count = db.Column(db.Integer, default=0)
    report_content = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint('report_date', 'dataset_id', name='unique_report_per_dataset_per_day'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'report_date': self.report_date.isoformat(),
            'dataset_id': self.dataset_id,
            'quality_score': self.quality_score,
            'total_rules': self.total_rules,
            'passed_rules': self.passed_rules,
            'failed_rules': self.failed_rules,
            'config_errors': self.config_errors,
            'total_anomalies': self.total_anomalies,
            'confirmed_true': self.confirmed_true,
            'confirmed_false': self.confirmed_false,
            'pending_confirmation': self.pending_confirmation,
            'recurrence_count': self.recurrence_count,
            'report_content': self.report_content,
            'created_at': self.created_at.isoformat()
        }
