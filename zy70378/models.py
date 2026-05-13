from datetime import datetime
from enum import Enum
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class AccountStatus(Enum):
    ACTIVE = "active"
    CLOSED = "closed"


class FreezeStatus(Enum):
    FROZEN = "frozen"
    PARTIAL_UNFROZEN = "partial_unfrozen"
    DEDUCTED = "deducted"
    UNFROZEN = "unfrozen"
    CLOSED = "closed"


class TransactionType(Enum):
    DEPOSIT = "deposit"
    FREEZE = "freeze"
    UNFREEZE = "unfreeze"
    DEDUCT = "deduct"
    DISPUTE_CLOSE = "dispute_close"


class Account(db.Model):
    __tablename__ = "accounts"

    id = db.Column(db.String(36), primary_key=True)
    available_balance = db.Column(db.Float, default=0.0)
    frozen_balance = db.Column(db.Float, default=0.0)
    total_balance = db.Column(db.Float, default=0.0)
    status = db.Column(db.String(20), default=AccountStatus.ACTIVE.value)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "account_id": self.id,
            "available_balance": self.available_balance,
            "frozen_balance": self.frozen_balance,
            "total_balance": self.total_balance,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }


class FreezeRecord(db.Model):
    __tablename__ = "freeze_records"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    business_order_id = db.Column(db.String(64), unique=True, nullable=False)
    account_id = db.Column(db.String(36), nullable=False, index=True)
    original_amount = db.Column(db.Float, nullable=False)
    current_amount = db.Column(db.Float, nullable=False)
    deducted_amount = db.Column(db.Float, default=0.0)
    status = db.Column(db.String(20), default=FreezeStatus.FROZEN.value)
    reason = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "freeze_record_id": self.id,
            "business_order_id": self.business_order_id,
            "account_id": self.account_id,
            "original_amount": self.original_amount,
            "current_amount": self.current_amount,
            "deducted_amount": self.deducted_amount,
            "status": self.status,
            "reason": self.reason,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }


class Transaction(db.Model):
    __tablename__ = "transactions"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    account_id = db.Column(db.String(36), nullable=False, index=True)
    business_order_id = db.Column(db.String(64), nullable=True, index=True)
    transaction_type = db.Column(db.String(20), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    available_balance_after = db.Column(db.Float, nullable=False)
    frozen_balance_after = db.Column(db.Float, nullable=False)
    total_balance_after = db.Column(db.Float, nullable=False)
    description = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            "transaction_id": self.id,
            "account_id": self.account_id,
            "business_order_id": self.business_order_id,
            "transaction_type": self.transaction_type,
            "amount": self.amount,
            "available_balance_after": self.available_balance_after,
            "frozen_balance_after": self.frozen_balance_after,
            "total_balance_after": self.total_balance_after,
            "description": self.description,
            "created_at": self.created_at.isoformat()
        }
