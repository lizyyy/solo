from datetime import datetime
from sqlalchemy.exc import IntegrityError
from models import db, Account, FreezeRecord, Transaction, AccountStatus, FreezeStatus, TransactionType


class ServiceError(Exception):
    def __init__(self, message, code="SERVICE_ERROR"):
        self.message = message
        self.code = code
        super().__init__(message)


class AccountService:
    @staticmethod
    def get_or_create_account(account_id):
        account = Account.query.get(account_id)
        if not account:
            account = Account(id=account_id)
            db.session.add(account)
            db.session.commit()
        return account

    @staticmethod
    def deposit(account_id, amount):
        if amount <= 0:
            raise ServiceError("充值金额必须大于0", code="INVALID_AMOUNT")

        account = AccountService.get_or_create_account(account_id)

        account.available_balance += amount
        account.total_balance += amount

        transaction = Transaction(
            account_id=account_id,
            transaction_type=TransactionType.DEPOSIT.value,
            amount=amount,
            available_balance_after=account.available_balance,
            frozen_balance_after=account.frozen_balance,
            total_balance_after=account.total_balance,
            description=f"账户充值 {amount} 元"
        )
        db.session.add(transaction)
        db.session.commit()

        return {
            "account": account.to_dict(),
            "transaction": transaction.to_dict()
        }

    @staticmethod
    def freeze(account_id, business_order_id, amount, reason=None):
        if amount <= 0:
            raise ServiceError("冻结金额必须大于0", code="INVALID_AMOUNT")

        existing = FreezeRecord.query.filter_by(business_order_id=business_order_id).first()
        if existing:
            if existing.status == FreezeStatus.CLOSED.value:
                raise ServiceError("该争议已关闭，不允许操作", code="DISPUTE_CLOSED")
            return {
                "freeze_record": existing.to_dict(),
                "transaction": None,
                "is_duplicate": True
            }

        account = Account.query.get(account_id)
        if not account:
            raise ServiceError("账户不存在", code="ACCOUNT_NOT_FOUND")

        if account.status == AccountStatus.CLOSED.value:
            raise ServiceError("账户已关闭，不能新增冻结", code="ACCOUNT_CLOSED")

        if account.available_balance < amount:
            raise ServiceError("可用余额不足，无法冻结", code="INSUFFICIENT_BALANCE")

        freeze_record = FreezeRecord(
            business_order_id=business_order_id,
            account_id=account_id,
            original_amount=amount,
            current_amount=amount,
            status=FreezeStatus.FROZEN.value,
            reason=reason
        )

        account.available_balance -= amount
        account.frozen_balance += amount

        transaction = Transaction(
            account_id=account_id,
            business_order_id=business_order_id,
            transaction_type=TransactionType.FREEZE.value,
            amount=amount,
            available_balance_after=account.available_balance,
            frozen_balance_after=account.frozen_balance,
            total_balance_after=account.total_balance,
            description=f"发起冻结，金额 {amount} 元，原因：{reason or '支付争议'}"
        )

        db.session.add(freeze_record)
        db.session.add(transaction)

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            existing = FreezeRecord.query.filter_by(business_order_id=business_order_id).first()
            return {
                "freeze_record": existing.to_dict(),
                "transaction": None,
                "is_duplicate": True
            }

        return {
            "freeze_record": freeze_record.to_dict(),
            "transaction": transaction.to_dict(),
            "is_duplicate": False
        }

    @staticmethod
    def unfreeze(account_id, business_order_id, amount):
        if amount <= 0:
            raise ServiceError("解冻金额必须大于0", code="INVALID_AMOUNT")

        freeze_record = FreezeRecord.query.filter_by(
            business_order_id=business_order_id,
            account_id=account_id
        ).first()

        if not freeze_record:
            raise ServiceError("冻结记录不存在", code="FREEZE_NOT_FOUND")

        if freeze_record.status == FreezeStatus.CLOSED.value:
            raise ServiceError("该争议已关闭，不允许操作", code="DISPUTE_CLOSED")

        if freeze_record.current_amount < amount:
            raise ServiceError(
                f"解冻金额超过当前冻结额，当前冻结额: {freeze_record.current_amount}",
                code="EXCEED_FROZEN_AMOUNT"
            )

        account = Account.query.get(account_id)

        freeze_record.current_amount -= amount
        account.available_balance += amount
        account.frozen_balance -= amount

        if freeze_record.current_amount == 0 and freeze_record.deducted_amount == 0:
            freeze_record.status = FreezeStatus.UNFROZEN.value
        elif freeze_record.current_amount == 0 and freeze_record.deducted_amount > 0:
            freeze_record.status = FreezeStatus.DEDUCTED.value
        else:
            freeze_record.status = FreezeStatus.PARTIAL_UNFROZEN.value

        transaction = Transaction(
            account_id=account_id,
            business_order_id=business_order_id,
            transaction_type=TransactionType.UNFREEZE.value,
            amount=amount,
            available_balance_after=account.available_balance,
            frozen_balance_after=account.frozen_balance,
            total_balance_after=account.total_balance,
            description=f"解冻金额 {amount} 元"
        )

        db.session.add(transaction)
        db.session.commit()

        return {
            "freeze_record": freeze_record.to_dict(),
            "transaction": transaction.to_dict()
        }

    @staticmethod
    def deduct(account_id, business_order_id, amount):
        if amount <= 0:
            raise ServiceError("扣划金额必须大于0", code="INVALID_AMOUNT")

        freeze_record = FreezeRecord.query.filter_by(
            business_order_id=business_order_id,
            account_id=account_id
        ).first()

        if not freeze_record:
            raise ServiceError("冻结记录不存在", code="FREEZE_NOT_FOUND")

        if freeze_record.status == FreezeStatus.CLOSED.value:
            raise ServiceError("该争议已关闭，不允许操作", code="DISPUTE_CLOSED")

        if freeze_record.current_amount < amount:
            raise ServiceError(
                f"扣划金额超过当前冻结额，当前冻结额: {freeze_record.current_amount}",
                code="EXCEED_FROZEN_AMOUNT"
            )

        account = Account.query.get(account_id)

        freeze_record.current_amount -= amount
        freeze_record.deducted_amount += amount
        account.frozen_balance -= amount
        account.total_balance -= amount

        if freeze_record.current_amount == 0:
            freeze_record.status = FreezeStatus.DEDUCTED.value
        else:
            freeze_record.status = FreezeStatus.PARTIAL_UNFROZEN.value

        transaction = Transaction(
            account_id=account_id,
            business_order_id=business_order_id,
            transaction_type=TransactionType.DEDUCT.value,
            amount=amount,
            available_balance_after=account.available_balance,
            frozen_balance_after=account.frozen_balance,
            total_balance_after=account.total_balance,
            description=f"确认扣划金额 {amount} 元"
        )

        db.session.add(transaction)
        db.session.commit()

        return {
            "freeze_record": freeze_record.to_dict(),
            "transaction": transaction.to_dict()
        }

    @staticmethod
    def close_dispute(account_id, business_order_id):
        freeze_record = FreezeRecord.query.filter_by(
            business_order_id=business_order_id,
            account_id=account_id
        ).first()

        if not freeze_record:
            raise ServiceError("冻结记录不存在", code="FREEZE_NOT_FOUND")

        if freeze_record.status == FreezeStatus.CLOSED.value:
            return {
                "freeze_record": freeze_record.to_dict(),
                "transaction": None,
                "is_duplicate": True
            }

        if freeze_record.current_amount > 0:
            raise ServiceError(
                f"争议仍有冻结余额未处理，当前冻结额: {freeze_record.current_amount}",
                code="FROZEN_AMOUNT_REMAINING"
            )

        freeze_record.status = FreezeStatus.CLOSED.value

        account = Account.query.get(account_id)
        transaction = Transaction(
            account_id=account_id,
            business_order_id=business_order_id,
            transaction_type=TransactionType.DISPUTE_CLOSE.value,
            amount=0,
            available_balance_after=account.available_balance,
            frozen_balance_after=account.frozen_balance,
            total_balance_after=account.total_balance,
            description="支付争议已关闭"
        )

        db.session.add(transaction)
        db.session.commit()

        return {
            "freeze_record": freeze_record.to_dict(),
            "transaction": transaction.to_dict(),
            "is_duplicate": False
        }

    @staticmethod
    def query_account(account_id):
        account = Account.query.get(account_id)
        if not account:
            raise ServiceError("账户不存在", code="ACCOUNT_NOT_FOUND")

        freeze_records = FreezeRecord.query.filter_by(account_id=account_id).all()
        transactions = Transaction.query.filter_by(
            account_id=account_id
        ).order_by(Transaction.created_at.desc()).all()

        reconciliation = {
            "total_deposit": 0.0,
            "total_freeze": 0.0,
            "total_unfreeze": 0.0,
            "total_deduct": 0.0
        }

        for t in transactions:
            if t.transaction_type == TransactionType.DEPOSIT.value:
                reconciliation["total_deposit"] += t.amount
            elif t.transaction_type == TransactionType.FREEZE.value:
                reconciliation["total_freeze"] += t.amount
            elif t.transaction_type == TransactionType.UNFREEZE.value:
                reconciliation["total_unfreeze"] += t.amount
            elif t.transaction_type == TransactionType.DEDUCT.value:
                reconciliation["total_deduct"] += t.amount

        return {
            "account": account.to_dict(),
            "freeze_records": [fr.to_dict() for fr in freeze_records],
            "transactions": [t.to_dict() for t in transactions],
            "reconciliation": reconciliation,
            "reconciliation_check": {
                "calculated_available": reconciliation["total_deposit"] - reconciliation["total_freeze"] + reconciliation["total_unfreeze"],
                "calculated_frozen": reconciliation["total_freeze"] - reconciliation["total_unfreeze"] - reconciliation["total_deduct"],
                "calculated_total": reconciliation["total_deposit"] - reconciliation["total_deduct"],
                "actual_available": account.available_balance,
                "actual_frozen": account.frozen_balance,
                "actual_total": account.total_balance,
                "is_consistent": (
                    abs((reconciliation["total_deposit"] - reconciliation["total_freeze"] + reconciliation["total_unfreeze"]) - account.available_balance) < 0.01 and
                    abs((reconciliation["total_freeze"] - reconciliation["total_unfreeze"] - reconciliation["total_deduct"]) - account.frozen_balance) < 0.01 and
                    abs((reconciliation["total_deposit"] - reconciliation["total_deduct"]) - account.total_balance) < 0.01
                )
            }
        }
