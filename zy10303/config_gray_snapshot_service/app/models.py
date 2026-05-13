from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from enum import Enum

db = SQLAlchemy()


class BatchStatus(Enum):
    DRAFT = "draft"
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    ROLLED_BACK = "rolled_back"
    FAILED = "failed"


class ConfigVersion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    version_key = db.Column(db.String(128), unique=True, nullable=False)
    config_name = db.Column(db.String(128), nullable=False)
    config_content = db.Column(db.Text, nullable=False)
    version = db.Column(db.String(64), nullable=False)
    created_by = db.Column(db.String(64), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    description = db.Column(db.String(512))
    is_active = db.Column(db.Boolean, default=True)
    
    gray_conditions = db.relationship('GrayCondition', backref='config_version', lazy=True)
    release_batches = db.relationship('ReleaseBatch', backref='config_version', lazy=True)


class GrayCondition(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    condition_key = db.Column(db.String(128), unique=True, nullable=False)
    config_version_id = db.Column(db.Integer, db.ForeignKey('config_version.id'), nullable=False)
    condition_type = db.Column(db.String(64), nullable=False)
    condition_expression = db.Column(db.Text, nullable=False)
    description = db.Column(db.String(512))
    priority = db.Column(db.Integer, default=0)
    created_by = db.Column(db.String(64), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    hit_samples = db.relationship('HitSample', backref='gray_condition', lazy=True)


class ReleaseBatch(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    batch_key = db.Column(db.String(128), unique=True, nullable=False)
    config_version_id = db.Column(db.Integer, db.ForeignKey('config_version.id'), nullable=False)
    batch_name = db.Column(db.String(128), nullable=False)
    status = db.Column(db.Enum(BatchStatus), default=BatchStatus.DRAFT, nullable=False)
    target_percentage = db.Column(db.Integer, default=0)
    current_percentage = db.Column(db.Integer, default=0)
    start_time = db.Column(db.DateTime)
    end_time = db.Column(db.DateTime)
    created_by = db.Column(db.String(64), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_by = db.Column(db.String(64))
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)
    conclusion = db.Column(db.String(1024))
    
    hit_samples = db.relationship('HitSample', backref='release_batch', lazy=True)
    rollback_points = db.relationship('RollbackPoint', backref='release_batch', lazy=True)


class HitSample(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sample_key = db.Column(db.String(128), unique=True, nullable=False)
    batch_id = db.Column(db.Integer, db.ForeignKey('release_batch.id'), nullable=False)
    condition_id = db.Column(db.Integer, db.ForeignKey('gray_condition.id'), nullable=False)
    user_id = db.Column(db.String(128), nullable=False)
    user_attributes = db.Column(db.Text)
    hit_time = db.Column(db.DateTime, default=datetime.utcnow)
    hit_explanation = db.Column(db.String(512))
    request_id = db.Column(db.String(128))
    is_valid = db.Column(db.Boolean, default=True)


class RollbackPoint(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    rollback_key = db.Column(db.String(128), unique=True, nullable=False)
    batch_id = db.Column(db.Integer, db.ForeignKey('release_batch.id'), nullable=False)
    snapshot_content = db.Column(db.Text, nullable=False)
    created_by = db.Column(db.String(64), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_used = db.Column(db.Boolean, default=False)
    used_at = db.Column(db.DateTime)
    used_by = db.Column(db.String(64))
    description = db.Column(db.String(512))


class QueryToken(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    token_key = db.Column(db.String(128), unique=True, nullable=False)
    token_value = db.Column(db.String(256), unique=True, nullable=False)
    created_by = db.Column(db.String(64), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    permissions = db.Column(db.String(512))
    last_used_at = db.Column(db.DateTime)
    use_count = db.Column(db.Integer, default=0)


class AuditLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    operation_type = db.Column(db.String(64), nullable=False)
    resource_type = db.Column(db.String(64), nullable=False)
    resource_key = db.Column(db.String(128), nullable=False)
    operator = db.Column(db.String(64), nullable=False)
    operation_time = db.Column(db.DateTime, default=datetime.utcnow)
    request_id = db.Column(db.String(128))
    details = db.Column(db.Text)
    ip_address = db.Column(db.String(64))
