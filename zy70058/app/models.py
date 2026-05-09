from datetime import datetime
from app import db

class Account(db.Model):
    __tablename__ = 'accounts'
    
    id = db.Column(db.Integer, primary_key=True)
    account_number = db.Column(db.String(20), unique=True, nullable=False)
    card_number = db.Column(db.String(19), unique=True, nullable=False)
    customer_name = db.Column(db.String(100), nullable=False)
    credit_limit = db.Column(db.Numeric(15, 2), nullable=False)
    available_credit = db.Column(db.Numeric(15, 2), nullable=False)
    used_credit = db.Column(db.Numeric(15, 2), default=0.00)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    installments = db.relationship('InstallmentPlan', backref='account', lazy=True)
    exceptions = db.relationship('ExceptionRecord', backref='account', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'account_number': self.account_number,
            'card_number': self.card_number,
            'customer_name': self.customer_name,
            'credit_limit': float(self.credit_limit),
            'available_credit': float(self.available_credit),
            'used_credit': float(self.used_credit)
        }

class InstallmentPlan(db.Model):
    __tablename__ = 'installment_plans'
    
    STATUS_ACTIVE = 'active'
    STATUS_REVOKED = 'revoked'
    STATUS_EARLY_SETTLED = 'early_settled'
    STATUS_COMPLETED = 'completed'
    
    id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=False)
    original_transaction_id = db.Column(db.String(50), unique=True, nullable=False)
    original_amount = db.Column(db.Numeric(15, 2), nullable=False)
    total_fee = db.Column(db.Numeric(15, 2), nullable=False)
    total_amount = db.Column(db.Numeric(15, 2), nullable=False)
    installment_months = db.Column(db.Integer, nullable=False)
    monthly_principal = db.Column(db.Numeric(15, 2), nullable=False)
    monthly_fee = db.Column(db.Numeric(15, 2), nullable=False)
    monthly_installment = db.Column(db.Numeric(15, 2), nullable=False)
    fee_rate = db.Column(db.Numeric(6, 4), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    next_due_date = db.Column(db.Date, nullable=False)
    paid_months = db.Column(db.Integer, default=0)
    remaining_principal = db.Column(db.Numeric(15, 2), nullable=False)
    remaining_fee = db.Column(db.Numeric(15, 2), nullable=False)
    status = db.Column(db.String(20), default=STATUS_ACTIVE, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    amortizations = db.relationship('FeeAmortization', backref='plan', lazy=True, order_by='FeeAmortization.period')
    payments = db.relationship('InstallmentPayment', backref='plan', lazy=True)
    revocations = db.relationship('RevocationRecord', backref='plan', lazy=True)
    
    def to_dict(self, include_amortizations=False):
        data = {
            'id': self.id,
            'account_id': self.account_id,
            'original_transaction_id': self.original_transaction_id,
            'original_amount': float(self.original_amount),
            'total_fee': float(self.total_fee),
            'total_amount': float(self.total_amount),
            'installment_months': self.installment_months,
            'monthly_principal': float(self.monthly_principal),
            'monthly_fee': float(self.monthly_fee),
            'monthly_installment': float(self.monthly_installment),
            'fee_rate': float(self.fee_rate),
            'start_date': self.start_date.isoformat(),
            'next_due_date': self.next_due_date.isoformat(),
            'paid_months': self.paid_months,
            'remaining_principal': float(self.remaining_principal),
            'remaining_fee': float(self.remaining_fee),
            'status': self.status
        }
        if include_amortizations:
            data['amortizations'] = [a.to_dict() for a in self.amortizations]
        return data

class FeeAmortization(db.Model):
    __tablename__ = 'fee_amortizations'
    
    STATUS_UNPAID = 'unpaid'
    STATUS_PAID = 'paid'
    STATUS_WAIVED = 'waived'
    STATUS_ADJUSTED = 'adjusted'
    
    id = db.Column(db.Integer, primary_key=True)
    plan_id = db.Column(db.Integer, db.ForeignKey('installment_plans.id'), nullable=False)
    period = db.Column(db.Integer, nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    principal = db.Column(db.Numeric(15, 2), nullable=False)
    fee = db.Column(db.Numeric(15, 2), nullable=False)
    total = db.Column(db.Numeric(15, 2), nullable=False)
    remaining_principal_before = db.Column(db.Numeric(15, 2), nullable=False)
    remaining_principal_after = db.Column(db.Numeric(15, 2), nullable=False)
    status = db.Column(db.String(20), default=STATUS_UNPAID, nullable=False)
    actual_paid_amount = db.Column(db.Numeric(15, 2), nullable=True)
    paid_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'plan_id': self.plan_id,
            'period': self.period,
            'due_date': self.due_date.isoformat(),
            'principal': float(self.principal),
            'fee': float(self.fee),
            'total': float(self.total),
            'remaining_principal_before': float(self.remaining_principal_before),
            'remaining_principal_after': float(self.remaining_principal_after),
            'status': self.status,
            'actual_paid_amount': float(self.actual_paid_amount) if self.actual_paid_amount else None,
            'paid_at': self.paid_at.isoformat() if self.paid_at else None
        }

class InstallmentPayment(db.Model):
    __tablename__ = 'installment_payments'
    
    TYPE_REGULAR = 'regular'
    TYPE_EARLY = 'early'
    TYPE_REVOCATION = 'revocation'
    
    id = db.Column(db.Integer, primary_key=True)
    plan_id = db.Column(db.Integer, db.ForeignKey('installment_plans.id'), nullable=False)
    amortization_id = db.Column(db.Integer, db.ForeignKey('fee_amortizations.id'), nullable=True)
    payment_type = db.Column(db.String(20), nullable=False)
    transaction_id = db.Column(db.String(50), unique=True, nullable=False)
    principal_paid = db.Column(db.Numeric(15, 2), nullable=False)
    fee_paid = db.Column(db.Numeric(15, 2), nullable=False)
    total_paid = db.Column(db.Numeric(15, 2), nullable=False)
    period_covered = db.Column(db.Integer, nullable=True)
    paid_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'plan_id': self.plan_id,
            'amortization_id': self.amortization_id,
            'payment_type': self.payment_type,
            'transaction_id': self.transaction_id,
            'principal_paid': float(self.principal_paid),
            'fee_paid': float(self.fee_paid),
            'total_paid': float(self.total_paid),
            'period_covered': self.period_covered,
            'paid_at': self.paid_at.isoformat()
        }

class RevocationRecord(db.Model):
    __tablename__ = 'revocation_records'
    
    TYPE_FULL_REVOCATION = 'full_revocation'
    TYPE_PARTIAL_REVOCATION = 'partial_revocation'
    TYPE_EARLY_SETTLEMENT = 'early_settlement'
    
    id = db.Column(db.Integer, primary_key=True)
    plan_id = db.Column(db.Integer, db.ForeignKey('installment_plans.id'), nullable=False)
    revocation_type = db.Column(db.String(30), nullable=False)
    transaction_id = db.Column(db.String(50), unique=True, nullable=False)
    original_paid_principal = db.Column(db.Numeric(15, 2), nullable=False)
    original_paid_fee = db.Column(db.Numeric(15, 2), nullable=False)
    refund_principal = db.Column(db.Numeric(15, 2), default=0.00, nullable=False)
    refund_fee = db.Column(db.Numeric(15, 2), default=0.00, nullable=False)
    total_refund = db.Column(db.Numeric(15, 2), default=0.00, nullable=False)
    penalty_fee = db.Column(db.Numeric(15, 2), default=0.00, nullable=False)
    amount_to_collect = db.Column(db.Numeric(15, 2), default=0.00, nullable=False)
    remaining_principal_before = db.Column(db.Numeric(15, 2), nullable=False)
    remaining_fee_before = db.Column(db.Numeric(15, 2), nullable=False)
    credit_restored = db.Column(db.Numeric(15, 2), nullable=False)
    reason = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'plan_id': self.plan_id,
            'revocation_type': self.revocation_type,
            'transaction_id': self.transaction_id,
            'original_paid_principal': float(self.original_paid_principal),
            'original_paid_fee': float(self.original_paid_fee),
            'refund_principal': float(self.refund_principal),
            'refund_fee': float(self.refund_fee),
            'total_refund': float(self.total_refund),
            'penalty_fee': float(self.penalty_fee),
            'amount_to_collect': float(self.amount_to_collect),
            'remaining_principal_before': float(self.remaining_principal_before),
            'remaining_fee_before': float(self.remaining_fee_before),
            'credit_restored': float(self.credit_restored),
            'reason': self.reason,
            'created_at': self.created_at.isoformat()
        }

