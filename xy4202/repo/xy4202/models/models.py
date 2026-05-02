from datetime import datetime
from extensions import db

class Site(db.Model):
    __tablename__ = 'sites'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(255))
    contact_person = db.Column(db.String(50))
    phone = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    inventory = db.relationship('Inventory', backref='site', lazy=True)
    rentals = db.relationship('Rental', backref='site', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'address': self.address,
            'contact_person': self.contact_person,
            'phone': self.phone,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class EquipmentType(db.Model):
    __tablename__ = 'equipment_types'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    deposit_amount = db.Column(db.Float, default=0.0)
    daily_rental_fee = db.Column(db.Float, default=0.0)
    late_fee_per_day = db.Column(db.Float, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关系
    equipment = db.relationship('Equipment', backref='equipment_type', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'deposit_amount': self.deposit_amount,
            'daily_rental_fee': self.daily_rental_fee,
            'late_fee_per_day': self.late_fee_per_day,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Equipment(db.Model):
    __tablename__ = 'equipment'
    
    id = db.Column(db.Integer, primary_key=True)
    equipment_type_id = db.Column(db.Integer, db.ForeignKey('equipment_types.id'), nullable=False)
    serial_number = db.Column(db.String(50), unique=True)
    name = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), default='available')  # available, in_use, maintenance, retired
    purchase_date = db.Column(db.Date)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    inventory = db.relationship('Inventory', backref='equipment', lazy=True)
    rentals = db.relationship('Rental', backref='equipment', lazy=True)
    maintenance_records = db.relationship('Maintenance', backref='equipment', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'equipment_type_id': self.equipment_type_id,
            'equipment_type_name': self.equipment_type.name if self.equipment_type else None,
            'serial_number': self.serial_number,
            'name': self.name,
            'status': self.status,
            'purchase_date': self.purchase_date.isoformat() if self.purchase_date else None,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Inventory(db.Model):
    __tablename__ = 'inventory'
    
    id = db.Column(db.Integer, primary_key=True)
    site_id = db.Column(db.Integer, db.ForeignKey('sites.id'), nullable=False)
    equipment_id = db.Column(db.Integer, db.ForeignKey('equipment.id'), nullable=False)
    quantity = db.Column(db.Integer, default=1)
    available_quantity = db.Column(db.Integer, default=1)
    location = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'site_id': self.site_id,
            'site_name': self.site.name if self.site else None,
            'equipment_id': self.equipment_id,
            'equipment_name': self.equipment.name if self.equipment else None,
            'quantity': self.quantity,
            'available_quantity': self.available_quantity,
            'location': self.location,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Member(db.Model):
    __tablename__ = 'members'
    
    id = db.Column(db.Integer, primary_key=True)
    member_number = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(50), nullable=False)
    id_card = db.Column(db.String(20))
    phone = db.Column(db.String(20))
    address = db.Column(db.String(255))
    gender = db.Column(db.String(10))
    birth_date = db.Column(db.Date)
    is_blacklisted = db.Column(db.Boolean, default=False)
    blacklist_reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    bookings = db.relationship('Booking', backref='member', lazy=True)
    rentals = db.relationship('Rental', backref='member', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'member_number': self.member_number,
            'name': self.name,
            'id_card': self.id_card,
            'phone': self.phone,
            'address': self.address,
            'gender': self.gender,
            'birth_date': self.birth_date.isoformat() if self.birth_date else None,
            'is_blacklisted': self.is_blacklisted,
            'blacklist_reason': self.blacklist_reason,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Booking(db.Model):
    __tablename__ = 'bookings'
    
    id = db.Column(db.Integer, primary_key=True)
    booking_number = db.Column(db.String(20), unique=True, nullable=False)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)
    equipment_type_id = db.Column(db.Integer, db.ForeignKey('equipment_types.id'), nullable=False)
    site_id = db.Column(db.Integer, db.ForeignKey('sites.id'), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, confirmed, completed, cancelled
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'booking_number': self.booking_number,
            'member_id': self.member_id,
            'member_name': self.member.name if self.member else None,
            'equipment_type_id': self.equipment_type_id,
            'site_id': self.site_id,
            'site_name': self.site.name if self.site else None,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'status': self.status,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Rental(db.Model):
    __tablename__ = 'rentals'
    
    id = db.Column(db.Integer, primary_key=True)
    rental_number = db.Column(db.String(20), unique=True, nullable=False)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)
    equipment_id = db.Column(db.Integer, db.ForeignKey('equipment.id'), nullable=False)
    site_id = db.Column(db.Integer, db.ForeignKey('sites.id'), nullable=False)
    booking_id = db.Column(db.Integer, db.ForeignKey('bookings.id'), nullable=True)
    start_date = db.Column(db.Date, nullable=False)
    expected_return_date = db.Column(db.Date, nullable=False)
    actual_return_date = db.Column(db.Date)
    deposit_paid = db.Column(db.Float, default=0.0)
    rental_fee = db.Column(db.Float, default=0.0)
    late_fee = db.Column(db.Float, default=0.0)
    total_fee = db.Column(db.Float, default=0.0)
    status = db.Column(db.String(20), default='active')  # active, returned, overdue
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'rental_number': self.rental_number,
            'member_id': self.member_id,
            'member_name': self.member.name if self.member else None,
            'equipment_id': self.equipment_id,
            'equipment_name': self.equipment.name if self.equipment else None,
            'site_id': self.site_id,
            'site_name': self.site.name if self.site else None,
            'booking_id': self.booking_id,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'expected_return_date': self.expected_return_date.isoformat() if self.expected_return_date else None,
            'actual_return_date': self.actual_return_date.isoformat() if self.actual_return_date else None,
            'deposit_paid': self.deposit_paid,
            'rental_fee': self.rental_fee,
            'late_fee': self.late_fee,
            'total_fee': self.total_fee,
            'status': self.status,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Maintenance(db.Model):
    __tablename__ = 'maintenance'
    
    id = db.Column(db.Integer, primary_key=True)
    equipment_id = db.Column(db.Integer, db.ForeignKey('equipment.id'), nullable=False)
    site_id = db.Column(db.Integer, db.ForeignKey('sites.id'), nullable=False)
    maintenance_type = db.Column(db.String(20), default='maintenance')  # maintenance, repair, storage
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date)
    reason = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), default='in_progress')  # in_progress, completed
    cost = db.Column(db.Float, default=0.0)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'equipment_id': self.equipment_id,
            'equipment_name': self.equipment.name if self.equipment else None,
            'site_id': self.site_id,
            'site_name': self.site.name if self.site else None,
            'maintenance_type': self.maintenance_type,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'reason': self.reason,
            'status': self.status,
            'cost': self.cost,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    action = db.Column(db.String(50), nullable=False)
    target_type = db.Column(db.String(50), nullable=False)
    target_id = db.Column(db.Integer, nullable=False)
    details = db.Column(db.Text)
    operator = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'action': self.action,
            'target_type': self.target_type,
            'target_id': self.target_id,
            'details': self.details,
            'operator': self.operator,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
