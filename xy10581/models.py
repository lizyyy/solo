from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Store(db.Model):
    __tablename__ = 'stores'
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Card(db.Model):
    __tablename__ = 'cards'
    id = db.Column(db.String(50), primary_key=True)
    card_number = db.Column(db.String(20), unique=True, nullable=False)
    holder_name = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), default='ACTIVE')
    total_balance = db.Column(db.Float, default=0.0)
    available_balance = db.Column(db.Float, default=0.0)
    frozen_balance = db.Column(db.Float, default=0.0)
    is_lost = db.Column(db.Boolean, default=False)
    lost_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class RechargeBatch(db.Model):
    __tablename__ = 'recharge_batches'
    id = db.Column(db.String(50), primary_key=True)
    card_id = db.Column(db.String(50), db.ForeignKey('cards.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    remaining_amount = db.Column(db.Float, nullable=False)
    recharge_channel = db.Column(db.String(50))
    recharge_time = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='ACTIVE')

class Transaction(db.Model):
    __tablename__ = 'transactions'
    id = db.Column(db.String(50), primary_key=True)
    card_id = db.Column(db.String(50), db.ForeignKey('cards.id'), nullable=False)
    store_id = db.Column(db.String(50), db.ForeignKey('stores.id'))
    transaction_type = db.Column(db.String(20), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default='PENDING')
    request_id = db.Column(db.String(100), unique=True)
    callback_id = db.Column(db.String(100))
    recharge_batch_id = db.Column(db.String(50), db.ForeignKey('recharge_batches.id'))
    parent_transaction_id = db.Column(db.String(50), db.ForeignKey('transactions.id'))
    failure_reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class BalanceFreeze(db.Model):
    __tablename__ = 'balance_freezes'
    id = db.Column(db.String(50), primary_key=True)
    card_id = db.Column(db.String(50), db.ForeignKey('cards.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    reason = db.Column(db.String(200), nullable=False)
    frozen_by = db.Column(db.String(100))
    status = db.Column(db.String(20), default='ACTIVE')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    unfrozen_at = db.Column(db.DateTime)
    unfrozen_by = db.Column(db.String(100))

class RiskEvent(db.Model):
    __tablename__ = 'risk_events'
    id = db.Column(db.String(50), primary_key=True)
    card_id = db.Column(db.String(50), db.ForeignKey('cards.id'), nullable=False)
    transaction_id = db.Column(db.String(50), db.ForeignKey('transactions.id'))
    risk_type = db.Column(db.String(50), nullable=False)
    risk_level = db.Column(db.String(20), default='MEDIUM')
    description = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), default='OPEN')
    detected_at = db.Column(db.DateTime, default=datetime.utcnow)
    resolved_at = db.Column(db.DateTime)
    resolved_by = db.Column(db.String(100))
    resolution = db.Column(db.Text)

class CallbackLog(db.Model):
    __tablename__ = 'callback_logs'
    id = db.Column(db.String(50), primary_key=True)
    callback_id = db.Column(db.String(100), unique=True, nullable=False)
    transaction_id = db.Column(db.String(50), db.ForeignKey('transactions.id'))
    request_data = db.Column(db.Text)
    response_data = db.Column(db.Text)
    is_duplicate = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class ManualCorrection(db.Model):
    __tablename__ = 'manual_corrections'
    id = db.Column(db.String(50), primary_key=True)
    card_id = db.Column(db.String(50), db.ForeignKey('cards.id'), nullable=False)
    transaction_id = db.Column(db.String(50), db.ForeignKey('transactions.id'))
    operator = db.Column(db.String(100), nullable=False)
    correction_type = db.Column(db.String(50), nullable=False)
    before_state = db.Column(db.Text, nullable=False)
    after_state = db.Column(db.Text, nullable=False)
    reason = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
