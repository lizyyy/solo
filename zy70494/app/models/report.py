from datetime import datetime
from app import db

class Report(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    report_code = db.Column(db.String(50), nullable=False, unique=True)
    batch_id = db.Column(db.String(50), nullable=False, index=True)
    report_type = db.Column(db.String(50), nullable=False)
    report_title = db.Column(db.String(200), nullable=False)
    generated_by = db.Column(db.String(100))
    generated_at = db.Column(db.DateTime, default=datetime.utcnow)
    total_samples = db.Column(db.Integer, default=0)
    error_samples = db.Column(db.Integer, default=0)
    success_samples = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='generated')
    review_status = db.Column(db.String(20), default='pending')
    reviewed_by = db.Column(db.String(100))
    reviewed_at = db.Column(db.DateTime)
    review_notes = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id,
            'report_code': self.report_code,
            'batch_id': self.batch_id,
            'report_type': self.report_type,
            'report_title': self.report_title,
            'generated_by': self.generated_by,
            'generated_at': self.generated_at.isoformat() if self.generated_at else None,
            'total_samples': self.total_samples,
            'error_samples': self.error_samples,
            'success_samples': self.success_samples,
            'status': self.status,
            'review_status': self.review_status,
            'reviewed_by': self.reviewed_by,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'review_notes': self.review_notes
        }

class ReportEvidence(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.Integer, nullable=False, index=True)
    rerun_flag = db.Column(db.String(50), nullable=False)
    sequence_no = db.Column(db.Integer, nullable=False)
    input_data = db.Column(db.Text)
    action_taken = db.Column(db.Text)
    conclusion = db.Column(db.Text)
    is_legal_review_sample = db.Column(db.Boolean, default=False)
    legal_review_note = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'report_id': self.report_id,
            'rerun_flag': self.rerun_flag,
            'sequence_no': self.sequence_no,
            'input_data': self.input_data,
            'action_taken': self.action_taken,
            'conclusion': self.conclusion,
            'is_legal_review_sample': self.is_legal_review_sample,
            'legal_review_note': self.legal_review_note,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
