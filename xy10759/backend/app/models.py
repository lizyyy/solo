from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from enum import Enum

db = SQLAlchemy()


class SignerStatus(Enum):
    PENDING = "pending"
    VERIFYING = "verifying"
    SIGNED = "signed"
    REJECTED = "rejected"
    FAILED = "failed"
    RECALLED = "recalled"


class ContractStatus(Enum):
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REJECTED = "rejected"
    RECALLED = "recalled"


class ExceptionType(Enum):
    SMS_BLOCKED = "sms_blocked"
    SMS_EXPIRED = "sms_expired"
    WRONG_CODE = "wrong_code"
    SIGNER_REJECT = "signer_reject"
    RECALL_REISSUE = "recall_reissue"
    DIRTY_DATA = "dirty_data"


class ExceptionStatus(Enum):
    OPEN = "open"
    PROCESSING = "processing"
    RESOLVED = "resolved"
    CLOSED = "closed"


class Signer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    contract_id = db.Column(db.Integer, db.ForeignKey('contract.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    email = db.Column(db.String(100))
    id_card = db.Column(db.String(50))
    order = db.Column(db.Integer, nullable=False)
    status = db.Column(db.Enum(SignerStatus), default=SignerStatus.PENDING)
    original_input = db.Column(db.JSON)
    processed_result = db.Column(db.JSON)
    signed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    sign_logs = db.relationship('SignLog', backref='signer', lazy=True)


class Contract(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text)
    version = db.Column(db.String(20), default="1.0")
    status = db.Column(db.Enum(ContractStatus), default=ContractStatus.DRAFT)
    created_by = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    signers = db.relationship('Signer', backref='contract', lazy=True, order_by='Signer.order')
    versions = db.relationship('ContractVersion', backref='contract', lazy=True, order_by='ContractVersion.version')
    exceptions = db.relationship('SignException', backref='contract', lazy=True)


class ContractVersion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    contract_id = db.Column(db.Integer, db.ForeignKey('contract.id'), nullable=False)
    version = db.Column(db.String(20), nullable=False)
    content = db.Column(db.Text)
    change_log = db.Column(db.Text)
    created_by = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class SignLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    signer_id = db.Column(db.Integer, db.ForeignKey('signer.id'), nullable=False)
    action = db.Column(db.String(50), nullable=False)
    detail = db.Column(db.Text)
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.String(200))
    evidence_hash = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class SignException(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    contract_id = db.Column(db.Integer, db.ForeignKey('contract.id'), nullable=False)
    signer_id = db.Column(db.Integer, db.ForeignKey('signer.id'))
    type = db.Column(db.Enum(ExceptionType), nullable=False)
    status = db.Column(db.Enum(ExceptionStatus), default=ExceptionStatus.OPEN)
    description = db.Column(db.Text)
    raw_data = db.Column(db.JSON)
    handled_by = db.Column(db.String(100))
    handled_at = db.Column(db.DateTime)
    handling_notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    signer = db.relationship('Signer', backref='exceptions')


class SignEvidence(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    contract_id = db.Column(db.Integer, db.ForeignKey('contract.id'), nullable=False)
    signer_id = db.Column(db.Integer, db.ForeignKey('signer.id'), nullable=False)
    evidence_type = db.Column(db.String(50))
    evidence_data = db.Column(db.JSON)
    evidence_hash = db.Column(db.String(200))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    contract = db.relationship('Contract', backref='evidences')
    signer = db.relationship('Signer', backref='evidences')
