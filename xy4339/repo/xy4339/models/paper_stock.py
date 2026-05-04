from extensions import db
from datetime import datetime
from enum import Enum

class PaperType(Enum):
    COATED = 'coated'
    UNCOATED = 'uncoated'
    ART = 'art'
    CARDBOARD = 'cardboard'
    OTHER = 'other'

class PaperStock(db.Model):
    __tablename__ = 'paper_stock'
    
    id = db.Column(db.Integer, primary_key=True)
    spec_id = db.Column(db.Integer, db.ForeignKey('paper_spec.id'), nullable=False)
    paper_type = db.Column(db.String(20), default='other')
    weight = db.Column(db.Float, nullable=False)
    color = db.Column(db.String(30), default='white')
    unit_price = db.Column(db.Float, nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=0)
    min_quantity = db.Column(db.Integer, default=0)
    batch_number = db.Column(db.String(50))
    supplier = db.Column(db.String(100))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    transactions = db.relationship('StockTransaction', backref='stock', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'spec_id': self.spec_id,
            'spec_name': self.spec.name if self.spec else None,
            'spec_width': self.spec.width if self.spec else None,
            'spec_height': self.spec.height if self.spec else None,
            'paper_type': self.paper_type,
            'weight': self.weight,
            'color': self.color,
            'unit_price': self.unit_price,
            'quantity': self.quantity,
            'min_quantity': self.min_quantity,
            'batch_number': self.batch_number,
            'supplier': self.supplier,
            'notes': self.notes,
            'is_low_stock': self.quantity <= self.min_quantity,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def check_availability(self, required_quantity):
        return self.quantity >= required_quantity
    
    def get_shortage(self, required_quantity):
        return max(0, required_quantity - self.quantity)
    
    def __repr__(self):
        return f'<PaperStock {self.spec.name} {self.weight}g {self.quantity} sheets>'
