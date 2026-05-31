from datetime import datetime
from . import db


class Transaction(db.Model):
    __tablename__ = 'transactions'

    id = db.Column(db.Integer, primary_key=True)
    transaction_no = db.Column(db.String(64), index=True, nullable=False)
    transaction_date = db.Column(db.Date, nullable=False)
    amount = db.Column(db.Float, nullable=False)
    fee = db.Column(db.Float, default=0.0)
    type = db.Column(db.String(32))
    channel = db.Column(db.String(64))
    order_no = db.Column(db.String(64))
    payer = db.Column(db.String(128))
    remark = db.Column(db.Text)
    attachment_date = db.Column(db.Date)
    is_manual_correction = db.Column(db.Boolean, default=False)
    correction_ref = db.Column(db.String(64))
    source = db.Column(db.String(64))
    status = db.Column(db.String(32), default='pending')
    current_period = db.Column(db.String(16))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    status_logs = db.relationship('TransactionStatusLog', backref='transaction', lazy=True)
    anomalies = db.relationship('AnomalyRecord', backref='transaction', lazy=True)
    allocations = db.relationship('AllocationResult', backref='transaction', lazy=True)


class TransactionStatusLog(db.Model):
    __tablename__ = 'transaction_status_logs'

    id = db.Column(db.Integer, primary_key=True)
    transaction_id = db.Column(db.Integer, db.ForeignKey('transactions.id'), nullable=False)
    from_status = db.Column(db.String(32))
    to_status = db.Column(db.String(32), nullable=False)
    operator = db.Column(db.String(64))
    reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class AnomalyRecord(db.Model):
    __tablename__ = 'anomaly_records'

    id = db.Column(db.Integer, primary_key=True)
    transaction_id = db.Column(db.Integer, db.ForeignKey('transactions.id'), nullable=False)
    anomaly_type = db.Column(db.String(32), nullable=False)
    severity = db.Column(db.String(16), default='warning')
    description = db.Column(db.Text, nullable=False)
    evidence = db.Column(db.Text)
    related_transaction_ids = db.Column(db.String(256))
    is_resolved = db.Column(db.Boolean, default=False)
    resolved_by = db.Column(db.String(64))
    resolved_at = db.Column(db.DateTime)
    resolution_note = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class AllocationResult(db.Model):
    __tablename__ = 'allocation_results'

    id = db.Column(db.Integer, primary_key=True)
    transaction_id = db.Column(db.Integer, db.ForeignKey('transactions.id'), nullable=False)
    compensation_no = db.Column(db.String(64))
    after_sale_order = db.Column(db.String(64))
    principal_amount = db.Column(db.Float, default=0.0)
    compensation_amount = db.Column(db.Float, default=0.0)
    bearer_party = db.Column(db.String(64))
    allocation_ratio = db.Column(db.Float)
    period = db.Column(db.String(16))
    is_confirmed = db.Column(db.Boolean, default=False)
    confirmed_by = db.Column(db.String(64))
    confirmed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class ReconciliationSummary(db.Model):
    __tablename__ = 'reconciliation_summaries'

    id = db.Column(db.Integer, primary_key=True)
    period = db.Column(db.String(16), unique=True, nullable=False)
    total_transactions = db.Column(db.Integer, default=0)
    total_amount = db.Column(db.Float, default=0.0)
    confirmed_amount = db.Column(db.Float, default=0.0)
    pending_amount = db.Column(db.Float, default=0.0)
    anomaly_count = db.Column(db.Integer, default=0)
    duplicate_count = db.Column(db.Integer, default=0)
    cross_period_fee_count = db.Column(db.Integer, default=0)
    suspense_count = db.Column(db.Integer, default=0)
    generated_by = db.Column(db.String(64))
    generated_at = db.Column(db.DateTime, default=datetime.utcnow)
    remark = db.Column(db.Text)
