from datetime import datetime
from app import db

class ExecutionBatch(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.String(50), nullable=False, unique=True, index=True)
    batch_type = db.Column(db.String(50), nullable=False)
    operator = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), default='running')
    risk_type = db.Column(db.String(50))
    total_count = db.Column(db.Integer, default=0)
    success_count = db.Column(db.Integer, default=0)
    error_count = db.Column(db.Integer, default=0)
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    remarks = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id,
            'batch_id': self.batch_id,
            'batch_type': self.batch_type,
            'operator': self.operator,
            'status': self.status,
            'risk_type': self.risk_type,
            'total_count': self.total_count,
            'success_count': self.success_count,
            'error_count': self.error_count,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'remarks': self.remarks
        }
