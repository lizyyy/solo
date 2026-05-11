from datetime import datetime
from app import db


class RecordType:
    ISSUE = 'issue'
    RETURN = 'return'


class RecordStatus:
    PENDING = 'pending'
    CONFIRMED = 'confirmed'
    REJECTED = 'rejected'
    ANOMALY = 'anomaly'


class EquipmentRecord(db.Model):
    __tablename__ = 'equipment_records'

    id = db.Column(db.Integer, primary_key=True)
    record_no = db.Column(db.String(50), unique=True, nullable=False, index=True)
    rider_id = db.Column(db.Integer, db.ForeignKey('riders.id'), nullable=False)
    equipment_id = db.Column(db.Integer, db.ForeignKey('equipments.id'), nullable=False)
    record_type = db.Column(db.String(20), nullable=False)
    operator = db.Column(db.String(100), nullable=False)
    operation_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    signature = db.Column(db.String(255), nullable=True)
    signature_timestamp = db.Column(db.DateTime, nullable=True)
    remarks = db.Column(db.Text, nullable=True)
    return_condition = db.Column(db.String(50), nullable=True)
    damage_level = db.Column(db.String(20), nullable=True)
    status = db.Column(db.String(20), nullable=False, default=RecordStatus.PENDING)
    verification_result = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    compensation_records = db.relationship('CompensationRecord', backref='equipment_record', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'record_no': self.record_no,
            'rider_id': self.rider_id,
            'equipment_id': self.equipment_id,
            'record_type': self.record_type,
            'operator': self.operator,
            'operation_date': self.operation_date.isoformat(),
            'signature': self.signature,
            'signature_timestamp': self.signature_timestamp.isoformat() if self.signature_timestamp else None,
            'remarks': self.remarks,
            'return_condition': self.return_condition,
            'damage_level': self.damage_level,
            'status': self.status,
            'verification_result': self.verification_result,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
