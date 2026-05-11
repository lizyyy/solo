from datetime import datetime
from app import db


class EquipmentType:
    HELMET = 'helmet'
    FOOD_BOX = 'food_box'
    RAINCOAT = 'raincoat'


class BatchStatus:
    PENDING_INSPECTION = 'pending_inspection'
    QUALIFIED = 'qualified'
    UNQUALIFIED = 'unqualified'


class EquipmentStatus:
    IN_STOCK = 'in_stock'
    ISSUED = 'issued'
    RETURNED = 'returned'
    DAMAGED = 'damaged'
    COMPENSATED = 'compensated'
    LOST = 'lost'


class EquipmentBatch(db.Model):
    __tablename__ = 'equipment_batches'

    id = db.Column(db.Integer, primary_key=True)
    batch_no = db.Column(db.String(50), unique=True, nullable=False, index=True)
    equipment_type = db.Column(db.String(20), nullable=False)
    supplier = db.Column(db.String(100), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    arrival_date = db.Column(db.Date, nullable=False)
    inspection_date = db.Column(db.Date, nullable=True)
    inspector = db.Column(db.String(100), nullable=True)
    inspection_report = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(30), nullable=False, default=BatchStatus.PENDING_INSPECTION)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    equipments = db.relationship('Equipment', backref='batch', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'batch_no': self.batch_no,
            'equipment_type': self.equipment_type,
            'supplier': self.supplier,
            'quantity': self.quantity,
            'arrival_date': self.arrival_date.isoformat() if self.arrival_date else None,
            'inspection_date': self.inspection_date.isoformat() if self.inspection_date else None,
            'inspector': self.inspector,
            'inspection_report': self.inspection_report,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

    def is_qualified(self):
        return self.status == BatchStatus.QUALIFIED


class Equipment(db.Model):
    __tablename__ = 'equipments'

    id = db.Column(db.Integer, primary_key=True)
    equipment_no = db.Column(db.String(50), unique=True, nullable=False, index=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('equipment_batches.id'), nullable=False)
    equipment_type = db.Column(db.String(20), nullable=False)
    rfid_tag = db.Column(db.String(100), nullable=True)
    status = db.Column(db.String(20), nullable=False, default=EquipmentStatus.IN_STOCK)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    records = db.relationship('EquipmentRecord', backref='equipment', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'equipment_no': self.equipment_no,
            'batch_id': self.batch_id,
            'equipment_type': self.equipment_type,
            'rfid_tag': self.rfid_tag,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

    def is_available(self):
        return self.status == EquipmentStatus.IN_STOCK
