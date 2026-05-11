from datetime import datetime
from app import db


class CompensationStatus:
    PENDING = 'pending'
    PAID = 'paid'
    WAIVED = 'waived'


class CompensationRecord(db.Model):
    __tablename__ = 'compensation_records'

    id = db.Column(db.Integer, primary_key=True)
    compensation_no = db.Column(db.String(50), unique=True, nullable=False, index=True)
    rider_id = db.Column(db.Integer, db.ForeignKey('riders.id'), nullable=False)
    equipment_record_id = db.Column(db.Integer, db.ForeignKey('equipment_records.id'), nullable=False)
    equipment_no = db.Column(db.String(50), nullable=False)
    damage_reason = db.Column(db.String(200), nullable=False)
    damage_level = db.Column(db.String(20), nullable=False)
    compensation_amount = db.Column(db.Float, nullable=False)
    payment_method = db.Column(db.String(20), nullable=True)
    payment_date = db.Column(db.DateTime, nullable=True)
    remarks = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default=CompensationStatus.PENDING)
    reconciliation_status = db.Column(db.String(20), nullable=False, default='pending')
    reconciliation_remarks = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'compensation_no': self.compensation_no,
            'rider_id': self.rider_id,
            'equipment_record_id': self.equipment_record_id,
            'equipment_no': self.equipment_no,
            'damage_reason': self.damage_reason,
            'damage_level': self.damage_level,
            'compensation_amount': self.compensation_amount,
            'payment_method': self.payment_method,
            'payment_date': self.payment_date.isoformat() if self.payment_date else None,
            'remarks': self.remarks,
            'status': self.status,
            'reconciliation_status': self.reconciliation_status,
            'reconciliation_remarks': self.reconciliation_remarks,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
