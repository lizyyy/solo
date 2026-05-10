from datetime import datetime
from app import db
from enum import Enum

class InquiryStatus(Enum):
    DRAFT = 'draft'
    PUBLISHED = 'published'
    QUOTING = 'quoting'
    COMPARING = 'comparing'
    AWARDED = 'awarded'
    CANCELLED = 'cancelled'
    EXPIRED = 'expired'

class QuoteStatus(Enum):
    DRAFT = 'draft'
    SUBMITTED = 'submitted'
    REVISED = 'revised'
    WITHDRAWN = 'withdrawn'
    REJECTED = 'rejected'
    AWARDED = 'awarded'

class BackgroundJobStatus(Enum):
    PENDING = 'pending'
    RUNNING = 'running'
    COMPLETED = 'completed'
    FAILED = 'failed'
    RETRYING = 'retrying'
    CANCELLED = 'cancelled'

class OperationType(Enum):
    CREATE = 'create'
    UPDATE = 'update'
    DELETE = 'delete'
    SUBMIT = 'submit'
    APPROVE = 'approve'
    REJECT = 'reject'
    COMPARE = 'compare'
    AWARD = 'award'
    EXPORT = 'export'
    EXPIRE = 'expire'
    MANUAL_EDIT = 'manual_edit'
    RETRY = 'retry'

