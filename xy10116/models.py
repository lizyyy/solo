from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import JSON

db = SQLAlchemy()

class Resume(db.Model):
    __tablename__ = 'resumes'
    
    id = db.Column(db.Integer, primary_key=True)
    external_id = db.Column(db.String(100), nullable=True, index=True)
    batch_id = db.Column(db.String(50), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False, index=True)
    phone = db.Column(db.String(50), nullable=True, index=True)
    email = db.Column(db.String(200), nullable=True, index=True)
    id_number = db.Column(db.String(50), nullable=True, index=True)
    birth_date = db.Column(db.String(20), nullable=True)
    gender = db.Column(db.String(10), nullable=True)
    education = db.Column(db.String(100), nullable=True)
    school = db.Column(db.String(200), nullable=True)
    major = db.Column(db.String(200), nullable=True)
    work_years = db.Column(db.String(50), nullable=True)
    current_company = db.Column(db.String(200), nullable=True)
    current_position = db.Column(db.String(200), nullable=True)
    address = db.Column(db.String(500), nullable=True)
    expected_position = db.Column(db.String(200), nullable=True)
    expected_salary = db.Column(db.String(100), nullable=True)
    application_time = db.Column(db.DateTime, nullable=True)
    source = db.Column(db.String(100), nullable=True)
    raw_data = db.Column(JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    risks = db.relationship('RiskDetection', backref='resume', lazy='dynamic',
                           cascade='all, delete-orphan', foreign_keys='RiskDetection.resume_id')
    
    def to_dict(self):
        return {
            'id': self.id,
            'external_id': self.external_id,
            'batch_id': self.batch_id,
            'name': self.name,
            'phone': self.phone,
            'email': self.email,
            'id_number': self.id_number,
            'birth_date': self.birth_date,
            'gender': self.gender,
            'education': self.education,
            'school': self.school,
            'major': self.major,
            'work_years': self.work_years,
            'current_company': self.current_company,
            'current_position': self.current_position,
            'address': self.address,
            'expected_position': self.expected_position,
            'expected_salary': self.expected_salary,
            'application_time': self.application_time.isoformat() if self.application_time else None,
            'source': self.source,
            'created_at': self.created_at.isoformat(),
        }


class RiskDetection(db.Model):
    __tablename__ = 'risk_detections'
    
    id = db.Column(db.Integer, primary_key=True)
    resume_id = db.Column(db.Integer, db.ForeignKey('resumes.id'), nullable=False, index=True)
    matched_resume_id = db.Column(db.Integer, db.ForeignKey('resumes.id'), nullable=False, index=True)
    
    risk_level = db.Column(db.String(20), nullable=False, index=True)
    risk_score = db.Column(db.Float, nullable=False, index=True)
    risk_reason = db.Column(db.String(500), nullable=False)
    matched_fields = db.Column(JSON, nullable=True)
    
    auto_label = db.Column(db.String(20), nullable=True)
    manual_label = db.Column(db.String(20), nullable=True, index=True)
    reviewer_comment = db.Column(db.String(500), nullable=True)
    reviewed_by = db.Column(db.String(100), nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    
    is_rollback = db.Column(db.Boolean, default=False, index=True)
    rollback_reason = db.Column(db.String(500), nullable=True)
    rollback_by = db.Column(db.String(100), nullable=True)
    rollback_at = db.Column(db.DateTime, nullable=True)
    
    version = db.Column(db.Integer, default=1, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    history = db.relationship('DetectionHistory', backref='detection', lazy='dynamic',
                              cascade='all, delete-orphan')
    
    matched_resume = db.relationship('Resume', foreign_keys=[matched_resume_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'resume_id': self.resume_id,
            'matched_resume_id': self.matched_resume_id,
            'risk_level': self.risk_level,
            'risk_score': self.risk_score,
            'risk_reason': self.risk_reason,
            'matched_fields': self.matched_fields,
            'auto_label': self.auto_label,
            'manual_label': self.manual_label,
            'reviewer_comment': self.reviewer_comment,
            'reviewed_by': self.reviewed_by,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'is_rollback': self.is_rollback,
            'rollback_reason': self.rollback_reason,
            'rollback_by': self.rollback_by,
            'rollback_at': self.rollback_at.isoformat() if self.rollback_at else None,
            'version': self.version,
            'created_at': self.created_at.isoformat(),
        }


class DetectionHistory(db.Model):
    __tablename__ = 'detection_histories'
    
    id = db.Column(db.Integer, primary_key=True)
    detection_id = db.Column(db.Integer, db.ForeignKey('risk_detections.id'), nullable=False, index=True)
    
    version = db.Column(db.Integer, nullable=False)
    action = db.Column(db.String(50), nullable=False)
    action_by = db.Column(db.String(100), nullable=True)
    
    old_risk_level = db.Column(db.String(20), nullable=True)
    new_risk_level = db.Column(db.String(20), nullable=True)
    old_manual_label = db.Column(db.String(20), nullable=True)
    new_manual_label = db.Column(db.String(20), nullable=True)
    old_reviewer_comment = db.Column(db.String(500), nullable=True)
    new_reviewer_comment = db.Column(db.String(500), nullable=True)
    
    change_reason = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'detection_id': self.detection_id,
            'version': self.version,
            'action': self.action,
            'action_by': self.action_by,
            'old_risk_level': self.old_risk_level,
            'new_risk_level': self.new_risk_level,
            'old_manual_label': self.old_manual_label,
            'new_manual_label': self.new_manual_label,
            'old_reviewer_comment': self.old_reviewer_comment,
            'new_reviewer_comment': self.new_reviewer_comment,
            'change_reason': self.change_reason,
            'created_at': self.created_at.isoformat(),
        }


class ImportBatch(db.Model):
    __tablename__ = 'import_batches'
    
    id = db.Column(db.String(50), primary_key=True)
    file_name = db.Column(db.String(200), nullable=False)
    total_records = db.Column(db.Integer, default=0)
    success_records = db.Column(db.Integer, default=0)
    failed_records = db.Column(db.Integer, default=0)
    imported_by = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'file_name': self.file_name,
            'total_records': self.total_records,
            'success_records': self.success_records,
            'failed_records': self.failed_records,
            'imported_by': self.imported_by,
            'created_at': self.created_at.isoformat(),
        }
