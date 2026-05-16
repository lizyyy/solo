from datetime import datetime
from app import db

class EvidenceChain(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.String(50), nullable=False, index=True)
    supplier_code = db.Column(db.String(50), nullable=False, index=True)
    execution_id = db.Column(db.Integer, index=True)
    chain_order = db.Column(db.Integer, nullable=False)
    evidence_type = db.Column(db.String(50), nullable=False)
    evidence_content = db.Column(db.Text)
    evidence_hash = db.Column(db.String(64))
    is_valid = db.Column(db.Boolean, default=True)
    validation_message = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'batch_id': self.batch_id,
            'supplier_code': self.supplier_code,
            'execution_id': self.execution_id,
            'chain_order': self.chain_order,
            'evidence_type': self.evidence_type,
            'evidence_content': self.evidence_content,
            'evidence_hash': self.evidence_hash,
            'is_valid': self.is_valid,
            'validation_message': self.validation_message,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class ErrorSample(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.String(50), nullable=False, index=True)
    supplier_code = db.Column(db.String(50), nullable=False, index=True)
    execution_id = db.Column(db.Integer, index=True)
    error_type = db.Column(db.String(50), nullable=False)
    error_code = db.Column(db.String(50))
    error_message = db.Column(db.Text)
    sample_data = db.Column(db.Text)
    detected_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_reported = db.Column(db.Boolean, default=False)
    reported_at = db.Column(db.DateTime)
    report_id = db.Column(db.Integer, index=True)

    def to_dict(self):
        return {
            'id': self.id,
            'batch_id': self.batch_id,
            'supplier_code': self.supplier_code,
            'execution_id': self.execution_id,
            'error_type': self.error_type,
            'error_code': self.error_code,
            'error_message': self.error_message,
            'sample_data': self.sample_data,
            'detected_at': self.detected_at.isoformat() if self.detected_at else None,
            'is_reported': self.is_reported,
            'reported_at': self.reported_at.isoformat() if self.reported_at else None,
            'report_id': self.report_id
        }
