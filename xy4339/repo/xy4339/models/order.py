from extensions import db
from datetime import datetime
from enum import Enum

class OrderStatus(Enum):
    DRAFT = 'draft'
    QUOTED = 'quoted'
    CONFIRMED = 'confirmed'
    IN_PRODUCTION = 'in_production'
    COMPLETED = 'completed'
    CANCELLED = 'cancelled'

class Order(db.Model):
    __tablename__ = 'orders'
    
    id = db.Column(db.Integer, primary_key=True)
    order_number = db.Column(db.String(50), unique=True, nullable=False)
    customer_name = db.Column(db.String(100))
    customer_phone = db.Column(db.String(20))
    customer_company = db.Column(db.String(100))
    status = db.Column(db.String(20), default=OrderStatus.DRAFT.value)
    is_urgent = db.Column(db.Boolean, default=False)
    urgent_reason = db.Column(db.String(200))
    required_date = db.Column(db.Date)
    actual_complete_date = db.Column(db.Date)
    notes = db.Column(db.Text)
    total_amount = db.Column(db.Float, default=0)
    discount_percent = db.Column(db.Float, default=0)
    discount_amount = db.Column(db.Float, default=0)
    final_amount = db.Column(db.Float, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.String(50))
    
    items = db.relationship('OrderItem', backref='order', lazy='dynamic', 
                            cascade='all, delete-orphan')
    cutting_plans = db.relationship('CuttingPlan', backref='order', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'order_number': self.order_number,
            'customer_name': self.customer_name,
            'customer_phone': self.customer_phone,
            'customer_company': self.customer_company,
            'status': self.status,
            'status_display': OrderStatus(self.status).name if self.status else None,
            'is_urgent': self.is_urgent,
            'urgent_reason': self.urgent_reason,
            'required_date': self.required_date.isoformat() if self.required_date else None,
            'actual_complete_date': self.actual_complete_date.isoformat() if self.actual_complete_date else None,
            'notes': self.notes,
            'total_amount': self.total_amount,
            'discount_percent': self.discount_percent,
            'discount_amount': self.discount_amount,
            'final_amount': self.final_amount,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'created_by': self.created_by
        }
    
    def generate_order_number(self):
        now = datetime.now()
        return f'ORD{now.year}{now.month:02d}{now.day:02d}{now.hour:02d}{now.minute:02d}'
    
    def can_modify(self):
        return self.status in [OrderStatus.DRAFT.value, OrderStatus.QUOTED.value]
    
    def get_status_display(self):
        status_map = {
            'draft': '草稿',
            'quoted': '已报价',
            'confirmed': '已确认',
            'in_production': '生产中',
            'completed': '已完成',
            'cancelled': '已取消'
        }
        return status_map.get(self.status, self.status)
    
    def __repr__(self):
        return f'<Order {self.order_number} - {self.get_status_display()}>'
