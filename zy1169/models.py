from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class PipelineStage:
    RAW_DATA = 'raw_data'
    CLEANING = 'cleaning'
    FEATURE_ENGINEERING = 'feature_engineering'
    TRAINING = 'training'
    VALIDATION = 'validation'
    TESTING = 'testing'
    DEPLOYMENT_REQUEST = 'deployment_request'
    DEPLOYED = 'deployed'

    @classmethod
    def get_stages(cls):
        return [
            cls.RAW_DATA,
            cls.CLEANING,
            cls.FEATURE_ENGINEERING,
            cls.TRAINING,
            cls.VALIDATION,
            cls.TESTING,
            cls.DEPLOYMENT_REQUEST,
            cls.DEPLOYED
        ]

class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    dataset_versions = db.relationship('DatasetVersion', backref='project', lazy=True, cascade='all, delete-orphan')
    cleaning_tasks = db.relationship('CleaningTask', backref='project', lazy=True, cascade='all, delete-orphan')
    feature_versions = db.relationship('FeatureVersion', backref='project', lazy=True, cascade='all, delete-orphan')
    training_runs = db.relationship('TrainingRun', backref='project', lazy=True, cascade='all, delete-orphan')
    test_cases = db.relationship('TestCase', backref='project', lazy=True, cascade='all, delete-orphan')
    deployment_requests = db.relationship('DeploymentRequest', backref='project', lazy=True, cascade='all, delete-orphan')

