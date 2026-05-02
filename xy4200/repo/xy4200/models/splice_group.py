from datetime import datetime
from app import db


class PotteryGroupAssociation(db.Model):
    __tablename__ = 'pottery_group_association'

    id = db.Column(db.Integer, primary_key=True)
    pottery_id = db.Column(db.Integer, db.ForeignKey('pottery.id'), nullable=False, index=True)
    group_id = db.Column(db.Integer, db.ForeignKey('splice_group.id'), nullable=False, index=True)
    
    edge_position = db.Column(db.String(50))
    edge_length = db.Column(db.Float)
    match_confidence = db.Column(db.Float)
    match_notes = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    pottery = db.relationship('Pottery', back_populates='associations')
    group = db.relationship('SpliceGroup', back_populates='associations')
    
    __table_args__ = (
        db.UniqueConstraint('pottery_id', 'group_id', name='_pottery_group_uc'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'pottery_id': self.pottery.pottery_id if self.pottery else None,
            'group_id': self.group.group_id if self.group else None,
            'edge_position': self.edge_position,
            'edge_length': self.edge_length,
            'match_confidence': self.match_confidence,
            'match_notes': self.match_notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class SpliceGroup(db.Model):
    __tablename__ = 'splice_group'

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    
    name = db.Column(db.String(200))
    description = db.Column(db.Text)
    
    status = db.Column(db.String(50), default='draft', index=True)
    
    guess_evidence = db.Column(db.Text)
    guess_submitted_by = db.Column(db.String(100))
    guess_submitted_at = db.Column(db.DateTime)
    
    review_notes = db.Column(db.Text)
    reviewed_by = db.Column(db.String(100))
    reviewed_at = db.Column(db.DateTime)
    review_result = db.Column(db.String(50))
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.String(100))
    updated_by = db.Column(db.String(100))
    
    version = db.Column(db.Integer, default=1)
    
    associations = db.relationship('PotteryGroupAssociation', back_populates='group',
                                   cascade='all, delete-orphan')
    issues = db.relationship('Issue', backref='splice_group', lazy='dynamic',
                              cascade='all, delete-orphan')
    
    def get_potteries(self):
        return [assoc.pottery for assoc in self.associations]
    
    def get_pottery_ids(self):
        return [assoc.pottery.pottery_id for assoc in self.associations]
    
    def to_dict(self, include_potteries=False, include_issues=False):
        data = {
            'id': self.id,
            'group_id': self.group_id,
            'name': self.name,
            'description': self.description,
            'status': self.status,
            'guess_evidence': self.guess_evidence,
            'guess_submitted_by': self.guess_submitted_by,
            'guess_submitted_at': self.guess_submitted_at.isoformat() if self.guess_submitted_at else None,
            'review_notes': self.review_notes,
            'reviewed_by': self.reviewed_by,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'review_result': self.review_result,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'created_by': self.created_by,
            'updated_by': self.updated_by,
            'version': self.version,
            'pottery_count': len(self.associations)
        }
        if include_potteries:
            data['potteries'] = [assoc.to_dict() for assoc in self.associations]
        if include_issues:
            data['issues'] = [issue.to_dict() for issue in self.issues.all()]
        return data
    
    def __repr__(self):
        return f'<SpliceGroup {self.group_id}>'