class BillRecord(db.Model):
    __tablename__ = 'bill_records'
    
    id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    bill_cycle = db.Column(db.String(7), nullable=False)
    transaction_id = db.Column(db.String(50), nullable=False)
    transaction_date = db.Column(db.Date, nullable=False)
    transaction_type = db.Column(db.String(30), nullable=False)
    description = db.Column(db.String(200), nullable=True)
    debit_amount = db.Column(db.Numeric(15, 2), default=0.00, nullable=False)
    credit_amount = db.Column(db.Numeric(15, 2), default=0.00, nullable=False)
    balance = db.Column(db.Numeric(15, 2), nullable=False)
    source = db.Column(db.String(50), nullable=False)
    source_id = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'account_id': self.account_id,
            'bill_cycle': self.bill_cycle,
            'transaction_id': self.transaction_id,
            'transaction_date': self.transaction_date.isoformat(),
            'transaction_type': self.transaction_type,
            'description': self.description,
            'debit_amount': float(self.debit_amount),
            'credit_amount': float(self.credit_amount),
            'balance': float(self.balance),
            'source': self.source,
            'source_id': self.source_id
        }

class ExceptionRecord(db.Model):
    __tablename__ = 'exception_records'
    
    SEVERITY_CRITICAL = 'critical'
    SEVERITY_HIGH = 'high'
    SEVERITY_MEDIUM = 'medium'
    SEVERITY_LOW = 'low'
    
    STATUS_OPEN = 'open'
    STATUS_INVESTIGATING = 'investigating'
    STATUS_RESOLVED = 'resolved'
    STATUS_IGNORED = 'ignored'
    
    id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    plan_id = db.Column(db.Integer, db.ForeignKey('installment_plans.id'), nullable=True)
    exception_type = db.Column(db.String(50), nullable=False)
    severity = db.Column(db.String(20), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    source_data = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default=STATUS_OPEN, nullable=False)
    investigation_notes = db.Column(db.Text, nullable=True)
    resolution_notes = db.Column(db.Text, nullable=True)
    detected_at = db.Column(db.DateTime, default=datetime.utcnow)
    resolved_at = db.Column(db.DateTime, nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'account_id': self.account_id,
            'plan_id': self.plan_id,
            'exception_type': self.exception_type,
            'severity': self.severity,
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'investigation_notes': self.investigation_notes,
            'resolution_notes': self.resolution_notes,
            'detected_at': self.detected_at.isoformat(),
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None
        }

