from datetime import datetime
from app import db


class Issue(db.Model):
    __tablename__ = 'issue'

    id = db.Column(db.Integer, primary_key=True)
    
    issue_type = db.Column(db.String(100), nullable=False, index=True)
    severity = db.Column(db.String(20), default='warning', index=True)
    
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    
    pottery_id = db.Column(db.Integer, db.ForeignKey('pottery.id'), nullable=True, index=True)
    group_id = db.Column(db.Integer, db.ForeignKey('splice_group.id'), nullable=True, index=True)
    
    related_entity = db.Column(db.String(100))
    related_entity_id = db.Column(db.String(100))
    
    rule_name = db.Column(db.String(100))
    rule_details = db.Column(db.Text)
    
    status = db.Column(db.String(50), default='open', index=True)
    
    assigned_to = db.Column(db.String(100))
    resolved_at = db.Column(db.DateTime)
    resolved_by = db.Column(db.String(100))
    resolution_notes = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    detected_by = db.Column(db.String(100))
    
    def to_dict(self):
        return {
            'id': self.id,
            'issue_type': self.issue_type,
            'severity': self.severity,
            'title': self.title,
            'description': self.description,
            'pottery_id': self.pottery.pottery_id if self.pottery else None,
            'group_id': self.splice_group.group_id if self.splice_group else None,
            'related_entity': self.related_entity,
            'related_entity_id': self.related_entity_id,
            'rule_name': self.rule_name,
            'rule_details': self.rule_details,
            'status': self.status,
            'assigned_to': self.assigned_to,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'resolved_by': self.resolved_by,
            'resolution_notes': self.resolution_notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'detected_by': self.detected_by
        }
    
    def __repr__(self):
        return f'<Issue {self.issue_type}:{self.title}>'
