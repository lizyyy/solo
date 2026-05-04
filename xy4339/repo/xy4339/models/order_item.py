from extensions import db
from datetime import datetime
from enum import Enum

class GrainDirection(Enum):
    SHORT = 'short'
    LONG = 'long'
    ANY = 'any'

class OrderItem(db.Model):
    __tablename__ = 'order_items'
    
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    product_name = db.Column(db.String(200), nullable=False)
    finished_width = db.Column(db.Float, nullable=False)
    finished_height = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(10), default='mm')
    quantity = db.Column(db.Integer, nullable=False)
    paper_type = db.Column(db.String(20))
    paper_weight = db.Column(db.Float)
    paper_color = db.Column(db.String(30), default='white')
    grain_direction = db.Column(db.String(10), default='any')
    double_sided = db.Column(db.Boolean, default=False)
    bleed = db.Column(db.Float, default=0)
    margin = db.Column(db.Float, default=10)
    notes = db.Column(db.Text)
    unit_price = db.Column(db.Float, default=0)
    total_price = db.Column(db.Float, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    cutting_plans = db.relationship('CuttingPlan', backref='order_item', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'product_name': self.product_name,
            'finished_width': self.finished_width,
            'finished_height': self.finished_height,
            'unit': self.unit,
            'quantity': self.quantity,
            'paper_type': self.paper_type,
            'paper_weight': self.paper_weight,
            'paper_color': self.paper_color,
            'grain_direction': self.grain_direction,
            'grain_direction_display': self.get_grain_direction_display(),
            'double_sided': self.double_sided,
            'bleed': self.bleed,
            'margin': self.margin,
            'notes': self.notes,
            'unit_price': self.unit_price,
            'total_price': self.total_price,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def get_grain_direction_display(self):
        direction_map = {
            'short': '短边',
            'long': '长边',
            'any': '不限'
        }
        return direction_map.get(self.grain_direction, self.grain_direction)
    
    def get_effective_size(self):
        return {
            'width': self.finished_width + (self.bleed * 2),
            'height': self.finished_height + (self.bleed * 2)
        }
    
    def get_area(self):
        effective = self.get_effective_size()
        return effective['width'] * effective['height'] * self.quantity
    
    def __repr__(self):
        return f'<OrderItem {self.product_name}: {self.finished_width}x{self.finished_height} x {self.quantity}>'
