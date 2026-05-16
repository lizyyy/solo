from datetime import datetime
from app import db

class CompressionStrategy(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    strategy_code = db.Column(db.String(50), nullable=False, unique=True)
    strategy_name = db.Column(db.String(200), nullable=False)
    risk_threshold = db.Column(db.Float, default=0.7)
    compression_level = db.Column(db.Integer, default=5)
    applicable_risk_types = db.Column(db.String(500))
    explanation_before = db.Column(db.Text)
    explanation_after = db.Column(db.Text)
    created_by = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': self.id,
            'strategy_code': self.strategy_code,
            'strategy_name': self.strategy_name,
            'risk_threshold': self.risk_threshold,
            'compression_level': self.compression_level,
            'applicable_risk_types': self.applicable_risk_types,
            'explanation_before': self.explanation_before,
            'explanation_after': self.explanation_after,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'is_active': self.is_active
        }

class CompressionExecution(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.String(50), nullable=False, index=True)
    supplier_code = db.Column(db.String(50), nullable=False, index=True)
    strategy_code = db.Column(db.String(50), nullable=False)
    original_data_hash = db.Column(db.String(64))
    compressed_data_hash = db.Column(db.String(64))
    original_size = db.Column(db.Integer)
    compressed_size = db.Column(db.Integer)
    compression_ratio = db.Column(db.Float)
    risk_score = db.Column(db.Float)
    status = db.Column(db.String(20), default='pending')
    error_code = db.Column(db.String(50))
    error_message = db.Column(db.Text)
    executed_by = db.Column(db.String(100))
    executed_at = db.Column(db.DateTime, default=datetime.utcnow)
    rerun_flag = db.Column(db.String(50))
    parent_execution_id = db.Column(db.Integer)

    def to_dict(self):
        return {
            'id': self.id,
            'batch_id': self.batch_id,
            'supplier_code': self.supplier_code,
            'strategy_code': self.strategy_code,
            'original_data_hash': self.original_data_hash,
            'compressed_data_hash': self.compressed_data_hash,
            'original_size': self.original_size,
            'compressed_size': self.compressed_size,
            'compression_ratio': self.compression_ratio,
            'risk_score': self.risk_score,
            'status': self.status,
            'error_code': self.error_code,
            'error_message': self.error_message,
            'executed_by': self.executed_by,
            'executed_at': self.executed_at.isoformat() if self.executed_at else None,
            'rerun_flag': self.rerun_flag,
            'parent_execution_id': self.parent_execution_id
        }
