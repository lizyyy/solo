from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

RISK_LEVELS = {
    'high': {'name': '高风险', 'color': 'red', 'score': 3},
    'medium': {'name': '中风险', 'color': 'orange', 'score': 2},
    'low': {'name': '低风险', 'color': 'green', 'score': 1}
}

REVIEW_STATUSES = {
    'pending': '待复核',
    'approved': '已确认',
    'rejected': '已回滚',
    'modified': '已修正'
}


class PatientRecord(db.Model):
    __tablename__ = 'patient_records'
    
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.String(50), nullable=False, index=True)
    patient_name = db.Column(db.String(100))
    visit_date = db.Column(db.Date, index=True)
    follow_up_text = db.Column(db.Text, nullable=False)
    
    auto_risk_level = db.Column(db.String(20))
    auto_risk_reason = db.Column(db.Text)
    auto_risk_keywords = db.Column(db.Text)
    auto_confidence = db.Column(db.Float)
    
    manual_risk_level = db.Column(db.String(20))
    manual_risk_reason = db.Column(db.Text)
    
    review_status = db.Column(db.String(20), default='pending')
    reviewed_by = db.Column(db.String(100))
    reviewed_at = db.Column(db.DateTime)
    
    import_batch_id = db.Column(db.String(50), index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    version_histories = db.relationship('VersionHistory', backref='record', lazy='dynamic',
                                        cascade='all, delete-orphan')
    misjudgments = db.relationship('Misjudgment', backref='record', lazy='dynamic',
                                   cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'patient_name': self.patient_name,
            'visit_date': self.visit_date.isoformat() if self.visit_date else None,
            'follow_up_text': self.follow_up_text,
            'auto_risk_level': self.auto_risk_level,
            'auto_risk_reason': self.auto_risk_reason,
            'auto_risk_keywords': self.auto_risk_keywords,
            'auto_confidence': self.auto_confidence,
            'manual_risk_level': self.manual_risk_level,
            'manual_risk_reason': self.manual_risk_reason,
            'review_status': self.review_status,
            'review_status_name': REVIEW_STATUSES.get(self.review_status, self.review_status),
            'reviewed_by': self.reviewed_by,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'final_risk_level': self.manual_risk_level or self.auto_risk_level,
            'final_risk_name': RISK_LEVELS.get(self.manual_risk_level or self.auto_risk_level, {}).get('name', '未知'),
            'import_batch_id': self.import_batch_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class VersionHistory(db.Model):
    __tablename__ = 'version_histories'
    
    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.Integer, db.ForeignKey('patient_records.id'), nullable=False, index=True)
    
    previous_risk_level = db.Column(db.String(20))
    new_risk_level = db.Column(db.String(20))
    previous_reason = db.Column(db.Text)
    new_reason = db.Column(db.Text)
    previous_status = db.Column(db.String(20))
    new_status = db.Column(db.String(20))
    
    change_type = db.Column(db.String(50))
    change_reason = db.Column(db.Text)
    
    operator = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'record_id': self.record_id,
            'previous_risk_level': self.previous_risk_level,
            'new_risk_level': self.new_risk_level,
            'previous_risk_name': RISK_LEVELS.get(self.previous_risk_level, {}).get('name', '未知'),
            'new_risk_name': RISK_LEVELS.get(self.new_risk_level, {}).get('name', '未知'),
            'previous_reason': self.previous_reason,
            'new_reason': self.new_reason,
            'previous_status': self.previous_status,
            'new_status': self.new_status,
            'previous_status_name': REVIEW_STATUSES.get(self.previous_status, self.previous_status),
            'new_status_name': REVIEW_STATUSES.get(self.new_status, self.new_status),
            'change_type': self.change_type,
            'change_reason': self.change_reason,
            'operator': self.operator,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Misjudgment(db.Model):
    __tablename__ = 'misjudgments'
    
    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.Integer, db.ForeignKey('patient_records.id'), nullable=False, index=True)
    
    auto_risk_level = db.Column(db.String(20))
    correct_risk_level = db.Column(db.String(20))
    misjudgment_type = db.Column(db.String(50))
    
    follow_up_text = db.Column(db.Text)
    auto_keywords = db.Column(db.Text)
    correction_reason = db.Column(db.Text)
    
    reported_by = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'record_id': self.record_id,
            'auto_risk_level': self.auto_risk_level,
            'auto_risk_name': RISK_LEVELS.get(self.auto_risk_level, {}).get('name', '未知'),
            'correct_risk_level': self.correct_risk_level,
            'correct_risk_name': RISK_LEVELS.get(self.correct_risk_level, {}).get('name', '未知'),
            'misjudgment_type': self.misjudgment_type,
            'follow_up_text': self.follow_up_text,
            'auto_keywords': self.auto_keywords,
            'correction_reason': self.correction_reason,
            'reported_by': self.reported_by,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class ImportBatch(db.Model):
    __tablename__ = 'import_batches'
    
    id = db.Column(db.String(50), primary_key=True)
    filename = db.Column(db.String(255))
    total_records = db.Column(db.Integer, default=0)
    high_risk_count = db.Column(db.Integer, default=0)
    medium_risk_count = db.Column(db.Integer, default=0)
    low_risk_count = db.Column(db.Integer, default=0)
    imported_by = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'total_records': self.total_records,
            'high_risk_count': self.high_risk_count,
            'medium_risk_count': self.medium_risk_count,
            'low_risk_count': self.low_risk_count,
            'imported_by': self.imported_by,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
