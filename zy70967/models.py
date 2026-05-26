from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Text, JSON

db = SQLAlchemy()


class Batch(db.Model):
    __tablename__ = 'batches'

    id = db.Column(db.Integer, primary_key=True)
    batch_number = db.Column(db.String(64), unique=True, nullable=False)
    name = db.Column(db.String(256), nullable=False)
    status = db.Column(db.String(32), nullable=False, default='pending')
    source_system = db.Column(db.String(64), nullable=True)
    total_count = db.Column(db.Integer, default=0)
    valid_count = db.Column(db.Integer, default=0)
    error_count = db.Column(db.Integer, default=0)
    duplicate_count = db.Column(db.Integer, default=0)
    created_by = db.Column(db.String(64), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    raw_materials = db.relationship('RawMaterial', backref='batch', lazy='dynamic',
                                   cascade='all, delete-orphan')
    writeback_tasks = db.relationship('WriteBackTask', backref='batch', lazy='dynamic',
                                      cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'batch_number': self.batch_number,
            'name': self.name,
            'status': self.status,
            'source_system': self.source_system,
            'total_count': self.total_count,
            'valid_count': self.valid_count,
            'error_count': self.error_count,
            'duplicate_count': self.duplicate_count,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class RawMaterial(db.Model):
    __tablename__ = 'raw_materials'

    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('batches.id'), nullable=False)
    material_hash = db.Column(db.String(128), nullable=False, index=True)
    line_number = db.Column(db.Integer, nullable=False)
    source_system = db.Column(db.String(64), nullable=True)
    raw_content = db.Column(JSON, nullable=False)
    is_duplicate = db.Column(db.Boolean, default=False)
    original_raw_material_id = db.Column(db.Integer, nullable=True)
    has_errors = db.Column(db.Boolean, default=False)
    validation_errors = db.Column(JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    record = db.relationship('QualityCheckRecord', backref='raw_material', uselist=False,
                             cascade='all, delete-orphan')

    def to_dict(self, include_content=True):
        result = {
            'id': self.id,
            'batch_id': self.batch_id,
            'material_hash': self.material_hash,
            'line_number': self.line_number,
            'source_system': self.source_system,
            'is_duplicate': self.is_duplicate,
            'original_raw_material_id': self.original_raw_material_id,
            'has_errors': self.has_errors,
            'validation_errors': self.validation_errors,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_content:
            result['raw_content'] = self.raw_content
        return result


class QualityCheckRecord(db.Model):
    __tablename__ = 'quality_check_records'

    id = db.Column(db.Integer, primary_key=True)
    raw_material_id = db.Column(db.Integer, db.ForeignKey('raw_materials.id'), nullable=False)
    appeal_number = db.Column(db.String(64), nullable=False, index=True)
    agent_id = db.Column(db.String(64), nullable=True, index=True)
    agent_name = db.Column(db.String(128), nullable=True)
    team_name = db.Column(db.String(128), nullable=True)
    call_time = db.Column(db.DateTime, nullable=True)
    call_duration = db.Column(db.Integer, nullable=True)
    appeal_type = db.Column(db.String(64), nullable=True)
    appeal_reason = db.Column(Text, nullable=True)
    original_score = db.Column(db.Float, nullable=True)
    original_conclusion = db.Column(db.String(32), nullable=True)
    current_score = db.Column(db.Float, nullable=True)
    current_conclusion = db.Column(db.String(32), nullable=True)
    final_score = db.Column(db.Float, nullable=True)
    final_conclusion = db.Column(db.String(32), nullable=True)
    status = db.Column(db.String(32), nullable=False, default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    process_logs = db.relationship('ProcessLog', backref='record', lazy='dynamic',
                                   cascade='all, delete-orphan')

    def to_dict(self, include_raw=True):
        result = {
            'id': self.id,
            'raw_material_id': self.raw_material_id,
            'appeal_number': self.appeal_number,
            'agent_id': self.agent_id,
            'agent_name': self.agent_name,
            'team_name': self.team_name,
            'call_time': self.call_time.isoformat() if self.call_time else None,
            'call_duration': self.call_duration,
            'appeal_type': self.appeal_type,
            'appeal_reason': self.appeal_reason,
            'original_score': self.original_score,
            'original_conclusion': self.original_conclusion,
            'current_score': self.current_score,
            'current_conclusion': self.current_conclusion,
            'final_score': self.final_score,
            'final_conclusion': self.final_conclusion,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        return result


class ProcessLog(db.Model):
    __tablename__ = 'process_logs'

    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.Integer, db.ForeignKey('quality_check_records.id'), nullable=False)
    action_type = db.Column(db.String(32), nullable=False)
    field_name = db.Column(db.String(64), nullable=True)
    old_value = db.Column(JSON, nullable=True)
    new_value = db.Column(JSON, nullable=True)
    operator = db.Column(db.String(64), nullable=False)
    reason = db.Column(Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'record_id': self.record_id,
            'action_type': self.action_type,
            'field_name': self.field_name,
            'old_value': self.old_value,
            'new_value': self.new_value,
            'operator': self.operator,
            'reason': self.reason,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class WriteBackTask(db.Model):
    __tablename__ = 'writeback_tasks'

    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('batches.id'), nullable=False)
    target_system = db.Column(db.String(64), nullable=False)
    status = db.Column(db.String(32), nullable=False, default='pending')
    total_count = db.Column(db.Integer, default=0)
    success_count = db.Column(db.Integer, default=0)
    failed_count = db.Column(db.Integer, default=0)
    error_details = db.Column(JSON, nullable=True)
    triggered_by = db.Column(db.String(64), nullable=False)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'batch_id': self.batch_id,
            'target_system': self.target_system,
            'status': self.status,
            'total_count': self.total_count,
            'success_count': self.success_count,
            'failed_count': self.failed_count,
            'error_details': self.error_details,
            'triggered_by': self.triggered_by,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
