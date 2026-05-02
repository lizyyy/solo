from datetime import datetime
from app import db


class Pottery(db.Model):
    __tablename__ = 'pottery'

    id = db.Column(db.Integer, primary_key=True)
    pottery_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    
    trench = db.Column(db.String(50), nullable=False, index=True)
    layer = db.Column(db.String(50), nullable=False, index=True)
    square = db.Column(db.String(50))
    
    length = db.Column(db.Float)
    width = db.Column(db.Float)
    thickness = db.Column(db.Float)
    weight = db.Column(db.Float)
    
    decoration = db.Column(db.String(200))
    paste_type = db.Column(db.String(200))
    color = db.Column(db.String(100))
    
    photo_path = db.Column(db.String(500))
    photo_hash = db.Column(db.String(100))
    
    status = db.Column(db.String(50), default='pending', index=True)
    
    notes = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.String(100))
    updated_by = db.Column(db.String(100))
    
    version = db.Column(db.Integer, default=1)
    
    associations = db.relationship('PotteryGroupAssociation', back_populates='pottery',
                                   cascade='all, delete-orphan')
    issues = db.relationship('Issue', backref='pottery', lazy='dynamic',
                              cascade='all, delete-orphan')
    
    def to_dict(self, include_issues=False):
        data = {
            'id': self.id,
            'pottery_id': self.pottery_id,
            'trench': self.trench,
            'layer': self.layer,
            'square': self.square,
            'length': self.length,
            'width': self.width,
            'thickness': self.thickness,
            'weight': self.weight,
            'decoration': self.decoration,
            'paste_type': self.paste_type,
            'color': self.color,
            'photo_path': self.photo_path,
            'photo_hash': self.photo_hash,
            'status': self.status,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'created_by': self.created_by,
            'updated_by': self.updated_by,
            'version': self.version
        }
        if include_issues:
            data['issues'] = [issue.to_dict() for issue in self.issues.all()]
        return data
    
    def __repr__(self):
        return f'<Pottery {self.pottery_id}>'
