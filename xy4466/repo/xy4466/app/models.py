from datetime import datetime
from app import db
import json

class Stamp(db.Model):
    __tablename__ = 'stamps'
    
    id = db.Column(db.Integer, primary_key=True)
    stamp_code = db.Column(db.String(50), unique=True, nullable=False)
    stamp_name = db.Column(db.String(100), nullable=False)
    stamp_type = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), default='in_cabinet')
    location = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    applications = db.relationship('StampApplication', backref='stamp', lazy=True)
    loans = db.relationship('StampLoan', backref='stamp', lazy=True)
    cabinet_logs = db.relationship('StampCabinetLog', backref='stamp', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'stamp_code': self.stamp_code,
            'stamp_name': self.stamp_name,
            'stamp_type': self.stamp_type,
            'status': self.status,
            'location': self.location,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Authorization(db.Model):
    __tablename__ = 'authorizations'
    
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.String(50), nullable=False)
    employee_name = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(100))
    stamp_code = db.Column(db.String(50), db.ForeignKey('stamps.stamp_code'), nullable=False)
    authorization_type = db.Column(db.String(20), default='use')
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'employee_name': self.employee_name,
            'department': self.department,
            'stamp_code': self.stamp_code,
            'authorization_type': self.authorization_type,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class StampApplication(db.Model):
    __tablename__ = 'stamp_applications'
    
    id = db.Column(db.Integer, primary_key=True)
    application_number = db.Column(db.String(50), unique=True, nullable=False)
    applicant_id = db.Column(db.String(50), nullable=False)
    applicant_name = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(100))
    stamp_code = db.Column(db.String(50), db.ForeignKey('stamps.stamp_code'), nullable=False)
    document_type = db.Column(db.String(50), nullable=False)
    document_title = db.Column(db.String(200), nullable=False)
    usage_reason = db.Column(db.Text)
    application_date = db.Column(db.DateTime, nullable=False)
    expected_use_date = db.Column(db.DateTime)
    status = db.Column(db.String(20), default='pending')
    risk_score = db.Column(db.Float, default=0.0)
    risk_factors = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    reviews = db.relationship('Review', backref='application', lazy=True)
    audit_results = db.relationship('AuditResult', backref='application', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'application_number': self.application_number,
            'applicant_id': self.applicant_id,
            'applicant_name': self.applicant_name,
            'department': self.department,
            'stamp_code': self.stamp_code,
            'document_type': self.document_type,
            'document_title': self.document_title,
            'usage_reason': self.usage_reason,
            'application_date': self.application_date.isoformat() if self.application_date else None,
            'expected_use_date': self.expected_use_date.isoformat() if self.expected_use_date else None,
            'status': self.status,
            'risk_score': self.risk_score,
            'risk_factors': self.risk_factors,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class StampCabinetLog(db.Model):
    __tablename__ = 'stamp_cabinet_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    log_number = db.Column(db.String(50), unique=True, nullable=False)
    stamp_code = db.Column(db.String(50), db.ForeignKey('stamps.stamp_code'), nullable=False)
    operation_type = db.Column(db.String(20), nullable=False)
    operator_id = db.Column(db.String(50), nullable=False)
    operator_name = db.Column(db.String(100), nullable=False)
    operation_time = db.Column(db.DateTime, nullable=False)
    cabinet_id = db.Column(db.String(50))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'log_number': self.log_number,
            'stamp_code': self.stamp_code,
            'operation_type': self.operation_type,
            'operator_id': self.operator_id,
            'operator_name': self.operator_name,
            'operation_time': self.operation_time.isoformat() if self.operation_time else None,
            'cabinet_id': self.cabinet_id,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class ExpressDelivery(db.Model):
    __tablename__ = 'express_deliveries'
    
    id = db.Column(db.Integer, primary_key=True)
    delivery_number = db.Column(db.String(50), unique=True, nullable=False)
    express_company = db.Column(db.String(50), nullable=False)
    tracking_number = db.Column(db.String(100))
    stamp_code = db.Column(db.String(50), nullable=False)
    sender_name = db.Column(db.String(100), nullable=False)
    sender_department = db.Column(db.String(100))
    receiver_name = db.Column(db.String(100), nullable=False)
    receiver_address = db.Column(db.String(300), nullable=False)
    receiver_phone = db.Column(db.String(50))
    delivery_type = db.Column(db.String(20), default='send_out')
    send_date = db.Column(db.DateTime, nullable=False)
    expected_return_date = db.Column(db.DateTime)
    actual_return_date = db.Column(db.DateTime)
    status = db.Column(db.String(20), default='in_transit')
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'delivery_number': self.delivery_number,
            'express_company': self.express_company,
            'tracking_number': self.tracking_number,
            'stamp_code': self.stamp_code,
            'sender_name': self.sender_name,
            'sender_department': self.sender_department,
            'receiver_name': self.receiver_name,
            'receiver_address': self.receiver_address,
            'receiver_phone': self.receiver_phone,
            'delivery_type': self.delivery_type,
            'send_date': self.send_date.isoformat() if self.send_date else None,
            'expected_return_date': self.expected_return_date.isoformat() if self.expected_return_date else None,
            'actual_return_date': self.actual_return_date.isoformat() if self.actual_return_date else None,
            'status': self.status,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class StampLoan(db.Model):
    __tablename__ = 'stamp_loans'
    
    id = db.Column(db.Integer, primary_key=True)
    loan_number = db.Column(db.String(50), unique=True, nullable=False)
    stamp_code = db.Column(db.String(50), db.ForeignKey('stamps.stamp_code'), nullable=False)
    borrower_id = db.Column(db.String(50), nullable=False)
    borrower_name = db.Column(db.String(100), nullable=False)
    borrower_department = db.Column(db.String(100))
    loan_reason = db.Column(db.Text)
    loan_date = db.Column(db.DateTime, nullable=False)
    expected_return_date = db.Column(db.DateTime, nullable=False)
    actual_return_date = db.Column(db.DateTime)
    status = db.Column(db.String(20), default='on_loan')
    is_overdue = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'loan_number': self.loan_number,
            'stamp_code': self.stamp_code,
            'borrower_id': self.borrower_id,
            'borrower_name': self.borrower_name,
            'borrower_department': self.borrower_department,
            'loan_reason': self.loan_reason,
            'loan_date': self.loan_date.isoformat() if self.loan_date else None,
            'expected_return_date': self.expected_return_date.isoformat() if self.expected_return_date else None,
            'actual_return_date': self.actual_return_date.isoformat() if self.actual_return_date else None,
            'status': self.status,
            'is_overdue': self.is_overdue,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Review(db.Model):
    __tablename__ = 'reviews'
    
    id = db.Column(db.Integer, primary_key=True)
    application_id = db.Column(db.Integer, db.ForeignKey('stamp_applications.id'), nullable=False)
    reviewer_id = db.Column(db.String(50), nullable=False)
    reviewer_name = db.Column(db.String(100), nullable=False)
    review_date = db.Column(db.DateTime, default=datetime.utcnow)
    original_status = db.Column(db.String(20))
    new_status = db.Column(db.String(20), nullable=False)
    notes = db.Column(db.Text, nullable=False)
    risk_adjustment = db.Column(db.Float, default=0.0)
    risk_override = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'application_id': self.application_id,
            'reviewer_id': self.reviewer_id,
            'reviewer_name': self.reviewer_name,
            'review_date': self.review_date.isoformat() if self.review_date else None,
            'original_status': self.original_status,
            'new_status': self.new_status,
            'notes': self.notes,
            'risk_adjustment': self.risk_adjustment,
            'risk_override': self.risk_override,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class AuditResult(db.Model):
    __tablename__ = 'audit_results'
    
    id = db.Column(db.Integer, primary_key=True)
    audit_number = db.Column(db.String(50), unique=True, nullable=False)
    application_id = db.Column(db.Integer, db.ForeignKey('stamp_applications.id'))
    audit_type = db.Column(db.String(50), nullable=False)
    audit_date = db.Column(db.DateTime, nullable=False)
    risk_score = db.Column(db.Float, default=0.0)
    risk_level = db.Column(db.String(20), default='low')
    risk_factors = db.Column(db.Text)
    audit_status = db.Column(db.String(20), default='pending')
    auditor_id = db.Column(db.String(50))
    auditor_name = db.Column(db.String(100))
    audit_notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'audit_number': self.audit_number,
            'application_id': self.application_id,
            'audit_type': self.audit_type,
            'audit_date': self.audit_date.isoformat() if self.audit_date else None,
            'risk_score': self.risk_score,
            'risk_level': self.risk_level,
            'risk_factors': self.risk_factors,
            'audit_status': self.audit_status,
            'auditor_id': self.auditor_id,
            'auditor_name': self.auditor_name,
            'audit_notes': self.audit_notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