class DatasetVersion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    version = db.Column(db.String(20), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_name = db.Column(db.String(200), nullable=False)
    row_count = db.Column(db.Integer)
    column_count = db.Column(db.Integer)
    columns = db.Column(db.Text)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    quality_checks = db.relationship('DataQualityCheck', backref='dataset', lazy=True, cascade='all, delete-orphan')
    cleaning_tasks = db.relationship('CleaningTask', backref='dataset_version', lazy=True)

class DataQualityCheck(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    dataset_id = db.Column(db.Integer, db.ForeignKey('dataset_version.id'), nullable=False)
    check_type = db.Column(db.String(50), nullable=False)
    column_name = db.Column(db.String(100))
    status = db.Column(db.String(20), nullable=False)
    message = db.Column(db.Text)
    value = db.Column(db.Float)
    threshold = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class CleaningTask(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    dataset_version_id = db.Column(db.Integer, db.ForeignKey('dataset_version.id'), nullable=False)
    version = db.Column(db.String(20), nullable=False)
    rules_file_path = db.Column(db.String(500), nullable=False)
    rules_file_name = db.Column(db.String(200), nullable=False)
    output_file_path = db.Column(db.String(500))
    row_count_before = db.Column(db.Integer)
    row_count_after = db.Column(db.Integer)
    column_count_before = db.Column(db.Integer)
    column_count_after = db.Column(db.Integer)
    status = db.Column(db.String(20), default='pending')
    error_message = db.Column(db.Text)
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    cleaning_logs = db.relationship('CleaningLog', backref='cleaning_task', lazy=True, cascade='all, delete-orphan')
    feature_versions = db.relationship('FeatureVersion', backref='cleaning_task', lazy=True)

class CleaningLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cleaning_task_id = db.Column(db.Integer, db.ForeignKey('cleaning_task.id'), nullable=False)
    rule_name = db.Column(db.String(100), nullable=False)
    column_name = db.Column(db.String(100))
    action = db.Column(db.String(50))
    rows_affected = db.Column(db.Integer)
    message = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class FeatureVersion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    cleaning_task_id = db.Column(db.Integer, db.ForeignKey('cleaning_task.id'), nullable=False)
    version = db.Column(db.String(20), nullable=False)
    spec_file_path = db.Column(db.String(500), nullable=False)
    spec_file_name = db.Column(db.String(200), nullable=False)
    output_file_path = db.Column(db.String(500))
    feature_names = db.Column(db.Text)
    feature_count = db.Column(db.Integer)
    row_count = db.Column(db.Integer)
    status = db.Column(db.String(20), default='pending')
    error_message = db.Column(db.Text)
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    feature_checks = db.relationship('FeatureCheck', backref='feature_version', lazy=True, cascade='all, delete-orphan')
    training_runs = db.relationship('TrainingRun', backref='feature_version', lazy=True)

class FeatureCheck(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    feature_version_id = db.Column(db.Integer, db.ForeignKey('feature_version.id'), nullable=False)
    check_type = db.Column(db.String(50), nullable=False)
    feature_name = db.Column(db.String(100))
    status = db.Column(db.String(20), nullable=False)
    message = db.Column(db.Text)
    value = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class TrainingRun(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    feature_version_id = db.Column(db.Integer, db.ForeignKey('feature_version.id'), nullable=False)
    version = db.Column(db.String(20), nullable=False)
    config_file_path = db.Column(db.String(500), nullable=False)
    config_file_name = db.Column(db.String(200), nullable=False)
    model_file_path = db.Column(db.String(500))
    model_type = db.Column(db.String(100))
    hyperparameters = db.Column(db.Text)
    train_rows = db.Column(db.Integer)
    test_rows = db.Column(db.Integer)
    status = db.Column(db.String(20), default='pending')
    error_message = db.Column(db.Text)
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    validations = db.relationship('Validation', backref='training_run', lazy=True, cascade='all, delete-orphan')
    deployment_requests = db.relationship('DeploymentRequest', backref='training_run', lazy=True)

class Validation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    training_run_id = db.Column(db.Integer, db.ForeignKey('training_run.id'), nullable=False)
    threshold_file_path = db.Column(db.String(500))
    threshold_file_name = db.Column(db.String(200))
    metric_name = db.Column(db.String(100), nullable=False)
    value = db.Column(db.Float, nullable=False)
    threshold = db.Column(db.Float)
    status = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class TestCase(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    test_data_file = db.Column(db.String(500))
    expected_output = db.Column(db.Text)
    test_type = db.Column(db.String(50))
    status = db.Column(db.String(20), default='pending')
    last_run_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    test_results = db.relationship('TestResult', backref='test_case', lazy=True, cascade='all, delete-orphan')

class TestResult(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    test_case_id = db.Column(db.Integer, db.ForeignKey('test_case.id'), nullable=False)
    training_run_id = db.Column(db.Integer, db.ForeignKey('training_run.id'))
    actual_output = db.Column(db.Text)
    passed = db.Column(db.Boolean)
    duration_seconds = db.Column(db.Float)
    error_message = db.Column(db.Text)
    run_at = db.Column(db.DateTime, default=datetime.utcnow)

class DeploymentRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    training_run_id = db.Column(db.Integer, db.ForeignKey('training_run.id'), nullable=False)
    version = db.Column(db.String(20), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    requester = db.Column(db.String(100))
    status = db.Column(db.String(20), default='pending')
    deployment_type = db.Column(db.String(20), default='full')
    traffic_percentage = db.Column(db.Float, default=100.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    deployed_at = db.Column(db.DateTime)
    
    approvals = db.relationship('ApprovalRecord', backref='deployment_request', lazy=True, cascade='all, delete-orphan')
    audit_logs = db.relationship('AuditLog', backref='deployment_request', lazy=True)

class ApprovalRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    deployment_request_id = db.Column(db.Integer, db.ForeignKey('deployment_request.id'), nullable=False)
    approver = db.Column(db.String(100), nullable=False)
    action = db.Column(db.String(20), nullable=False)
    comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class AuditLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    deployment_request_id = db.Column(db.Integer, db.ForeignKey('deployment_request.id'))
    action = db.Column(db.String(100), nullable=False)
    actor = db.Column(db.String(100))
    details = db.Column(db.Text)
    ip_address = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
