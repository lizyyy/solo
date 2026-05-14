from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

class CacheRule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    rule_key = db.Column(db.String(255), unique=True, nullable=False)
    rule_pattern = db.Column(db.String(500), nullable=False)
    original_input = db.Column(db.Text)
    processed_result = db.Column(db.Text)
    description = db.Column(db.Text)
    ttl = db.Column(db.Integer, default=3600)
    status = db.Column(db.String(50), default='pending')
    current_hit_rate = db.Column(db.Float, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_invalidated_at = db.Column(db.DateTime)
    
    batches = db.relationship('PreheatBatch', backref='rule', lazy=True)
    invalidations = db.relationship('InvalidationEvent', backref='rule', lazy=True)
    reports = db.relationship('PerformanceReport', backref='rule', lazy=True)
    pressure_logs = db.relationship('SourcePressureLog', backref='rule', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'rule_key': self.rule_key,
            'rule_pattern': self.rule_pattern,
            'original_input': json.loads(self.original_input) if self.original_input else {},
            'processed_result': json.loads(self.processed_result) if self.processed_result else {},
            'description': self.description,
            'ttl': self.ttl,
            'status': self.status,
            'current_hit_rate': self.current_hit_rate,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'last_invalidated_at': self.last_invalidated_at.isoformat() if self.last_invalidated_at else None
        }

class PreheatBatch(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    rule_id = db.Column(db.Integer, db.ForeignKey('cache_rule.id'), nullable=False)
    batch_key = db.Column(db.String(100), unique=True, nullable=False)
    total_keys = db.Column(db.Integer, default=0)
    success_keys = db.Column(db.Integer, default=0)
    failed_keys = db.Column(db.Integer, default=0)
    hit_rate = db.Column(db.Float, default=0)
    status = db.Column(db.String(50), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    
    def to_dict(self):
        return {
            'id': self.id,
            'rule_id': self.rule_id,
            'batch_key': self.batch_key,
            'total_keys': self.total_keys,
            'success_keys': self.success_keys,
            'failed_keys': self.failed_keys,
            'hit_rate': self.hit_rate,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }

class InvalidationEvent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    rule_id = db.Column(db.Integer, db.ForeignKey('cache_rule.id'), nullable=False)
    event_key = db.Column(db.String(100), unique=True, nullable=False)
    reason = db.Column(db.Text)
    operator = db.Column(db.String(100))
    status = db.Column(db.String(50), default='pending')
    failure_reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    
    pressure_logs = db.relationship('SourcePressureLog', backref='event', lazy=True)
    corrections = db.relationship('CorrectionRecord', backref='event', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'rule_id': self.rule_id,
            'event_key': self.event_key,
            'reason': self.reason,
            'operator': self.operator,
            'status': self.status,
            'failure_reason': self.failure_reason,
            'created_at': self.created_at.isoformat(),
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'corrections': [c.to_dict() for c in self.corrections]
        }

class SourcePressureLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    rule_id = db.Column(db.Integer, db.ForeignKey('cache_rule.id'), nullable=False)
    event_id = db.Column(db.Integer, db.ForeignKey('invalidation_event.id'))
    pressure_level = db.Column(db.String(50))
    estimated_qps = db.Column(db.Integer, default=0)
    reason = db.Column(db.Text)
    status = db.Column(db.String(50), default='recorded')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'rule_id': self.rule_id,
            'event_id': self.event_id,
            'pressure_level': self.pressure_level,
            'estimated_qps': self.estimated_qps,
            'reason': self.reason,
            'status': self.status,
            'created_at': self.created_at.isoformat()
        }

class CorrectionRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('invalidation_event.id'), nullable=False)
    correction_reason = db.Column(db.Text, nullable=False)
    handler = db.Column(db.String(100))
    handler_comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'event_id': self.event_id,
            'correction_reason': self.correction_reason,
            'handler': self.handler,
            'handler_comment': self.handler_comment,
            'created_at': self.created_at.isoformat()
        }

class PerformanceReport(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    rule_id = db.Column(db.Integer, db.ForeignKey('cache_rule.id'), nullable=False)
    report_key = db.Column(db.String(100), unique=True, nullable=False)
    avg_hit_rate = db.Column(db.Float, default=0)
    total_preheat_batches = db.Column(db.Integer, default=0)
    total_invalidations = db.Column(db.Integer, default=0)
    report_data = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'rule_id': self.rule_id,
            'report_key': self.report_key,
            'avg_hit_rate': self.avg_hit_rate,
            'total_preheat_batches': self.total_preheat_batches,
            'total_invalidations': self.total_invalidations,
            'report_data': json.loads(self.report_data) if self.report_data else {},
            'created_at': self.created_at.isoformat()
        }
