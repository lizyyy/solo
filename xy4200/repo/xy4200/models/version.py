from datetime import datetime
from app import db


class Version(db.Model):
    __tablename__ = 'version'

    id = db.Column(db.Integer, primary_key=True)
    
    entity_type = db.Column(db.String(50), nullable=False, index=True)
    entity_id = db.Column(db.String(100), nullable=False, index=True)
    
    version_number = db.Column(db.Integer, nullable=False)
    
    data = db.Column(db.Text, nullable=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    created_by = db.Column(db.String(100))
    
    change_reason = db.Column(db.Text)
    
    __table_args__ = (
        db.UniqueConstraint('entity_type', 'entity_id', 'version_number', name='_entity_version_uc'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'version_number': self.version_number,
            'data': self.data,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'created_by': self.created_by,
            'change_reason': self.change_reason
        }
    
    def __repr__(self):
        return f'<Version {self.entity_type}:{self.entity_id}:v{self.version_number}>'
