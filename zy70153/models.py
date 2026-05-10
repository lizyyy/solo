from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Role(db.Model):
    __tablename__ = 'roles'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    can_export = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class FieldStrategy(db.Model):
    __tablename__ = 'field_strategies'
    id = db.Column(db.Integer, primary_key=True)
    field_name = db.Column(db.String(100), unique=True, nullable=False)
    mask_type = db.Column(db.String(50), default='none')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RoleFieldMapping(db.Model):
    __tablename__ = 'role_field_mappings'
    id = db.Column(db.Integer, primary_key=True)
    role_id = db.Column(db.Integer, db.ForeignKey('roles.id'), nullable=False)
    field_strategy_id = db.Column(db.Integer, db.ForeignKey('field_strategies.id'), nullable=False)
    visible = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.String(64), unique=True, nullable=False)
    user_id = db.Column(db.String(100))
    user_name = db.Column(db.String(100))
    action = db.Column(db.String(100), nullable=False)
    resource = db.Column(db.String(200))
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.String(500))
    request_data = db.Column(db.Text)
    response_data = db.Column(db.Text)
    status = db.Column(db.String(50))
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_withdrawn = db.Column(db.Boolean, default=False)


class LogHistory(db.Model):
    __tablename__ = 'log_history'
    id = db.Column(db.Integer, primary_key=True)
    log_id = db.Column(db.Integer, db.ForeignKey('audit_logs.id'), nullable=False)
    action_type = db.Column(db.String(50), nullable=False)
    old_data = db.Column(db.Text)
    new_data = db.Column(db.Text)
    operator_id = db.Column(db.String(100))
    operator_name = db.Column(db.String(100))
    reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class AccessAudit(db.Model):
    __tablename__ = 'access_audit'
    id = db.Column(db.Integer, primary_key=True)
    operator_id = db.Column(db.String(100), nullable=False)
    operator_name = db.Column(db.String(100))
    operator_role = db.Column(db.String(50))
    action = db.Column(db.String(100), nullable=False)
    target_log_ids = db.Column(db.Text)
    filters = db.Column(db.Text)
    export_format = db.Column(db.String(20))
    watermark_applied = db.Column(db.Boolean, default=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    ip_address = db.Column(db.String(50))
    status = db.Column(db.String(50))
