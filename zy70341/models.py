from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class RiskEvent(db.Model):
    __tablename__ = 'risk_events'
    
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.String(64), unique=True, nullable=False)
    user_id = db.Column(db.String(64), index=True, nullable=False)
    risk_type = db.Column(db.String(32), nullable=False)
    severity = db.Column(db.String(16), nullable=False)
    evidence = db.Column(db.JSON, nullable=False)
    description = db.Column(db.Text, nullable=True)
    source = db.Column(db.String(32), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'event_id': self.event_id,
            'user_id': self.user_id,
            'risk_type': self.risk_type,
            'severity': self.severity,
            'evidence': self.evidence,
            'description': self.description,
            'source': self.source,
            'created_at': self.created_at.isoformat()
        }

class GraylistEntry(db.Model):
    __tablename__ = 'graylist_entries'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(64), index=True, nullable=False)
    status = db.Column(db.String(16), default='active', nullable=False)
    single_transaction_limit = db.Column(db.Float, nullable=False)
    daily_transaction_limit = db.Column(db.Float, nullable=False)
    effective_from = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    auto_expire = db.Column(db.Boolean, default=True, nullable=False)
    reason = db.Column(db.Text, nullable=True)
    trigger_event_id = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    def to_dict(self):
        is_expired = self.auto_expire and datetime.utcnow() > self.expires_at
        return {
            'id': self.id,
            'user_id': self.user_id,
            'status': 'expired' if is_expired else self.status,
            'single_transaction_limit': self.single_transaction_limit,
            'daily_transaction_limit': self.daily_transaction_limit,
            'effective_from': self.effective_from.isoformat(),
            'expires_at': self.expires_at.isoformat(),
            'auto_expire': self.auto_expire,
            'reason': self.reason,
            'trigger_event_id': self.trigger_event_id,
            'created_at': self.created_at.isoformat(),
            'is_active': self.status == 'active' and not is_expired
        }

class ReviewRecord(db.Model):
    __tablename__ = 'review_records'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(64), index=True, nullable=False)
    reviewer_id = db.Column(db.String(64), nullable=True)
    decision = db.Column(db.String(16), nullable=False)
    remark = db.Column(db.Text, nullable=True)
    evidence = db.Column(db.JSON, nullable=True)
    related_event_ids = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'reviewer_id': self.reviewer_id,
            'decision': self.decision,
            'remark': self.remark,
            'evidence': self.evidence,
            'related_event_ids': self.related_event_ids,
            'created_at': self.created_at.isoformat()
        }

class DailyRiskStats(db.Model):
    __tablename__ = 'daily_risk_stats'
    
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, index=True, unique=True, nullable=False)
    total_events = db.Column(db.Integer, default=0, nullable=False)
    added_to_graylist = db.Column(db.Integer, default=0, nullable=False)
    upgraded_to_blacklist = db.Column(db.Integer, default=0, nullable=False)
    transactions_limited = db.Column(db.Integer, default=0, nullable=False)
    amount_limited = db.Column(db.Float, default=0.0, nullable=False)
    reviewed_passed = db.Column(db.Integer, default=0, nullable=False)
    auto_expired = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    def to_dict(self):
        return {
            'date': self.date.isoformat(),
            'total_events': self.total_events,
            'added_to_graylist': self.added_to_graylist,
            'upgraded_to_blacklist': self.upgraded_to_blacklist,
            'transactions_limited': self.transactions_limited,
            'amount_limited': self.amount_limited,
            'reviewed_passed': self.reviewed_passed,
            'auto_expired': self.auto_expired
        }

class BlacklistEntry(db.Model):
    __tablename__ = 'blacklist_entries'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(64), unique=True, index=True, nullable=False)
    reason = db.Column(db.Text, nullable=True)
    trigger_event_ids = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'reason': self.reason,
            'trigger_event_ids': self.trigger_event_ids,
            'created_at': self.created_at.isoformat()
        }
