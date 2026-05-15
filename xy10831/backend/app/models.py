from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

class OriginalRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.String(64), unique=True, nullable=False)
    method = db.Column(db.String(16), nullable=False)
    url = db.Column(db.String(512), nullable=False)
    headers = db.Column(db.Text)
    body = db.Column(db.Text)
    source = db.Column(db.String(128))
    captured_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(32), default='pending')
    created_by = db.Column(db.String(64))
    
    def to_dict(self):
        return {
            'id': self.id,
            'request_id': self.request_id,
            'method': self.method,
            'url': self.url,
            'headers': json.loads(self.headers) if self.headers else {},
            'body': json.loads(self.body) if self.body else {},
            'source': self.source,
            'captured_at': self.captured_at.isoformat(),
            'status': self.status,
            'created_by': self.created_by
        }

class MaskingRule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.String(512))
    field_path = db.Column(db.String(256), nullable=False)
    mask_type = db.Column(db.String(32), nullable=False)
    mask_pattern = db.Column(db.String(128))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'field_path': self.field_path,
            'mask_type': self.mask_type,
            'mask_pattern': self.mask_pattern,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class ReplayEnvironment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    base_url = db.Column(db.String(512), nullable=False)
    description = db.Column(db.String(512))
    is_production = db.Column(db.Boolean, default=False)
    requires_approval = db.Column(db.Boolean, default=False)
    headers = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'base_url': self.base_url,
            'description': self.description,
            'is_production': self.is_production,
            'requires_approval': self.requires_approval,
            'headers': json.loads(self.headers) if self.headers else {},
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat()
        }

class AuthorizationRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.String(64), db.ForeignKey('original_request.request_id'), nullable=False)
    environment_id = db.Column(db.Integer, db.ForeignKey('replay_environment.id'), nullable=False)
    requester = db.Column(db.String(64), nullable=False)
    approver = db.Column(db.String(64))
    status = db.Column(db.String(32), default='pending')
    reason = db.Column(db.String(1024))
    approval_note = db.Column(db.String(1024))
    requested_at = db.Column(db.DateTime, default=datetime.utcnow)
    approved_at = db.Column(db.DateTime)
    expires_at = db.Column(db.DateTime)
    
    def to_dict(self):
        return {
            'id': self.id,
            'request_id': self.request_id,
            'environment_id': self.environment_id,
            'requester': self.requester,
            'approver': self.approver,
            'status': self.status,
            'reason': self.reason,
            'approval_note': self.approval_note,
            'requested_at': self.requested_at.isoformat(),
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None
        }

class ReplayResult(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.String(64), db.ForeignKey('original_request.request_id'), nullable=False)
    environment_id = db.Column(db.Integer, db.ForeignKey('replay_environment.id'), nullable=False)
    authorization_id = db.Column(db.Integer, db.ForeignKey('authorization_record.id'))
    status = db.Column(db.String(32), default='pending')
    masked_body = db.Column(db.Text)
    response_status = db.Column(db.Integer)
    response_headers = db.Column(db.Text)
    response_body = db.Column(db.Text)
    response_time_ms = db.Column(db.Integer)
    error_message = db.Column(db.Text)
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    executed_by = db.Column(db.String(64))
    
    def to_dict(self):
        return {
            'id': self.id,
            'request_id': self.request_id,
            'environment_id': self.environment_id,
            'authorization_id': self.authorization_id,
            'status': self.status,
            'masked_body': json.loads(self.masked_body) if self.masked_body else {},
            'response_status': self.response_status,
            'response_headers': json.loads(self.response_headers) if self.response_headers else {},
            'response_body': json.loads(self.response_body) if self.response_body else None,
            'response_time_ms': self.response_time_ms,
            'error_message': self.error_message,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'executed_by': self.executed_by
        }

class ResponseComparison(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    baseline_result_id = db.Column(db.Integer, db.ForeignKey('replay_result.id'), nullable=False)
    comparison_result_id = db.Column(db.Integer, db.ForeignKey('replay_result.id'), nullable=False)
    status_code_match = db.Column(db.Boolean)
    body_similarity = db.Column(db.Float)
    differences = db.Column(db.Text)
    comparison_summary = db.Column(db.String(1024))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'baseline_result_id': self.baseline_result_id,
            'comparison_result_id': self.comparison_result_id,
            'status_code_match': self.status_code_match,
            'body_similarity': self.body_similarity,
            'differences': json.loads(self.differences) if self.differences else [],
            'comparison_summary': self.comparison_summary,
            'created_at': self.created_at.isoformat()
        }

class AuditLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    action = db.Column(db.String(64), nullable=False)
    entity_type = db.Column(db.String(64))
    entity_id = db.Column(db.String(64))
    user = db.Column(db.String(64))
    details = db.Column(db.Text)
    ip_address = db.Column(db.String(64))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'action': self.action,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'user': self.user,
            'details': json.loads(self.details) if self.details else {},
            'ip_address': self.ip_address,
            'created_at': self.created_at.isoformat()
        }
