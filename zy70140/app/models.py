from datetime import datetime
from app import db
from app.constants import AuditStatus, ReviewSource

class AuditTask(db.Model):
    __tablename__ = 'audit_tasks'
    
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.String(64), unique=True, nullable=False, index=True)
    business_id = db.Column(db.String(64), nullable=False, index=True)
    image_url = db.Column(db.String(512), nullable=False)
    image_source = db.Column(db.String(64))
    current_status = db.Column(db.String(32), nullable=False, default=AuditStatus.PENDING)
    max_callback_sequence = db.Column(db.Integer, default=0)
    latest_callback_id = db.Column(db.String(64))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    remark = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'business_id': self.business_id,
            'image_url': self.image_url,
            'image_source': self.image_source,
            'current_status': self.current_status,
            'current_status_desc': AuditStatus.get_desc(self.current_status),
            'max_callback_sequence': self.max_callback_sequence,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None,
            'remark': self.remark
        }

class CallbackRecord(db.Model):
    __tablename__ = 'callback_records'
    
    id = db.Column(db.Integer, primary_key=True)
    callback_id = db.Column(db.String(64), unique=True, nullable=False, index=True)
    task_id = db.Column(db.String(64), nullable=False, index=True)
    callback_sequence = db.Column(db.Integer, nullable=False)
    review_result = db.Column(db.String(32), nullable=False)
    review_score = db.Column(db.Float)
    risk_category = db.Column(db.String(64))
    risk_detail = db.Column(db.Text)
    raw_payload = db.Column(db.Text, nullable=False)
    source = db.Column(db.String(32), default=ReviewSource.THIRD_PARTY)
    processed = db.Column(db.Boolean, default=False)
    processed_at = db.Column(db.DateTime)
    received_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'callback_id': self.callback_id,
            'task_id': self.task_id,
            'callback_sequence': self.callback_sequence,
            'review_result': self.review_result,
            'review_result_desc': AuditStatus.get_desc(self.review_result),
            'review_score': self.review_score,
            'risk_category': self.risk_category,
            'risk_detail': self.risk_detail,
            'source': self.source,
            'processed': self.processed,
            'processed_at': self.processed_at.strftime('%Y-%m-%d %H:%M:%S') if self.processed_at else None,
            'received_at': self.received_at.strftime('%Y-%m-%d %H:%M:%S') if self.received_at else None
        }

class StateHistory(db.Model):
    __tablename__ = 'state_history'
    
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.String(64), nullable=False, index=True)
    from_status = db.Column(db.String(32), nullable=False)
    to_status = db.Column(db.String(32), nullable=False)
    transition_reason = db.Column(db.String(256), nullable=False)
    operator = db.Column(db.String(64))
    evidence_url = db.Column(db.String(512))
    evidence_data = db.Column(db.Text)
    callback_id = db.Column(db.String(64))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'from_status': self.from_status,
            'from_status_desc': AuditStatus.get_desc(self.from_status),
            'to_status': self.to_status,
            'to_status_desc': AuditStatus.get_desc(self.to_status),
            'transition_reason': self.transition_reason,
            'operator': self.operator,
            'evidence_url': self.evidence_url,
            'callback_id': self.callback_id,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }

class ManualReview(db.Model):
    __tablename__ = 'manual_reviews'
    
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.String(64), nullable=False, unique=True, index=True)
    reviewer = db.Column(db.String(64), nullable=False)
    review_decision = db.Column(db.String(32), nullable=False)
    review_comment = db.Column(db.Text)
    evidence_saved = db.Column(db.Boolean, default=False)
    evidence_paths = db.Column(db.Text)
    reviewed_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'reviewer': self.reviewer,
            'review_decision': self.review_decision,
            'review_decision_desc': AuditStatus.get_desc(self.review_decision),
            'review_comment': self.review_comment,
            'evidence_saved': self.evidence_saved,
            'evidence_paths': self.evidence_paths,
            'reviewed_at': self.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if self.reviewed_at else None
        }
