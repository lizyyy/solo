from extensions import db
from datetime import datetime

class Battery(db.Model):
    __tablename__ = 'batteries'
    
    id = db.Column(db.Integer, primary_key=True)
    battery_code = db.Column(db.String(50), unique=True, nullable=False)
    status = db.Column(db.String(20), default='available')
    current_temperature = db.Column(db.Float, default=25.0)
    current_door_id = db.Column(db.Integer, db.ForeignKey('cabinet_doors.id'), nullable=True)
    last_swapped_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.utcnow())
    updated_at = db.Column(db.DateTime, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())
    
    def to_dict(self):
        return {
            'id': self.id,
            'battery_code': self.battery_code,
            'status': self.status,
            'current_temperature': self.current_temperature,
            'current_door_id': self.current_door_id,
            'last_swapped_at': self.last_swapped_at.isoformat() if self.last_swapped_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class CabinetDoor(db.Model):
    __tablename__ = 'cabinet_doors'
    
    id = db.Column(db.Integer, primary_key=True)
    door_number = db.Column(db.String(10), unique=True, nullable=False)
    status = db.Column(db.String(20), default='available')
    is_jammed = db.Column(db.Boolean, default=False)
    jammed_at = db.Column(db.DateTime, nullable=True)
    last_opened_at = db.Column(db.DateTime, nullable=True)
    last_closed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.utcnow())
    updated_at = db.Column(db.DateTime, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())
    
    batteries = db.relationship('Battery', backref='cabinet_door', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'door_number': self.door_number,
            'status': self.status,
            'is_jammed': self.is_jammed,
            'jammed_at': self.jammed_at.isoformat() if self.jammed_at else None,
            'last_opened_at': self.last_opened_at.isoformat() if self.last_opened_at else None,
            'last_closed_at': self.last_closed_at.isoformat() if self.last_closed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class SwapRecord(db.Model):
    __tablename__ = 'swap_records'
    
    id = db.Column(db.Integer, primary_key=True)
    swap_code = db.Column(db.String(50), unique=True, nullable=False)
    user_id = db.Column(db.String(50), nullable=False)
    old_battery_id = db.Column(db.Integer, db.ForeignKey('batteries.id'), nullable=True)
    new_battery_id = db.Column(db.Integer, db.ForeignKey('batteries.id'), nullable=True)
    old_door_id = db.Column(db.Integer, db.ForeignKey('cabinet_doors.id'), nullable=True)
    new_door_id = db.Column(db.Integer, db.ForeignKey('cabinet_doors.id'), nullable=True)
    swap_started_at = db.Column(db.DateTime, nullable=False)
    swap_completed_at = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), default='in_progress')
    amount = db.Column(db.Float, default=0.0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.utcnow())
    
    old_battery = db.relationship('Battery', foreign_keys=[old_battery_id], backref='outgoing_swaps')
    new_battery = db.relationship('Battery', foreign_keys=[new_battery_id], backref='incoming_swaps')
    
    def to_dict(self):
        return {
            'id': self.id,
            'swap_code': self.swap_code,
            'user_id': self.user_id,
            'old_battery_id': self.old_battery_id,
            'new_battery_id': self.new_battery_id,
            'old_door_id': self.old_door_id,
            'new_door_id': self.new_door_id,
            'swap_started_at': self.swap_started_at.isoformat() if self.swap_started_at else None,
            'swap_completed_at': self.swap_completed_at.isoformat() if self.swap_completed_at else None,
            'status': self.status,
            'amount': self.amount,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class MaintenanceOrder(db.Model):
    __tablename__ = 'maintenance_orders'
    
    id = db.Column(db.Integer, primary_key=True)
    order_code = db.Column(db.String(50), unique=True, nullable=False)
    issue_type = db.Column(db.String(50), nullable=False)
    door_id = db.Column(db.Integer, db.ForeignKey('cabinet_doors.id'), nullable=True)
    battery_id = db.Column(db.Integer, db.ForeignKey('batteries.id'), nullable=True)
    description = db.Column(db.Text, nullable=True)
    reporter = db.Column(db.String(50), nullable=True)
    status = db.Column(db.String(20), default='pending')
    created_at = db.Column(db.DateTime, default=lambda: datetime.utcnow())
    resolved_at = db.Column(db.DateTime, nullable=True)
    resolution = db.Column(db.Text, nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'order_code': self.order_code,
            'issue_type': self.issue_type,
            'door_id': self.door_id,
            'battery_id': self.battery_id,
            'description': self.description,
            'reporter': self.reporter,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'resolution': self.resolution
        }

class Dispute(db.Model):
    __tablename__ = 'disputes'
    
    DISPUTE_TYPES = [
        'wrong_battery_misplaced',
        'overtemp_not_isolated',
        'door_jammed_still_lent',
        'duplicate_billing'
    ]
    
    STATUS_TYPES = [
        'pending_review',
        'confirmed',
        'rejected',
        'resolved'
    ]
    
    id = db.Column(db.Integer, primary_key=True)
    dispute_code = db.Column(db.String(50), unique=True, nullable=False)
    dispute_type = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), default='pending_review')
    related_swap_id = db.Column(db.Integer, db.ForeignKey('swap_records.id'), nullable=True)
    related_battery_id = db.Column(db.Integer, db.ForeignKey('batteries.id'), nullable=True)
    related_door_id = db.Column(db.Integer, db.ForeignKey('cabinet_doors.id'), nullable=True)
    related_maintenance_id = db.Column(db.Integer, db.ForeignKey('maintenance_orders.id'), nullable=True)
    description = db.Column(db.Text, nullable=True)
    evidence = db.Column(db.Text, nullable=True)
    reviewer_id = db.Column(db.String(50), nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    review_comment = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.utcnow())
    updated_at = db.Column(db.DateTime, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())
    
    swap_record = db.relationship('SwapRecord', backref='disputes')
    battery = db.relationship('Battery', backref='disputes')
    cabinet_door = db.relationship('CabinetDoor', backref='disputes')
    maintenance_order = db.relationship('MaintenanceOrder', backref='disputes')
    
    def to_dict(self):
        return {
            'id': self.id,
            'dispute_code': self.dispute_code,
            'dispute_type': self.dispute_type,
            'status': self.status,
            'related_swap_id': self.related_swap_id,
            'related_battery_id': self.related_battery_id,
            'related_door_id': self.related_door_id,
            'related_maintenance_id': self.related_maintenance_id,
            'description': self.description,
            'evidence': self.evidence,
            'reviewer_id': self.reviewer_id,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'review_comment': self.review_comment,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class DoorSensorLog(db.Model):
    __tablename__ = 'door_sensor_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    log_time = db.Column(db.DateTime, nullable=False)
    door_id = db.Column(db.Integer, db.ForeignKey('cabinet_doors.id'), nullable=False)
    event_type = db.Column(db.String(20), nullable=False)
    sensor_reading = db.Column(db.Float, nullable=True)
    raw_data = db.Column(db.Text, nullable=True)
    processed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.utcnow())
    
    def to_dict(self):
        return {
            'id': self.id,
            'log_time': self.log_time.isoformat() if self.log_time else None,
            'door_id': self.door_id,
            'event_type': self.event_type,
            'sensor_reading': self.sensor_reading,
            'processed': self.processed,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class TemperatureLog(db.Model):
    __tablename__ = 'temperature_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    log_time = db.Column(db.DateTime, nullable=False)
    battery_id = db.Column(db.Integer, db.ForeignKey('batteries.id'), nullable=True)
    door_id = db.Column(db.Integer, db.ForeignKey('cabinet_doors.id'), nullable=True)
    temperature = db.Column(db.Float, nullable=False)
    raw_data = db.Column(db.Text, nullable=True)
    processed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.utcnow())
    
    def to_dict(self):
        return {
            'id': self.id,
            'log_time': self.log_time.isoformat() if self.log_time else None,
            'battery_id': self.battery_id,
            'door_id': self.door_id,
            'temperature': self.temperature,
            'processed': self.processed,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
