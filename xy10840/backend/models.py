from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class PromptTemplate(db.Model):
    __tablename__ = 'prompt_templates'
    
    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    scenario = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(50), default='draft')
    current_version = db.Column(db.Integer, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.String(100))
    
    versions = db.relationship('TemplateVersion', backref='template', lazy=True, cascade='all, delete-orphan')
    approvals = db.relationship('ApprovalRecord', backref='template', lazy=True, cascade='all, delete-orphan')
    gray_records = db.relationship('GrayRecord', backref='template', lazy=True, cascade='all, delete-orphan')
    effect_records = db.relationship('EffectRecord', backref='template', lazy=True, cascade='all, delete-orphan')


class TemplateVersion(db.Model):
    __tablename__ = 'template_versions'
    
    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.String(50), db.ForeignKey('prompt_templates.template_id'), nullable=False)
    version = db.Column(db.Integer, nullable=False)
    content = db.Column(db.Text, nullable=False)
    variables = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.String(100))
    changelog = db.Column(db.Text)
    
    __table_args__ = (db.UniqueConstraint('template_id', 'version', name='_template_version_uc'),)


class ApprovalRecord(db.Model):
    __tablename__ = 'approval_records'
    
    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.String(50), db.ForeignKey('prompt_templates.template_id'), nullable=False)
    version = db.Column(db.Integer, nullable=False)
    approver = db.Column(db.String(100))
    opinion = db.Column(db.Text)
    status = db.Column(db.String(50), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    approved_at = db.Column(db.DateTime)


class GrayRecord(db.Model):
    __tablename__ = 'gray_records'
    
    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.String(50), db.ForeignKey('prompt_templates.template_id'), nullable=False)
    version = db.Column(db.Integer, nullable=False)
    traffic_percent = db.Column(db.Float, default=0)
    start_time = db.Column(db.DateTime)
    end_time = db.Column(db.DateTime)
    status = db.Column(db.String(50), default='inactive')
    created_by = db.Column(db.String(100))
    rolled_back = db.Column(db.Boolean, default=False)
    rollback_reason = db.Column(db.Text)


class EffectRecord(db.Model):
    __tablename__ = 'effect_records'
    
    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.String(50), db.ForeignKey('prompt_templates.template_id'), nullable=False)
    version = db.Column(db.Integer, nullable=False)
    metric_name = db.Column(db.String(100), nullable=False)
    metric_value = db.Column(db.Float, nullable=False)
    baseline_value = db.Column(db.Float)
    sample_size = db.Column(db.Integer)
    recorded_at = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.Text)
