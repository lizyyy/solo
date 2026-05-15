from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import JSON, Index, func

db = SQLAlchemy()

class PlatformOrder(db.Model):
    __tablename__ = 'platform_orders'
    
    id = db.Column(db.Integer, primary_key=True)
    platform = db.Column(db.String(50), nullable=False, index=True)
    platform_order_id = db.Column(db.String(100), nullable=False, index=True)
    unified_order_id = db.Column(db.Integer, db.ForeignKey('unified_orders.id'), nullable=True)
    raw_data = db.Column(JSON, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_platform_order', 'platform', 'platform_order_id', unique=True),
    )

class CallbackPayload(db.Model):
    __tablename__ = 'callback_payloads'
    
    id = db.Column(db.Integer, primary_key=True)
    platform_order_id = db.Column(db.Integer, db.ForeignKey('platform_orders.id'), nullable=False)
    event_type = db.Column(db.String(50), nullable=False, index=True)
    event_id = db.Column(db.String(100), nullable=False, index=True)
    payload = db.Column(JSON, nullable=False)
    normalized_data = db.Column(JSON, nullable=True)
    received_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    is_duplicate = db.Column(db.Boolean, default=False)
    duplicate_of = db.Column(db.Integer, db.ForeignKey('callback_payloads.id'), nullable=True)
    
    platform_order = db.relationship('PlatformOrder', backref=db.backref('callbacks', lazy=True))
    
    __table_args__ = (
        Index('idx_event_platform', 'event_id', 'platform_order_id', unique=True),
    )

class UnifiedOrder(db.Model):
    __tablename__ = 'unified_orders'
    
    id = db.Column(db.Integer, primary_key=True)
    unified_order_no = db.Column(db.String(100), unique=True, nullable=False, index=True)
    status = db.Column(db.String(50), nullable=False, default='pending', index=True)
    amount = db.Column(db.Numeric(10, 2), nullable=True)
    currency = db.Column(db.String(10), nullable=True)
    customer_info = db.Column(JSON, nullable=True)
    items = db.Column(JSON, nullable=True)
    merged_data = db.Column(JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    platform_orders = db.relationship('PlatformOrder', backref='unified_order', lazy=True)
    exceptions = db.relationship('ExceptionReceipt', backref='unified_order', lazy=True)

class MergeRule(db.Model):
    __tablename__ = 'merge_rules'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    rule_type = db.Column(db.String(50), nullable=False, index=True)
    platform = db.Column(db.String(50), nullable=True, index=True)
    config = db.Column(JSON, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    priority = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ExceptionReceipt(db.Model):
    __tablename__ = 'exception_receipts'
    
    id = db.Column(db.Integer, primary_key=True)
    unified_order_id = db.Column(db.Integer, db.ForeignKey('unified_orders.id'), nullable=False)
    callback_payload_id = db.Column(db.Integer, db.ForeignKey('callback_payloads.id'), nullable=True)
    exception_type = db.Column(db.String(50), nullable=False, index=True)
    severity = db.Column(db.String(20), nullable=False, default='warning')
    message = db.Column(db.Text, nullable=False)
    raw_data = db.Column(JSON, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='open')
    resolved_by = db.Column(db.String(100), nullable=True)
    resolved_at = db.Column(db.DateTime, nullable=True)
    resolution_note = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

class SearchIndex(db.Model):
    __tablename__ = 'search_indices'
    
    id = db.Column(db.Integer, primary_key=True)
    unified_order_id = db.Column(db.Integer, db.ForeignKey('unified_orders.id'), nullable=False)
    search_key = db.Column(db.String(100), nullable=False, index=True)
    search_value = db.Column(db.String(500), nullable=False, index=True)
    value_type = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_search_kv', 'search_key', 'search_value'),
    )

def init_db(app):
    db.init_app(app)
    with app.app_context():
        db.create_all()
        from app.services import _init_default_rules
        _init_default_rules()