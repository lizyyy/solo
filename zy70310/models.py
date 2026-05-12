from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Team(db.Model):
    __tablename__ = 'teams'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    quotas = db.relationship('Quota', backref='team', lazy=True)
    usages = db.relationship('UsageRecord', backref='team', lazy=True)
    borrowed = db.relationship('BorrowRequest', 
                               foreign_keys='BorrowRequest.borrower_id', 
                               backref='borrower', lazy=True)
    lent = db.relationship('BorrowRequest', 
                           foreign_keys='BorrowRequest.lender_id', 
                           backref='lender', lazy=True)
    expansions = db.relationship('ExpansionRequest', backref='team', lazy=True)


class Service(db.Model):
    __tablename__ = 'services'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    quotas = db.relationship('Quota', backref='service', lazy=True)
    usages = db.relationship('UsageRecord', backref='service', lazy=True)


class Quota(db.Model):
    __tablename__ = 'quotas'
    
    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id'), nullable=False)
    service_id = db.Column(db.Integer, db.ForeignKey('services.id'), nullable=False)
    monthly_quota = db.Column(db.Integer, nullable=False, default=0)
    month = db.Column(db.String(7), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('team_id', 'service_id', 'month', name='uix_team_service_month'),)


class UsageRecord(db.Model):
    __tablename__ = 'usage_records'
    
    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id'), nullable=False)
    service_id = db.Column(db.Integer, db.ForeignKey('services.id'), nullable=False)
    request_id = db.Column(db.String(100), unique=True, nullable=False)
    amount = db.Column(db.Integer, nullable=False)
    priority = db.Column(db.String(20), nullable=False, default='normal')
    status = db.Column(db.String(20), nullable=False, default='normal')
    source = db.Column(db.String(20), nullable=False, default='base')
    month = db.Column(db.String(7), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    borrow_request_id = db.Column(db.Integer, db.ForeignKey('borrow_requests.id'))
    expansion_request_id = db.Column(db.Integer, db.ForeignKey('expansion_requests.id'))
    
    risk_record = db.relationship('RiskRecord', backref='usage_record', uselist=False)


class RiskRecord(db.Model):
    __tablename__ = 'risk_records'
    
    id = db.Column(db.Integer, primary_key=True)
    usage_record_id = db.Column(db.Integer, db.ForeignKey('usage_records.id'), nullable=False)
    description = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class FrozenRecord(db.Model):
    __tablename__ = 'frozen_records'
    
    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id'), nullable=False)
    service_id = db.Column(db.Integer, db.ForeignKey('services.id'), nullable=False)
    request_id = db.Column(db.String(100), unique=True, nullable=False)
    amount = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(500), nullable=False)
    month = db.Column(db.String(7), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class BorrowRequest(db.Model):
    __tablename__ = 'borrow_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    borrower_id = db.Column(db.Integer, db.ForeignKey('teams.id'), nullable=False)
    lender_id = db.Column(db.Integer, db.ForeignKey('teams.id'), nullable=False)
    service_id = db.Column(db.Integer, db.ForeignKey('services.id'), nullable=False)
    amount = db.Column(db.Integer, nullable=False)
    month = db.Column(db.String(7), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='pending')
    reason = db.Column(db.String(500))
    approval_note = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    approved_at = db.Column(db.DateTime)
    rejected_at = db.Column(db.DateTime)
    
    used_amount = db.Column(db.Integer, default=0)
    
    __table_args__ = (db.UniqueConstraint('borrower_id', 'lender_id', 'service_id', 'month', 
                                         name='uix_borrow_unique'),)
    
    service = db.relationship('Service', backref='borrow_requests')
    usage_records = db.relationship('UsageRecord', backref='borrow_request', lazy=True)


class ExpansionRequest(db.Model):
    __tablename__ = 'expansion_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id'), nullable=False)
    service_id = db.Column(db.Integer, db.ForeignKey('services.id'), nullable=False)
    amount = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(500))
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='pending')
    approval_note = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    approved_at = db.Column(db.DateTime)
    rejected_at = db.Column(db.DateTime)
    
    used_amount = db.Column(db.Integer, default=0)
    
    service = db.relationship('Service', backref='expansion_requests')
    usage_records = db.relationship('UsageRecord', backref='expansion_request', lazy=True)


class Reconciliation(db.Model):
    __tablename__ = 'reconciliations'
    
    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id'), nullable=False)
    service_id = db.Column(db.Integer, db.ForeignKey('services.id'), nullable=False)
    month = db.Column(db.String(7), nullable=False)
    
    base_quota = db.Column(db.Integer, default=0)
    base_used = db.Column(db.Integer, default=0)
    base_remaining = db.Column(db.Integer, default=0)
    
    expansion_total = db.Column(db.Integer, default=0)
    expansion_used = db.Column(db.Integer, default=0)
    expansion_remaining = db.Column(db.Integer, default=0)
    
    borrowed_total = db.Column(db.Integer, default=0)
    borrowed_used = db.Column(db.Integer, default=0)
    borrowed_remaining = db.Column(db.Integer, default=0)
    
    lent_total = db.Column(db.Integer, default=0)
    lent_used = db.Column(db.Integer, default=0)
    lent_remaining = db.Column(db.Integer, default=0)
    
    frozen_amount = db.Column(db.Integer, default=0)
    frozen_count = db.Column(db.Integer, default=0)
    
    overage_amount = db.Column(db.Integer, default=0)
    risk_count = db.Column(db.Integer, default=0)
    
    total_available = db.Column(db.Integer, default=0)
    total_used = db.Column(db.Integer, default=0)
    total_remaining = db.Column(db.Integer, default=0)
    
    discrepancy = db.Column(db.Integer, default=0)
    generated_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('team_id', 'service_id', 'month', 
                                         name='uix_reconciliation_unique'),)
    
    team = db.relationship('Team', backref='reconciliations')
    service = db.relationship('Service', backref='reconciliations')
