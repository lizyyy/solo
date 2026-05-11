from datetime import datetime
from app import db


class RiderStatus:
    PENDING = 'pending'
    ACTIVE = 'active'
    INACTIVE = 'inactive'
    RESIGNED = 'resigned'


class Rider(db.Model):
    __tablename__ = 'riders'

    id = db.Column(db.Integer, primary_key=True)
    rider_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    id_card = db.Column(db.String(50), nullable=False)
    station_id = db.Column(db.String(50), nullable=False)
    station_name = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), nullable=False, default=RiderStatus.PENDING)
    join_date = db.Column(db.Date, nullable=False)
    resignation_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    equipment_records = db.relationship('EquipmentRecord', backref='rider', lazy='dynamic')
    compensation_records = db.relationship('CompensationRecord', backref='rider', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'rider_id': self.rider_id,
            'name': self.name,
            'phone': self.phone,
            'id_card': self.id_card,
            'station_id': self.station_id,
            'station_name': self.station_name,
            'status': self.status,
            'join_date': self.join_date.isoformat() if self.join_date else None,
            'resignation_date': self.resignation_date.isoformat() if self.resignation_date else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

    def is_active(self):
        return self.status == RiderStatus.ACTIVE
