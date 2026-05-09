from datetime import datetime
from app import db


class SparePart(db.Model):
    __tablename__ = 'spare_parts'
    
    id = db.Column(db.Integer, primary_key=True)
    part_code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    part_name = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(100))
    unit = db.Column(db.String(20))
    unit_price = db.Column(db.Float, default=0.0)
    
    total_stock = db.Column(db.Integer, default=0)
    min_stock = db.Column(db.Integer, default=0)
    safety_stock = db.Column(db.Integer, default=0)
    
    reserved_qty = db.Column(db.Integer, default=0)
    available_qty = db.Column(db.Integer, default=0)
    
    location = db.Column(db.String(100))
    supplier = db.Column(db.String(200))
    lead_time_days = db.Column(db.Integer, default=7)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'part_code': self.part_code,
            'part_name': self.part_name,
            'category': self.category,
            'unit': self.unit,
            'unit_price': self.unit_price,
            'total_stock': self.total_stock,
            'min_stock': self.min_stock,
            'safety_stock': self.safety_stock,
            'reserved_qty': self.reserved_qty,
            'available_qty': self.available_qty,
            'location': self.location,
            'supplier': self.supplier,
            'lead_time_days': self.lead_time_days,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class PartSubstitution(db.Model):
    __tablename__ = 'part_substitutions'
    
    id = db.Column(db.Integer, primary_key=True)
    original_part_code = db.Column(db.String(50), nullable=False, index=True)
    substitute_part_code = db.Column(db.String(50), nullable=False, index=True)
    priority = db.Column(db.Integer, default=1)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint('original_part_code', 'substitute_part_code', name='uix_original_substitute'),
    )


class WorkOrder(db.Model):
    __tablename__ = 'work_orders'
    
    id = db.Column(db.Integer, primary_key=True)
    order_no = db.Column(db.String(50), unique=True, nullable=False, index=True)
    equipment_id = db.Column(db.String(50))
    equipment_name = db.Column(db.String(200))
    order_type = db.Column(db.String(50))
    priority = db.Column(db.String(20), default='NORMAL')
    
    status = db.Column(db.String(50), default='PENDING')
    
    created_by = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    
    def to_dict(self):
        return {
            'id': self.id,
            'order_no': self.order_no,
            'equipment_id': self.equipment_id,
            'equipment_name': self.equipment_name,
            'order_type': self.order_type,
            'priority': self.priority,
            'status': self.status,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }


class Reservation(db.Model):
    __tablename__ = 'reservations'
    
    id = db.Column(db.Integer, primary_key=True)
    reservation_id = db.Column(db.String(100), unique=True, nullable=False, index=True)
    
    order_no = db.Column(db.String(50), nullable=False, index=True)
    part_code = db.Column(db.String(50), nullable=False, index=True)
    part_name = db.Column(db.String(200))
    
    requested_qty = db.Column(db.Integer, nullable=False)
    reserved_qty = db.Column(db.Integer, default=0)
    used_qty = db.Column(db.Integer, default=0)
    released_qty = db.Column(db.Integer, default=0)
    
    status = db.Column(db.String(50), default='PENDING')
    
    used_substitute = db.Column(db.Boolean, default=False)
    substitute_part_code = db.Column(db.String(50))
    
    reserved_by = db.Column(db.String(100))
    reserved_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint('order_no', 'part_code', name='uix_order_part'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'reservation_id': self.reservation_id,
            'order_no': self.order_no,
            'part_code': self.part_code,
            'part_name': self.part_name,
            'requested_qty': self.requested_qty,
            'reserved_qty': self.reserved_qty,
            'used_qty': self.used_qty,
            'released_qty': self.released_qty,
            'status': self.status,
            'used_substitute': self.used_substitute,
            'substitute_part_code': self.substitute_part_code,
            'reserved_by': self.reserved_by,
            'reserved_at': self.reserved_at.isoformat() if self.reserved_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class StockAlarm(db.Model):
    __tablename__ = 'stock_alarms'
    
    id = db.Column(db.Integer, primary_key=True)
    alarm_id = db.Column(db.String(100), unique=True, nullable=False, index=True)
    
    part_code = db.Column(db.String(50), nullable=False, index=True)
    part_name = db.Column(db.String(200))
    
    alarm_type = db.Column(db.String(50))
    alarm_level = db.Column(db.String(20))
    
    current_stock = db.Column(db.Integer)
    reserved_qty = db.Column(db.Integer)
    available_qty = db.Column(db.Integer)
    min_stock = db.Column(db.Integer)
    safety_stock = db.Column(db.Integer)
    
    related_order_no = db.Column(db.String(50))
    related_reservation_id = db.Column(db.String(100))
    
    message = db.Column(db.Text)
    needs_review = db.Column(db.Boolean, default=False)
    reviewed = db.Column(db.Boolean, default=False)
    reviewed_by = db.Column(db.String(100))
    reviewed_at = db.Column(db.DateTime)
    review_note = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    resolved_at = db.Column(db.DateTime)
    
    def to_dict(self):
        return {
            'id': self.id,
            'alarm_id': self.alarm_id,
            'part_code': self.part_code,
            'part_name': self.part_name,
            'alarm_type': self.alarm_type,
            'alarm_level': self.alarm_level,
            'current_stock': self.current_stock,
            'reserved_qty': self.reserved_qty,
            'available_qty': self.available_qty,
            'min_stock': self.min_stock,
            'safety_stock': self.safety_stock,
            'related_order_no': self.related_order_no,
            'related_reservation_id': self.related_reservation_id,
            'message': self.message,
            'needs_review': self.needs_review,
            'reviewed': self.reviewed,
            'reviewed_by': self.reviewed_by,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'review_note': self.review_note,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None
        }


class IdempotentRequest(db.Model):
    __tablename__ = 'idempotent_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    request_key = db.Column(db.String(255), unique=True, nullable=False, index=True)
    endpoint = db.Column(db.String(200))
    request_body = db.Column(db.Text)
    response_body = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)


class OperationLog(db.Model):
    __tablename__ = 'operation_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    log_id = db.Column(db.String(100), unique=True, nullable=False, index=True)
    
    operation_type = db.Column(db.String(50))
    order_no = db.Column(db.String(50))
    part_code = db.Column(db.String(50))
    
    before_state = db.Column(db.Text)
    after_state = db.Column(db.Text)
    change_qty = db.Column(db.Integer)
    change_amount = db.Column(db.Float, default=0.0)
    
    operator = db.Column(db.String(100))
    operation_time = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    note = db.Column(db.Text)
    
    def to_dict(self):
        return {
            'id': self.id,
            'log_id': self.log_id,
            'operation_type': self.operation_type,
            'order_no': self.order_no,
            'part_code': self.part_code,
            'change_qty': self.change_qty,
            'change_amount': self.change_amount,
            'operator': self.operator,
            'operation_time': self.operation_time.isoformat() if self.operation_time else None,
            'note': self.note
        }
