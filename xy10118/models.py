from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.dialects.sqlite import JSON

db = SQLAlchemy()

class Alert(db.Model):
    __tablename__ = 'alerts'
    
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(100), nullable=False, index=True)
    alert_type = db.Column(db.String(100), nullable=False)
    message = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(20), default='warning')
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    source = db.Column(db.String(100))
    raw_data = db.Column(JSON)
    
    import_session_id = db.Column(db.Integer, db.ForeignKey('import_sessions.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    merge_group_id = db.Column(db.Integer, db.ForeignKey('merge_groups.id'), nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'alert_type': self.alert_type,
            'message': self.message,
            'severity': self.severity,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'source': self.source,
            'merge_group_id': self.merge_group_id
        }

class ImportSession(db.Model):
    __tablename__ = 'import_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    record_count = db.Column(db.Integer, default=0)
    imported_by = db.Column(db.String(100), default='system')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.Text)
    
    alerts = db.relationship('Alert', backref='import_session', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'record_count': self.record_count,
            'imported_by': self.imported_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'notes': self.notes
        }

class MergeGroup(db.Model):
    __tablename__ = 'merge_groups'
    
    id = db.Column(db.Integer, primary_key=True)
    group_name = db.Column(db.String(255), nullable=False)
    representative_alert_id = db.Column(db.Integer, db.ForeignKey('alerts.id'))
    device_id = db.Column(db.String(100), nullable=False, index=True)
    alert_count = db.Column(db.Integer, default=0)
    explanation = db.Column(db.Text)
    similarity_score = db.Column(db.Float, default=0.0)
    status = db.Column(db.String(20), default='pending')
    review_status = db.Column(db.String(20), default='pending')
    reviewer = db.Column(db.String(100))
    reviewed_at = db.Column(db.DateTime)
    review_notes = db.Column(db.Text)
    
    merge_version_id = db.Column(db.Integer, db.ForeignKey('merge_versions.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    alerts = db.relationship('Alert', backref='merge_group', foreign_keys='Alert.merge_group_id', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'group_name': self.group_name,
            'representative_alert_id': self.representative_alert_id,
            'device_id': self.device_id,
            'alert_count': self.alert_count,
            'explanation': self.explanation,
            'similarity_score': self.similarity_score,
            'status': self.status,
            'review_status': self.review_status,
            'reviewer': self.reviewer,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'review_notes': self.review_notes,
            'merge_version_id': self.merge_version_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class MergeVersion(db.Model):
    __tablename__ = 'merge_versions'
    
    id = db.Column(db.Integer, primary_key=True)
    version_number = db.Column(db.String(20), nullable=False)
    description = db.Column(db.Text)
    algorithm_config = db.Column(JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.String(100), default='system')
    group_count = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    
    groups = db.relationship('MergeGroup', backref='merge_version', lazy='dynamic')
    corrections = db.relationship('CorrectionHistory', backref='merge_version', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'version_number': self.version_number,
            'description': self.description,
            'algorithm_config': self.algorithm_config,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'created_by': self.created_by,
            'group_count': self.group_count,
            'is_active': self.is_active
        }

class CorrectionHistory(db.Model):
    __tablename__ = 'correction_history'
    
    id = db.Column(db.Integer, primary_key=True)
    merge_version_id = db.Column(db.Integer, db.ForeignKey('merge_versions.id'))
    alert_id = db.Column(db.Integer, db.ForeignKey('alerts.id'))
    original_group_id = db.Column(db.Integer, db.ForeignKey('merge_groups.id'))
    new_group_id = db.Column(db.Integer, db.ForeignKey('merge_groups.id'))
    action = db.Column(db.String(50), nullable=False)
    reason = db.Column(db.Text, nullable=False)
    corrected_by = db.Column(db.String(100), default='operator')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    original_group = db.relationship('MergeGroup', foreign_keys=[original_group_id])
    new_group = db.relationship('MergeGroup', foreign_keys=[new_group_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'merge_version_id': self.merge_version_id,
            'alert_id': self.alert_id,
            'original_group_id': self.original_group_id,
            'new_group_id': self.new_group_id,
            'action': self.action,
            'reason': self.reason,
            'corrected_by': self.corrected_by,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
