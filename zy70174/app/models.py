from datetime import datetime
from app import db
from sqlalchemy import Index

class EvaluationSet(db.Model):
    __tablename__ = 'evaluation_sets'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, index=True)
    version = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.String(100))
    
    items = db.relationship('EvaluationItem', backref='evaluation_set', lazy=True, cascade='all, delete-orphan')
    tasks = db.relationship('DetectionTask', backref='evaluation_set', lazy=True)
    
    __table_args__ = (
        Index('ix_eval_set_name_version', 'name', 'version', unique=True),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'version': self.version,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'created_by': self.created_by,
            'item_count': len(self.items)
        }


class EvaluationItem(db.Model):
    __tablename__ = 'evaluation_items'
    
    id = db.Column(db.Integer, primary_key=True)
    evaluation_set_id = db.Column(db.Integer, db.ForeignKey('evaluation_sets.id'), nullable=False, index=True)
    item_id = db.Column(db.String(100), nullable=False)
    content = db.Column(db.Text, nullable=False)
    fingerprint = db.Column(db.String(128), nullable=False, index=True)
    fingerprint_type = db.Column(db.String(50), default='sha256')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    matches = db.relationship('PollutionMatch', backref='evaluation_item', lazy=True, cascade='all, delete-orphan')
    
    __table_args__ = (
        Index('ix_eval_item_set_item', 'evaluation_set_id', 'item_id', unique=True),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'evaluation_set_id': self.evaluation_set_id,
            'item_id': self.item_id,
            'content': self.content,
            'fingerprint': self.fingerprint,
            'fingerprint_type': self.fingerprint_type,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class TrainingDataFingerprint(db.Model):
    __tablename__ = 'training_data_fingerprints'
    
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('detection_tasks.id'), nullable=False, index=True)
    data_source = db.Column(db.String(500))
    content_hash = db.Column(db.String(128), nullable=False, index=True)
    hash_type = db.Column(db.String(50), default='sha256')
    raw_content_preview = db.Column(db.Text)
    meta_info = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    matches = db.relationship('PollutionMatch', backref='training_fingerprint', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'data_source': self.data_source,
            'content_hash': self.content_hash,
            'hash_type': self.hash_type,
            'raw_content_preview': self.raw_content_preview,
            'meta_info': self.meta_info,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


DETECTION_STATUS = [
    'pending',
    'scanning',
    'completed',
    'needs_confirmation',
    'confirmed_polluted',
    'confirmed_clean',
    'exempted',
    'failed'
]

TRANSITION_RULES = {
    'pending': ['scanning', 'failed'],
    'scanning': ['completed', 'needs_confirmation', 'failed'],
    'completed': ['needs_confirmation', 'exempted'],
    'needs_confirmation': ['confirmed_polluted', 'confirmed_clean', 'exempted'],
    'confirmed_polluted': ['exempted'],
    'confirmed_clean': ['exempted'],
    'exempted': [],
    'failed': ['pending', 'scanning']
}


class DetectionTask(db.Model):
    __tablename__ = 'detection_tasks'
    
    id = db.Column(db.Integer, primary_key=True)
    task_key = db.Column(db.String(255), nullable=False, unique=True, index=True)
    evaluation_set_id = db.Column(db.Integer, db.ForeignKey('evaluation_sets.id'), nullable=False)
    training_data_description = db.Column(db.Text)
    status = db.Column(db.String(50), nullable=False, default='pending', index=True)
    previous_status = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.String(100))
    last_updated_by = db.Column(db.String(100))
    
    fingerprints = db.relationship('TrainingDataFingerprint', backref='task', lazy=True, cascade='all, delete-orphan')
    matches = db.relationship('PollutionMatch', backref='task', lazy=True, cascade='all, delete-orphan')
    history = db.relationship('StatusHistory', backref='task', lazy=True, cascade='all, delete-orphan', order_by='StatusHistory.id')
    exemptions = db.relationship('ExemptionRecord', backref='task', lazy=True, cascade='all, delete-orphan')
    reports = db.relationship('DetectionReport', backref='task', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self, include_history=False, include_matches=False):
        result = {
            'id': self.id,
            'task_key': self.task_key,
            'evaluation_set_id': self.evaluation_set_id,
            'training_data_description': self.training_data_description,
            'status': self.status,
            'previous_status': self.previous_status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'created_by': self.created_by,
            'last_updated_by': self.last_updated_by
        }
        
        if include_history:
            result['history'] = [h.to_dict() for h in self.history]
        
        if include_matches:
            result['matches'] = [m.to_dict() for m in self.matches]
            result['exemptions'] = [e.to_dict() for e in self.exemptions]
        
        return result


class PollutionMatch(db.Model):
    __tablename__ = 'pollution_matches'
    
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('detection_tasks.id'), nullable=False, index=True)
    training_fingerprint_id = db.Column(db.Integer, db.ForeignKey('training_data_fingerprints.id'), nullable=False)
    evaluation_item_id = db.Column(db.Integer, db.ForeignKey('evaluation_items.id'), nullable=False, index=True)
    match_score = db.Column(db.Float, nullable=False)
    match_type = db.Column(db.String(50), nullable=False)
    match_details = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'training_fingerprint_id': self.training_fingerprint_id,
            'evaluation_item_id': self.evaluation_item_id,
            'match_score': self.match_score,
            'match_type': self.match_type,
            'match_details': self.match_details,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'evaluation_item': self.evaluation_item.to_dict() if self.evaluation_item else None,
            'training_fingerprint': self.training_fingerprint.to_dict() if self.training_fingerprint else None
        }


class StatusHistory(db.Model):
    __tablename__ = 'status_history'
    
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('detection_tasks.id'), nullable=False, index=True)
    from_status = db.Column(db.String(50))
    to_status = db.Column(db.String(50), nullable=False)
    changed_by = db.Column(db.String(100))
    change_reason = db.Column(db.Text)
    meta_info = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'from_status': self.from_status,
            'to_status': self.to_status,
            'changed_by': self.changed_by,
            'change_reason': self.change_reason,
            'meta_info': self.meta_info,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


EXEMPTION_REASONS = [
    'false_positive',
    'intended_duplicate',
    'data_anonymized',
    'administrative_decision',
    'other'
]


class ExemptionRecord(db.Model):
    __tablename__ = 'exemption_records'
    
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('detection_tasks.id'), nullable=False, index=True)
    match_id = db.Column(db.Integer, db.ForeignKey('pollution_matches.id'), nullable=True)
    reason = db.Column(db.String(100), nullable=False)
    justification = db.Column(db.Text, nullable=False)
    exempted_by = db.Column(db.String(100), nullable=False)
    expires_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('ix_exemption_task_match', 'task_id', 'match_id', unique=True),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'match_id': self.match_id,
            'reason': self.reason,
            'justification': self.justification,
            'exempted_by': self.exempted_by,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class DetectionReport(db.Model):
    __tablename__ = 'detection_reports'
    
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('detection_tasks.id'), nullable=False, index=True)
    report_type = db.Column(db.String(50), nullable=False)
    summary = db.Column(db.Text, nullable=False)
    findings = db.Column(db.JSON, nullable=False)
    generated_by = db.Column(db.String(100))
    generated_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'report_type': self.report_type,
            'summary': self.summary,
            'findings': self.findings,
            'generated_by': self.generated_by,
            'generated_at': self.generated_at.isoformat() if self.generated_at else None
        }
