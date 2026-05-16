from datetime import datetime
from app import db

class Supplier(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.String(50), nullable=False, index=True)
    supplier_code = db.Column(db.String(50), nullable=False, unique=True, index=True)
    supplier_name = db.Column(db.String(200), nullable=False)
    contact_person = db.Column(db.String(100))
    contact_phone = db.Column(db.String(50))
    contact_email = db.Column(db.String(200))
    address = db.Column(db.String(500))
    risk_level = db.Column(db.String(20), default='medium')
    status = db.Column(db.String(20), default='pending')
    created_by = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    remarks = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id,
            'batch_id': self.batch_id,
            'supplier_code': self.supplier_code,
            'supplier_name': self.supplier_name,
            'contact_person': self.contact_person,
            'contact_phone': self.contact_phone,
            'contact_email': self.contact_email,
            'address': self.address,
            'risk_level': self.risk_level,
            'status': self.status,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'remarks': self.remarks
        }
