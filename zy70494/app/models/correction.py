from datetime import datetime
from app import db

class ManualCorrection(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.String(50), nullable=False, index=True)
    supplier_code = db.Column(db.String(50), nullable=False, index=True)
    execution_id = db.Column(db.Integer, index=True)
    error_sample_id = db.Column(db.Integer, index=True)
    original_status = db.Column(db.String(50))
    corrected_status = db.Column(db.String(50))
    original_risk_level = db.Column(db.String(20))
    corrected_risk_level = db.Column(db.String(20))
    correction_note = db.Column(db.Text, nullable=False)
    corrected_by = db.Column(db.String(100), nullable=False)
    corrected_at = db.Column(db.DateTime, default=datetime.utcnow)
    system_judgment_preserved = db.Column(db.Boolean, default=True)
    original_system_judgment = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id,
            'batch_id': self.batch_id,
            'supplier_code': self.supplier_code,
            'execution_id': self.execution_id,
            'error_sample_id': self.error_sample_id,
            'original_status': self.original_status,
            'corrected_status': self.corrected_status,
            'original_risk_level': self.original_risk_level,
            'corrected_risk_level': self.corrected_risk_level,
            'correction_note': self.correction_note,
            'corrected_by': self.corrected_by,
            'corrected_at': self.corrected_at.isoformat() if self.corrected_at else None,
            'system_judgment_preserved': self.system_judgment_preserved,
            'original_system_judgment': self.original_system_judgment
        }