class Inquiry(db.Model):
    __tablename__ = 'inquiries'
    
    id = db.Column(db.Integer, primary_key=True)
    inquiry_no = db.Column(db.String(50), unique=True, nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(100), nullable=True)
    project = db.Column(db.String(100), nullable=True)
    
    status = db.Column(db.Enum(InquiryStatus), default=InquiryStatus.DRAFT, nullable=False)
    
    required_items = db.Column(db.JSON, nullable=False, default=list)
    
    publish_date = db.Column(db.DateTime, nullable=True)
    quote_deadline = db.Column(db.DateTime, nullable=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    quotes = db.relationship('Quote', backref='inquiry', lazy='dynamic', cascade='all, delete-orphan')
    comparison_results = db.relationship('ComparisonResult', backref='inquiry', lazy='dynamic', cascade='all, delete-orphan')
    operation_logs = db.relationship('OperationLog', backref='inquiry', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'inquiry_no': self.inquiry_no,
            'title': self.title,
            'description': self.description,
            'created_by': self.created_by,
            'department': self.department,
            'project': self.project,
            'status': self.status.value,
            'required_items': self.required_items,
            'publish_date': self.publish_date.isoformat() if self.publish_date else None,
            'quote_deadline': self.quote_deadline.isoformat() if self.quote_deadline else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class Quote(db.Model):
    __tablename__ = 'quotes'
    
    id = db.Column(db.Integer, primary_key=True)
    inquiry_id = db.Column(db.Integer, db.ForeignKey('inquiries.id'), nullable=False, index=True)
    quote_no = db.Column(db.String(50), unique=True, nullable=False, index=True)
    
    vendor_id = db.Column(db.String(100), nullable=False, index=True)
    vendor_name = db.Column(db.String(200), nullable=False)
    vendor_contact = db.Column(db.String(100), nullable=True)
    vendor_phone = db.Column(db.String(50), nullable=True)
    
    status = db.Column(db.Enum(QuoteStatus), default=QuoteStatus.DRAFT, nullable=False)
    
    currency = db.Column(db.String(10), default='CNY', nullable=False)
    tax_rate = db.Column(db.Float, default=0.13, nullable=False)
    
    valid_from = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    valid_until = db.Column(db.DateTime, nullable=False)
    
    total_price_excl_tax = db.Column(db.Float, nullable=True)
    total_price_incl_tax = db.Column(db.Float, nullable=True)
    total_freight = db.Column(db.Float, default=0.0, nullable=False)
    total_amount = db.Column(db.Float, nullable=True)
    
    payment_terms = db.Column(db.String(500), nullable=True)
    delivery_terms = db.Column(db.String(500), nullable=True)
    delivery_location = db.Column(db.String(500), nullable=True)
    delivery_time = db.Column(db.String(200), nullable=True)
    
    remarks = db.Column(db.Text, nullable=True)
    
    is_expired = db.Column(db.Boolean, default=False, nullable=False)
    expiry_check_at = db.Column(db.DateTime, nullable=True)
    
    created_by = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    items = db.relationship('QuoteItem', backref='quote', lazy='dynamic', cascade='all, delete-orphan')
    versions = db.relationship('QuoteVersion', backref='quote', lazy='dynamic', cascade='all, delete-orphan')
    price_changes = db.relationship('PriceChange', backref='quote', lazy='dynamic', cascade='all, delete-orphan')
    operation_logs = db.relationship('OperationLog', backref='quote', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self, include_items=True):
        data = {
            'id': self.id,
            'inquiry_id': self.inquiry_id,
            'quote_no': self.quote_no,
            'vendor_id': self.vendor_id,
            'vendor_name': self.vendor_name,
            'vendor_contact': self.vendor_contact,
            'vendor_phone': self.vendor_phone,
            'status': self.status.value,
            'currency': self.currency,
            'tax_rate': self.tax_rate,
            'valid_from': self.valid_from.isoformat() if self.valid_from else None,
            'valid_until': self.valid_until.isoformat() if self.valid_until else None,
            'total_price_excl_tax': self.total_price_excl_tax,
            'total_price_incl_tax': self.total_price_incl_tax,
            'total_freight': self.total_freight,
            'total_amount': self.total_amount,
            'payment_terms': self.payment_terms,
            'delivery_terms': self.delivery_terms,
            'delivery_location': self.delivery_location,
            'delivery_time': self.delivery_time,
            'remarks': self.remarks,
            'is_expired': self.is_expired,
            'expiry_check_at': self.expiry_check_at.isoformat() if self.expiry_check_at else None,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
        if include_items:
            data['items'] = [item.to_dict() for item in self.items]
        return data

class QuoteItem(db.Model):
    __tablename__ = 'quote_items'
    
    id = db.Column(db.Integer, primary_key=True)
    quote_id = db.Column(db.Integer, db.ForeignKey('quotes.id'), nullable=False, index=True)
    
    item_no = db.Column(db.String(50), nullable=False)
    item_name = db.Column(db.String(200), nullable=False)
    item_description = db.Column(db.Text, nullable=True)
    specification = db.Column(db.String(500), nullable=True)
    unit = db.Column(db.String(20), nullable=False)
    quantity = db.Column(db.Float, nullable=False)
    
    unit_price_excl_tax = db.Column(db.Float, nullable=False)
    unit_price_incl_tax = db.Column(db.Float, nullable=False)
    tax_rate = db.Column(db.Float, default=0.13, nullable=False)
    tax_amount = db.Column(db.Float, nullable=False)
    
    freight_per_unit = db.Column(db.Float, default=0.0, nullable=False)
    freight_total = db.Column(db.Float, default=0.0, nullable=False)
    
    line_total_excl_tax = db.Column(db.Float, nullable=False)
    line_total_incl_tax = db.Column(db.Float, nullable=False)
    
    delivery_time = db.Column(db.String(200), nullable=True)
    warranty = db.Column(db.String(200), nullable=True)
    
    remarks = db.Column(db.Text, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'quote_id': self.quote_id,
            'item_no': self.item_no,
            'item_name': self.item_name,
            'item_description': self.item_description,
            'specification': self.specification,
            'unit': self.unit,
            'quantity': self.quantity,
            'unit_price_excl_tax': self.unit_price_excl_tax,
            'unit_price_incl_tax': self.unit_price_incl_tax,
            'tax_rate': self.tax_rate,
            'tax_amount': self.tax_amount,
            'freight_per_unit': self.freight_per_unit,
            'freight_total': self.freight_total,
            'line_total_excl_tax': self.line_total_excl_tax,
            'line_total_incl_tax': self.line_total_incl_tax,
            'delivery_time': self.delivery_time,
            'warranty': self.warranty,
            'remarks': self.remarks,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class QuoteVersion(db.Model):
    __tablename__ = 'quote_versions'
    
    id = db.Column(db.Integer, primary_key=True)
    quote_id = db.Column(db.Integer, db.ForeignKey('quotes.id'), nullable=False, index=True)
    version_no = db.Column(db.Integer, nullable=False)
    
    snapshot_data = db.Column(db.JSON, nullable=False)
    
    change_reason = db.Column(db.Text, nullable=True)
    changed_by = db.Column(db.String(100), nullable=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    __table_args__ = (db.UniqueConstraint('quote_id', 'version_no', name='uq_quote_version'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'quote_id': self.quote_id,
            'version_no': self.version_no,
            'snapshot_data': self.snapshot_data,
            'change_reason': self.change_reason,
            'changed_by': self.changed_by,
            'created_at': self.created_at.isoformat()
        }

class ComparisonResult(db.Model):
    __tablename__ = 'comparison_results'
    
    id = db.Column(db.Integer, primary_key=True)
    inquiry_id = db.Column(db.Integer, db.ForeignKey('inquiries.id'), nullable=False, index=True)
    comparison_no = db.Column(db.String(50), unique=True, nullable=False, index=True)
    
    version = db.Column(db.Integer, default=1, nullable=False)
    
    comparison_data = db.Column(db.JSON, nullable=False)
    
    recommended_vendor_id = db.Column(db.String(100), nullable=True)
    recommended_vendor_name = db.Column(db.String(200), nullable=True)
    recommendation_reason = db.Column(db.Text, nullable=True)
    
    comparison_summary = db.Column(db.JSON, nullable=False)
    
    generated_by = db.Column(db.String(100), nullable=False)
    generated_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'inquiry_id': self.inquiry_id,
            'comparison_no': self.comparison_no,
            'version': self.version,
            'comparison_data': self.comparison_data,
            'recommended_vendor_id': self.recommended_vendor_id,
            'recommended_vendor_name': self.recommended_vendor_name,
            'recommendation_reason': self.recommendation_reason,
            'comparison_summary': self.comparison_summary,
            'generated_by': self.generated_by,
            'generated_at': self.generated_at.isoformat()
        }

class BackgroundJob(db.Model):
    __tablename__ = 'background_jobs'
    
    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.String(100), unique=True, nullable=False, index=True)
    job_type = db.Column(db.String(50), nullable=False, index=True)
    
    inquiry_id = db.Column(db.Integer, db.ForeignKey('inquiries.id'), nullable=True, index=True)
    quote_id = db.Column(db.Integer, db.ForeignKey('quotes.id'), nullable=True, index=True)
    
    status = db.Column(db.Enum(BackgroundJobStatus), default=BackgroundJobStatus.PENDING, nullable=False)
    
    params = db.Column(db.JSON, nullable=True)
    result = db.Column(db.JSON, nullable=True)
    error_message = db.Column(db.Text, nullable=True)
    
    retry_count = db.Column(db.Integer, default=0, nullable=False)
    max_retries = db.Column(db.Integer, default=3, nullable=False)
    
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    next_retry_at = db.Column(db.DateTime, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'job_id': self.job_id,
            'job_type': self.job_type,
            'inquiry_id': self.inquiry_id,
            'quote_id': self.quote_id,
            'status': self.status.value,
            'params': self.params,
            'result': self.result,
            'error_message': self.error_message,
            'retry_count': self.retry_count,
            'max_retries': self.max_retries,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'next_retry_at': self.next_retry_at.isoformat() if self.next_retry_at else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class OperationLog(db.Model):
    __tablename__ = 'operation_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    log_id = db.Column(db.String(100), unique=True, nullable=False, index=True)
    
    inquiry_id = db.Column(db.Integer, db.ForeignKey('inquiries.id'), nullable=True, index=True)
    quote_id = db.Column(db.Integer, db.ForeignKey('quotes.id'), nullable=True, index=True)
    
    operation_type = db.Column(db.Enum(OperationType), nullable=False)
    operation_by = db.Column(db.String(100), nullable=False)
    operation_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    before_snapshot = db.Column(db.JSON, nullable=True)
    after_snapshot = db.Column(db.JSON, nullable=True)
    
    change_fields = db.Column(db.JSON, nullable=True)
    change_reason = db.Column(db.Text, nullable=True)
    
    ip_address = db.Column(db.String(50), nullable=True)
    user_agent = db.Column(db.String(500), nullable=True)
    
    success = db.Column(db.Boolean, default=True, nullable=False)
    error_message = db.Column(db.Text, nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'log_id': self.log_id,
            'inquiry_id': self.inquiry_id,
            'quote_id': self.quote_id,
            'operation_type': self.operation_type.value,
            'operation_by': self.operation_by,
            'operation_at': self.operation_at.isoformat(),
            'before_snapshot': self.before_snapshot,
            'after_snapshot': self.after_snapshot,
            'change_fields': self.change_fields,
            'change_reason': self.change_reason,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'success': self.success,
            'error_message': self.error_message
        }

class PriceChange(db.Model):
    __tablename__ = 'price_changes'
    
    id = db.Column(db.Integer, primary_key=True)
    quote_id = db.Column(db.Integer, db.ForeignKey('quotes.id'), nullable=False, index=True)
    quote_item_id = db.Column(db.Integer, db.ForeignKey('quote_items.id'), nullable=True, index=True)
    
    field_changed = db.Column(db.String(100), nullable=False)
    old_value = db.Column(db.Float, nullable=True)
    new_value = db.Column(db.Float, nullable=False)
    
    change_reason = db.Column(db.Text, nullable=True)
    changed_by = db.Column(db.String(100), nullable=False)
    changed_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    is_manual = db.Column(db.Boolean, default=False, nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'quote_id': self.quote_id,
            'quote_item_id': self.quote_item_id,
            'field_changed': self.field_changed,
            'old_value': self.old_value,
            'new_value': self.new_value,
            'change_reason': self.change_reason,
            'changed_by': self.changed_by,
            'changed_at': self.changed_at.isoformat(),
            'is_manual': self.is_manual
        }
