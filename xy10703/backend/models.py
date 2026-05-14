from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class AppAccount(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    app_name = db.Column(db.String(100), nullable=False)
    app_id = db.Column(db.String(50), unique=True, nullable=False)
    owner = db.Column(db.String(50), nullable=False)
    owner_email = db.Column(db.String(100), nullable=False)
    environment = db.Column(db.String(20), default='production')
    status = db.Column(db.String(20), default='active')
    default_policy_id = db.Column(db.Integer, db.ForeignKey('expiration_policy.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ApiKey(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    app_id = db.Column(db.Integer, db.ForeignKey('app_account.id'), nullable=False)
    version = db.Column(db.Integer, nullable=False)
    key_prefix = db.Column(db.String(20))
    status = db.Column(db.String(20), default='active')
    policy_id = db.Column(db.Integer, db.ForeignKey('expiration_policy.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime)
    rotated_at = db.Column(db.DateTime)

class ExpirationPolicy(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    days = db.Column(db.Integer, nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class UsageLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    app_id = db.Column(db.Integer, db.ForeignKey('app_account.id'), nullable=False)
    key_version = db.Column(db.Integer)
    action = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), default='success')
    error_message = db.Column(db.Text)
    operator = db.Column(db.String(50))
    operator_email = db.Column(db.String(100))
    reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    resolved_at = db.Column(db.DateTime)
    resolved_by = db.Column(db.String(50))
    resolution_notes = db.Column(db.Text)
    extra_data = db.Column(db.Text)

class RollbackSwitch(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    app_id = db.Column(db.Integer, db.ForeignKey('app_account.id'), unique=True, nullable=False)
    enabled = db.Column(db.Boolean, default=False)
    reason = db.Column(db.Text)
    operator = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class RiskItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    app_id = db.Column(db.Integer, db.ForeignKey('app_account.id'), nullable=False)
    risk_type = db.Column(db.String(50), nullable=False)
    severity = db.Column(db.String(20), default='medium')
    description = db.Column(db.Text)
    status = db.Column(db.String(20), default='open')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    resolved_at = db.Column(db.DateTime)
    resolved_by = db.Column(db.String(50))
