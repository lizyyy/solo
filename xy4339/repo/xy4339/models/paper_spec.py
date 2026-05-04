from extensions import db
from datetime import datetime

class PaperSpec(db.Model):
    __tablename__ = 'paper_spec'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    width = db.Column(db.Float, nullable=False)
    height = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(10), default='mm')
    description = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    stocks = db.relationship('PaperStock', backref='spec', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'width': self.width,
            'height': self.height,
            'unit': self.unit,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def get_area(self):
        return self.width * self.height
    
    def __repr__(self):
        return f'<PaperSpec {self.name}: {self.width}x{self.height}{self.unit}>'
