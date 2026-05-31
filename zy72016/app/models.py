from datetime import datetime
from app import db


STATUS_PENDING = 'PENDING'
STATUS_NEEDS_CONFIRM = 'NEEDS_CONFIRM'
STATUS_CONFIRMED = 'CONFIRMED'
STATUS_EXCEPTION = 'EXCEPTION'
STATUS_CLOSED = 'CLOSED'

SOURCE_CONTRACT_SCAN = 'CONTRACT_SCAN'
SOURCE_PAYMENT_FLOW = 'PAYMENT_FLOW'
SOURCE_REFUND_REQUEST = 'REFUND_REQUEST'
SOURCE_APPROVAL_EMAIL = 'APPROVAL_EMAIL'
SOURCE_MANUAL_NOTE = 'MANUAL_NOTE'
SOURCE_LATE_ATTACHMENT = 'LATE_ATTACHMENT'
SOURCE_SYSTEM = 'SYSTEM'

DATA_QUALITY_NORMAL = 'NORMAL'
DATA_QUALITY_NULL = 'HAS_NULL'
DATA_QUALITY_DUPLICATE = 'HAS_DUPLICATE'
DATA_QUALITY_BOUNDARY = 'BOUNDARY'
DATA_QUALITY_DIRTY = 'DIRTY'


class Batch(db.Model):
    __tablename__ = 'batches'
    id = db.Column(db.Integer, primary_key=True)
    batch_no = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    status = db.Column(db.String(20), default=STATUS_PENDING)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)
    created_by = db.Column(db.String(100), default='SYSTEM')
    is_active = db.Column(db.Boolean, default=True)

    records = db.relationship('MarginCall', backref='batch', lazy='dynamic',
                              cascade='all, delete-orphan')

    def to_dict(self, include_records=False):
        data = {
            'id': self.id,
            'batch_no': self.batch_no,
            'name': self.name,
            'description': self.description,
            'status': self.status,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
            'created_by': self.created_by,
            'record_count': self.records.count()
        }
        if include_records:
            data['records'] = [r.to_dict() for r in self.records.all()]
        return data


class MarginCall(db.Model):
    __tablename__ = 'margin_calls'
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('batches.id'), nullable=False)
    record_no = db.Column(db.String(50), nullable=False)
    customer_name = db.Column(db.String(200))
    account_no = db.Column(db.String(100))
    currency = db.Column(db.String(10))
    margin_amount = db.Column(db.Float)
    shortfall_amount = db.Column(db.Float)
    payment_date = db.Column(db.Date)
    payment_amount = db.Column(db.Float)
    refund_amount = db.Column(db.Float)
    current_status = db.Column(db.String(20), default=STATUS_PENDING)
    data_quality = db.Column(db.String(20), default=DATA_QUALITY_NORMAL)
    source = db.Column(db.String(50))
    contract_original_note = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)
    processed_by = db.Column(db.String(100))
    processed_at = db.Column(db.DateTime)
    has_exception = db.Column(db.Boolean, default=False)
    exception_reason = db.Column(db.Text)
    version = db.Column(db.Integer, default=1)
    is_late_attachment = db.Column(db.Boolean, default=False)
    original_record_id = db.Column(db.Integer, db.ForeignKey('margin_calls.id'))

    status_history = db.relationship('StatusHistory', backref='margin_call',
                                     lazy='dynamic', cascade='all, delete-orphan',
                                     foreign_keys='StatusHistory.margin_call_id',
                                     order_by='StatusHistory.created_at')
    note_history = db.relationship('NoteHistory', backref='margin_call',
                                   lazy='dynamic', cascade='all, delete-orphan',
                                   order_by='NoteHistory.created_at')
    versions = db.relationship('MarginCall', backref=db.backref('original', remote_side=[id]),
                               lazy='dynamic')

    __table_args__ = (
        db.UniqueConstraint('batch_id', 'record_no', 'version', name='_batch_record_version_uc'),
    )

    def to_dict(self, include_history=False):
        data = {
            'id': self.id,
            'batch_id': self.batch_id,
            'batch_no': self.batch.batch_no if self.batch else None,
            'record_no': self.record_no,
            'customer_name': self.customer_name,
            'account_no': self.account_no,
            'currency': self.currency,
            'margin_amount': self.margin_amount,
            'shortfall_amount': self.shortfall_amount,
            'payment_date': self.payment_date.strftime('%Y-%m-%d') if self.payment_date else None,
            'payment_amount': self.payment_amount,
            'refund_amount': self.refund_amount,
            'current_status': self.current_status,
            'data_quality': self.data_quality,
            'source': self.source,
            'contract_original_note': self.contract_original_note,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
            'processed_by': self.processed_by,
            'processed_at': self.processed_at.strftime('%Y-%m-%d %H:%M:%S') if self.processed_at else None,
            'has_exception': self.has_exception,
            'exception_reason': self.exception_reason,
            'version': self.version,
            'is_late_attachment': self.is_late_attachment,
            'original_record_id': self.original_record_id
        }
        if include_history:
            data['status_history'] = [sh.to_dict() for sh in self.status_history.all()]
            data['note_history'] = [nh.to_dict() for nh in self.note_history.all()]
        return data


class StatusHistory(db.Model):
    __tablename__ = 'status_history'
    id = db.Column(db.Integer, primary_key=True)
    margin_call_id = db.Column(db.Integer, db.ForeignKey('margin_calls.id'), nullable=False)
    from_status = db.Column(db.String(20))
    to_status = db.Column(db.String(20), nullable=False)
    change_reason = db.Column(db.Text)
    source = db.Column(db.String(50))
    operator = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.now)
    previous_shortfall = db.Column(db.Float)
    new_shortfall = db.Column(db.Float)
    previous_refund = db.Column(db.Float)
    new_refund = db.Column(db.Float)

    def to_dict(self):
        return {
            'id': self.id,
            'margin_call_id': self.margin_call_id,
            'from_status': self.from_status,
            'to_status': self.to_status,
            'change_reason': self.change_reason,
            'source': self.source,
            'operator': self.operator,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'previous_shortfall': self.previous_shortfall,
            'new_shortfall': self.new_shortfall,
            'previous_refund': self.previous_refund,
            'new_refund': self.new_refund
        }


class NoteHistory(db.Model):
    __tablename__ = 'note_history'
    id = db.Column(db.Integer, primary_key=True)
    margin_call_id = db.Column(db.Integer, db.ForeignKey('margin_calls.id'), nullable=False)
    note_content = db.Column(db.Text, nullable=False)
    note_type = db.Column(db.String(50))
    source = db.Column(db.String(50))
    operator = db.Column(db.String(100))
    is_original = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        return {
            'id': self.id,
            'margin_call_id': self.margin_call_id,
            'note_content': self.note_content,
            'note_type': self.note_type,
            'source': self.source,
            'operator': self.operator,
            'is_original': self.is_original,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S')
        }


class OperationLog(db.Model):
    __tablename__ = 'operation_logs'
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('batches.id'))
    margin_call_id = db.Column(db.Integer, db.ForeignKey('margin_calls.id'))
    operation = db.Column(db.String(100), nullable=False)
    operation_type = db.Column(db.String(50))
    detail = db.Column(db.Text)
    operator = db.Column(db.String(100))
    source = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.now)
    ip_address = db.Column(db.String(50))

    def to_dict(self):
        return {
            'id': self.id,
            'batch_id': self.batch_id,
            'margin_call_id': self.margin_call_id,
            'operation': self.operation,
            'operation_type': self.operation_type,
            'detail': self.detail,
            'operator': self.operator,
            'source': self.source,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'ip_address': self.ip_address
        }
