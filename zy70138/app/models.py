
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Experiment(db.Model):
    __tablename__ = 'experiments'
    
    id = db.Column(db.String(64), primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(32), default='draft', nullable=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = db.Column(db.String(128), nullable=True)
    
    versions = db.relationship('ExperimentVersion', backref='experiment', 
                               lazy=True, cascade='all, delete-orphan',
                               order_by='ExperimentVersion.version_number')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'created_by': self.created_by,
            'versions_count': len(self.versions)
        }


class ExperimentVersion(db.Model):
    __tablename__ = 'experiment_versions'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    experiment_id = db.Column(db.String(64), db.ForeignKey('experiments.id'), nullable=False)
    version_number = db.Column(db.Integer, nullable=False)
    
    bucket_strategy = db.Column(db.String(64), nullable=False, default='hash_mod')
    bucket_key = db.Column(db.String(255), nullable=False, default='user_id')
    bucket_count = db.Column(db.Integer, nullable=False, default=100)
    
    treatment_config = db.Column(db.Text, nullable=False)
    is_frozen = db.Column(db.Boolean, default=False, nullable=False)
    frozen_at = db.Column(db.DateTime, nullable=True)
    frozen_by = db.Column(db.String(128), nullable=True)
    
    effective_start = db.Column(db.DateTime, nullable=True)
    effective_end = db.Column(db.DateTime, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    created_by = db.Column(db.String(128), nullable=True)
    
    __table_args__ = (
        db.UniqueConstraint('experiment_id', 'version_number', name='uq_experiment_version'),
    )
    
    treatments = db.relationship('Treatment', backref='version', 
                                 lazy=True, cascade='all, delete-orphan')
    
    user_assignments = db.relationship('UserAssignment', backref='version',
                                        lazy=True, cascade='all, delete-orphan')
    
    metrics = db.relationship('ExperimentMetric', backref='version',
                               lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'experiment_id': self.experiment_id,
            'version_number': self.version_number,
            'bucket_strategy': self.bucket_strategy,
            'bucket_key': self.bucket_key,
            'bucket_count': self.bucket_count,
            'treatment_config': self.treatment_config,
            'is_frozen': self.is_frozen,
            'frozen_at': self.frozen_at.isoformat() if self.frozen_at else None,
            'frozen_by': self.frozen_by,
            'effective_start': self.effective_start.isoformat() if self.effective_start else None,
            'effective_end': self.effective_end.isoformat() if self.effective_end else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'created_by': self.created_by
        }


class Treatment(db.Model):
    __tablename__ = 'treatments'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    version_id = db.Column(db.Integer, db.ForeignKey('experiment_versions.id'), nullable=False)
    name = db.Column(db.String(128), nullable=False)
    label = db.Column(db.String(255), nullable=True)
    
    bucket_start = db.Column(db.Integer, nullable=False)
    bucket_end = db.Column(db.Integer, nullable=False)
    traffic_percent = db.Column(db.Float, nullable=False)
    
    parameters = db.Column(db.Text, nullable=True)
    is_control = db.Column(db.Boolean, default=False, nullable=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    __table_args__ = (
        db.UniqueConstraint('version_id', 'name', name='uq_treatment_version_name'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'version_id': self.version_id,
            'name': self.name,
            'label': self.label,
            'bucket_start': self.bucket_start,
            'bucket_end': self.bucket_end,
            'traffic_percent': self.traffic_percent,
            'parameters': self.parameters,
            'is_control': self.is_control
        }


class UserAssignment(db.Model):
    __tablename__ = 'user_assignments'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    version_id = db.Column(db.Integer, db.ForeignKey('experiment_versions.id'), nullable=False)
    user_id = db.Column(db.String(255), nullable=False, index=True)
    
    bucket_number = db.Column(db.Integer, nullable=False)
    treatment_name = db.Column(db.String(128), nullable=False)
    
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    assignment_source = db.Column(db.String(64), default='real_time', nullable=False)
    
    __table_args__ = (
        db.UniqueConstraint('version_id', 'user_id', name='uq_user_assignment_version_user'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'version_id': self.version_id,
            'user_id': self.user_id,
            'bucket_number': self.bucket_number,
            'treatment_name': self.treatment_name,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
            'assignment_source': self.assignment_source
        }


class ExperimentMetric(db.Model):
    __tablename__ = 'experiment_metrics'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    version_id = db.Column(db.Integer, db.ForeignKey('experiment_versions.id'), nullable=False)
    user_id = db.Column(db.String(255), nullable=False, index=True)
    
    metric_name = db.Column(db.String(128), nullable=False, index=True)
    metric_value = db.Column(db.Float, nullable=False)
    
    treatment_name = db.Column(db.String(128), nullable=False)
    attribution_version = db.Column(db.Integer, nullable=True)
    
    event_time = db.Column(db.DateTime, nullable=False, index=True)
    attributed_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'version_id': self.version_id,
            'user_id': self.user_id,
            'metric_name': self.metric_name,
            'metric_value': self.metric_value,
            'treatment_name': self.treatment_name,
            'attribution_version': self.attribution_version,
            'event_time': self.event_time.isoformat() if self.event_time else None,
            'attributed_at': self.attributed_at.isoformat() if self.attributed_at else None
        }


class OperationLog(db.Model):
    __tablename__ = 'operation_logs'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    operation_type = db.Column(db.String(64), nullable=False, index=True)
    resource_type = db.Column(db.String(64), nullable=False)
    resource_id = db.Column(db.String(255), nullable=True, index=True)
    
    status = db.Column(db.String(32), nullable=False, default='pending')
    message = db.Column(db.Text, nullable=True)
    
    old_value = db.Column(db.Text, nullable=True)
    new_value = db.Column(db.Text, nullable=True)
    
    retry_count = db.Column(db.Integer, default=0, nullable=False)
    next_retry_at = db.Column(db.DateTime, nullable=True)
    
    operator = db.Column(db.String(128), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'operation_type': self.operation_type,
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'status': self.status,
            'message': self.message,
            'retry_count': self.retry_count,
            'next_retry_at': self.next_retry_at.isoformat() if self.next_retry_at else None,
            'operator': self.operator,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }


class VersionConflict(db.Model):
    __tablename__ = 'version_conflicts'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    experiment_id = db.Column(db.String(64), nullable=False, index=True)
    version_id = db.Column(db.Integer, nullable=True)
    
    conflict_type = db.Column(db.String(64), nullable=False)
    conflict_description = db.Column(db.Text, nullable=False)
    
    affected_users_count = db.Column(db.Integer, default=0, nullable=False)
    affected_metrics_count = db.Column(db.Integer, default=0, nullable=False)
    
    detected_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    resolved_at = db.Column(db.DateTime, nullable=True)
    resolution = db.Column(db.Text, nullable=True)
    
    status = db.Column(db.String(32), default='open', nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'experiment_id': self.experiment_id,
            'version_id': self.version_id,
            'conflict_type': self.conflict_type,
            'conflict_description': self.conflict_description,
            'affected_users_count': self.affected_users_count,
            'affected_metrics_count': self.affected_metrics_count,
            'detected_at': self.detected_at.isoformat() if self.detected_at else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'resolution': self.resolution,
            'status': self.status
        }
