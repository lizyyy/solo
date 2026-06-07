from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import JSON

db = SQLAlchemy()


class ManualCorrectionSheet(db.Model):
    __tablename__ = 'manual_correction_sheets'
    
    id = db.Column(db.Integer, primary_key=True)
    sheet_name = db.Column(db.String(255), nullable=False)
    file_hash = db.Column(db.String(64), unique=True, nullable=False)
    imported_by = db.Column(db.String(100), nullable=False)
    imported_at = db.Column(db.DateTime, default=datetime.utcnow)
    total_samples = db.Column(db.Integer, default=0)
    version = db.Column(db.Integer, default=1)
    is_current = db.Column(db.Boolean, default=True)
    
    samples = db.relationship('ReviewSample', backref='correction_sheet', lazy=True)
    change_history = db.relationship('SheetChangeHistory', backref='sheet', lazy=True)


class PromptVersion(db.Model):
    __tablename__ = 'prompt_versions'
    
    id = db.Column(db.Integer, primary_key=True)
    version_number = db.Column(db.String(50), nullable=False)
    prompt_text = db.Column(db.Text, nullable=False)
    remark = db.Column(db.Text)
    created_by = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    model_version = db.Column(db.String(100))
    
    samples = db.relationship('ReviewSample', backref='prompt_version', lazy=True)


class ReviewSample(db.Model):
    __tablename__ = 'review_samples'
    
    id = db.Column(db.Integer, primary_key=True)
    unique_key = db.Column(db.String(255), nullable=False)
    correction_sheet_id = db.Column(db.Integer, db.ForeignKey('manual_correction_sheets.id'))
    prompt_version_id = db.Column(db.Integer, db.ForeignKey('prompt_versions.id'))
    original_text = db.Column(db.Text)
    model_prediction = db.Column(db.String(100))
    model_confidence = db.Column(db.Float)
    manual_label = db.Column(db.String(100))
    status = db.Column(db.String(50), default='pending')
    is_false_negative = db.Column(db.Boolean, default=False)
    is_low_confidence = db.Column(db.Boolean, default=False)
    masked_by_average = db.Column(db.Boolean, default=False)
    reviewed_by = db.Column(db.String(100))
    reviewed_at = db.Column(db.DateTime)
    kb_reviewed = db.Column(db.Boolean, default=False)
    kb_reviewed_by = db.Column(db.String(100))
    kb_reviewed_at = db.Column(db.DateTime)
    raw_remark = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    change_history = db.relationship('SampleChangeHistory', backref='sample', lazy=True)
    
    __table_args__ = (
        db.UniqueConstraint('unique_key', 'correction_sheet_id', name='_sample_sheet_uc'),
    )


class SheetChangeHistory(db.Model):
    __tablename__ = 'sheet_change_history'
    
    id = db.Column(db.Integer, primary_key=True)
    sheet_id = db.Column(db.Integer, db.ForeignKey('manual_correction_sheets.id'))
    changed_by = db.Column(db.String(100), nullable=False)
    changed_at = db.Column(db.DateTime, default=datetime.utcnow)
    change_type = db.Column(db.String(50), nullable=False)
    field_name = db.Column(db.String(100))
    old_value = db.Column(db.Text)
    new_value = db.Column(db.Text)
    change_summary = db.Column(db.Text)


class SampleChangeHistory(db.Model):
    __tablename__ = 'sample_change_history'
    
    id = db.Column(db.Integer, primary_key=True)
    sample_id = db.Column(db.Integer, db.ForeignKey('review_samples.id'))
    changed_by = db.Column(db.String(100), nullable=False)
    changed_at = db.Column(db.DateTime, default=datetime.utcnow)
    change_type = db.Column(db.String(50), nullable=False)
    field_name = db.Column(db.String(100))
    old_value = db.Column(db.Text)
    new_value = db.Column(db.Text)
    old_status = db.Column(db.String(50))
    new_status = db.Column(db.String(50))
    rollback_from_id = db.Column(db.Integer)


class WorkflowState(db.Model):
    __tablename__ = 'workflow_states'
    
    id = db.Column(db.Integer, primary_key=True)
    sheet_id = db.Column(db.Integer, db.ForeignKey('manual_correction_sheets.id'), unique=True)
    current_step = db.Column(db.String(50), default='step1_import')
    step1_completed = db.Column(db.Boolean, default=False)
    step1_completed_by = db.Column(db.String(100))
    step1_completed_at = db.Column(db.DateTime)
    step2_completed = db.Column(db.Boolean, default=False)
    step2_completed_by = db.Column(db.String(100))
    step2_completed_at = db.Column(db.DateTime)
    step3_completed = db.Column(db.Boolean, default=False)
    step3_completed_by = db.Column(db.String(100))
    step3_completed_at = db.Column(db.DateTime)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    sheet = db.relationship('ManualCorrectionSheet', backref='workflow_state', uselist=False)
