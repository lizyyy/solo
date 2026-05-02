from datetime import datetime
from app import db


class AuditLog(db.Model):
    __tablename__ = 'audit_log'

    id = db.Column(db.Integer, primary_key=True)
    
    action = db.Column(db.String(50), nullable=False, index=True)
    entity_type = db.Column(db.String(50), nullable=False, index=True)
    entity_id = db.Column(db.String(100), nullable=False, index=True)
    
    old_values = db.Column(db.Text)
    new_values = db.Column(db.Text)
    
    user = db.Column(db.String(100), index=True)
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.String(500))
    
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    notes = db.Column(db.Text)
    
    def to_dict(self):
        return {
            'id': self.id,
            'action': self.action,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'old_values': self.old_values,
            'new_values': self.new_values,
            'user': self.user,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'notes': self.notes
        }
    
    def __repr__(self):
        return f'<AuditLog {self.action}:{self.entity_type}:{self.entity_id}>'
