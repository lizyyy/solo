from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class CallbackEvent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    partner_code = db.Column(db.String(50), nullable=False, index=True)
    event_id = db.Column(db.String(100), unique=True, nullable=False, index=True)
    event_type = db.Column(db.String(50), nullable=False)
    callback_url = db.Column(db.String(255), nullable=False)
    request_data = db.Column(db.Text, nullable=False)
    signature = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(20), default='pending', nullable=False, index=True)
    retry_count = db.Column(db.Integer, default=0, nullable=False)
    max_retries = db.Column(db.Integer, default=3, nullable=False)
    last_retry_at = db.Column(db.DateTime)
    next_retry_at = db.Column(db.DateTime)
    reconcile_summary = db.Column(db.String(255))
    error_message = db.Column(db.Text)
    manual_confirmation = db.Column(db.Boolean, default=False, nullable=False)
    confirmed_by = db.Column(db.String(50))
    confirmed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'partner_code': self.partner_code,
            'event_id': self.event_id,
            'event_type': self.event_type,
            'callback_url': self.callback_url,
            'request_data': self.request_data,
            'signature': self.signature,
            'status': self.status,
            'retry_count': self.retry_count,
            'max_retries': self.max_retries,
            'last_retry_at': self.last_retry_at.isoformat() if self.last_retry_at else None,
            'next_retry_at': self.next_retry_at.isoformat() if self.next_retry_at else None,
            'reconcile_summary': self.reconcile_summary,
            'error_message': self.error_message,
            'manual_confirmation': self.manual_confirmation,
            'confirmed_by': self.confirmed_by,
            'confirmed_at': self.confirmed_at.isoformat() if self.confirmed_at else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }


class CallbackLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.String(100), nullable=False, index=True)
    attempt_number = db.Column(db.Integer, nullable=False)
    request_data = db.Column(db.Text, nullable=False)
    response_status = db.Column(db.Integer)
    response_data = db.Column(db.Text)
    error_message = db.Column(db.Text)
    success = db.Column(db.Boolean, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'event_id': self.event_id,
            'attempt_number': self.attempt_number,
            'request_data': self.request_data,
            'response_status': self.response_status,
            'response_data': self.response_data,
            'error_message': self.error_message,
            'success': self.success,
            'created_at': self.created_at.isoformat()
        }


class RollbackHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.String(100), nullable=False, index=True)
    rollback_reason = db.Column(db.String(255), nullable=False)
    rolled_back_by = db.Column(db.String(50), nullable=False)
    previous_status = db.Column(db.String(20), nullable=False)
    new_status = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'event_id': self.event_id,
            'rollback_reason': self.rollback_reason,
            'rolled_back_by': self.rolled_back_by,
            'previous_status': self.previous_status,
            'new_status': self.new_status,
            'created_at': self.created_at.isoformat()
        }