class PendingTask(db.Model):
    __tablename__ = 'pending_tasks'
    
    TYPE_CREDIT_RESTORE = 'credit_restore'
    TYPE_REFUND_PROCESS = 'refund_process'
    TYPE_FEE_ADJUSTMENT = 'fee_adjustment'
    TYPE_BILL_CORRECTION = 'bill_correction'
    TYPE_MANUAL_REVIEW = 'manual_review'
    
    STATUS_PENDING = 'pending'
    STATUS_PROCESSING = 'processing'
    STATUS_COMPLETED = 'completed'
    STATUS_FAILED = 'failed'
    STATUS_CANCELLED = 'cancelled'
    
    id = db.Column(db.Integer, primary_key=True)
    task_type = db.Column(db.String(30), nullable=False)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    plan_id = db.Column(db.Integer, db.ForeignKey('installment_plans.id'), nullable=True)
    transaction_id = db.Column(db.String(50), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    task_data = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default=STATUS_PENDING, nullable=False)
    retry_count = db.Column(db.Integer, default=0, nullable=False)
    max_retries = db.Column(db.Integer, default=3, nullable=False)
    last_error = db.Column(db.Text, nullable=True)
    scheduled_at = db.Column(db.DateTime, default=datetime.utcnow)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'task_type': self.task_type,
            'account_id': self.account_id,
            'plan_id': self.plan_id,
            'transaction_id': self.transaction_id,
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'retry_count': self.retry_count,
            'max_retries': self.max_retries,
            'last_error': self.last_error,
            'scheduled_at': self.scheduled_at.isoformat(),
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }
