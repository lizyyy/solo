from decimal import Decimal
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from ..models.account import PrepaidAccount
from ..models.deposit import DepositOrder, DepositConsumption, DepositRefund
from ..models.consume import ConsumeOrder
from ..models.refund import RefundOrder, RefundConsume
from .id_generator import IdGenerator
from .bonus_service import BonusService
from .journal_service import JournalService


class AccountService:
    @staticmethod
    def create_account(
        db: Session,
        member_id: Optional[str] = None,
        member_name: Optional[str] = None,
        operator: Optional[str] = None
    ) -> PrepaidAccount:
        account = PrepaidAccount(
            account_no=IdGenerator.account_no(),
            member_id=member_id,
            member_name=member_name,
            principal_balance=Decimal("0.00"),
            bonus_balance=Decimal("0.00"),
            created_by=operator,
            updated_by=operator
        )
        db.add(account)
        db.flush()
        return account

    @staticmethod
    def get_account_by_no(db: Session, account_no: str) -> Optional[PrepaidAccount]:
        return db.query(PrepaidAccount).filter(
            PrepaidAccount.account_no == account_no
        ).first()


class DepositService:
    @staticmethod
    def create_deposit(
        db: Session,
        account: PrepaidAccount,
        store_id: int,
        deposit_amount: Decimal,
        operator: Optional[str] = None,
        remark: Optional[str] = None
    ) -> DepositOrder:
        bonus_amount, rule_id = BonusService.calculate_bonus(db, deposit_amount)
        
        order = DepositOrder(
            order_no=IdGenerator.deposit_order_no(),
            account_id=account.id,
            store_id=store_id,
            deposit_amount=deposit_amount,
            bonus_amount=bonus_amount,
            bonus_rule_id=rule_id,
            principal_remaining=deposit_amount,
            bonus_remaining=bonus_amount,
            status="completed",
            effective_date=datetime.now().strftime("%Y-%m-%d"),
            created_by=operator,
            updated_by=operator,
            remark=remark
        )
        
        db.add(order)
        
        account.principal_balance += deposit_amount
        account.bonus_balance += bonus_amount
        account.total_deposited += deposit_amount
        account.total_bonus += bonus_amount
        
        JournalService.record_journal(
            db=db,
            account=account,
            biz_type="deposit",
            biz_order_no=order.order_no,
            direction="in",
            principal_delta=deposit_amount,
            bonus_delta=bonus_amount,
            operator=operator,
            remark=remark,
            commit=False
        )
        
        db.flush()
        return order


class ConsumeService:
    @staticmethod
    def create_consume(
        db: Session,
        account: PrepaidAccount,
        store_id: int,
        total_amount: Decimal,
        operator: Optional[str] = None,
        remark: Optional[str] = None
    ) -> ConsumeOrder:
        available_principal = account.principal_balance
        available_bonus = account.bonus_balance
        available_total = available_principal + available_bonus
        
        if available_total < total_amount:
            raise ValueError(f"余额不足，可用余额: {available_total}，消费金额: {total_amount}")
        
        remaining = total_amount
        principal_paid = Decimal("0.00")
        bonus_paid = Decimal("0.00")
        
        consume_details = []
        
        deposit_orders = db.query(DepositOrder).filter(
            DepositOrder.account_id == account.id,
            DepositOrder.is_void == False,
            (DepositOrder.principal_remaining > 0) | (DepositOrder.bonus_remaining > 0)
        ).order_by(DepositOrder.id.asc()).all()
        
        for deposit in deposit_orders:
            if remaining <= 0:
                break
            
            if deposit.principal_remaining > 0:
                use_principal = min(deposit.principal_remaining, remaining)
                deposit.principal_remaining -= use_principal
                principal_paid += use_principal
                remaining -= use_principal
                
                consume_details.append({
                    "deposit_order_id": deposit.id,
                    "principal_used": use_principal,
                    "bonus_used": Decimal("0.00")
                })
                
                if remaining <= 0:
                    continue
            
            if deposit.bonus_remaining > 0:
                use_bonus = min(deposit.bonus_remaining, remaining)
                deposit.bonus_remaining -= use_bonus
                bonus_paid += use_bonus
                remaining -= use_bonus
                
                if consume_details and consume_details[-1]["deposit_order_id"] == deposit.id:
                    consume_details[-1]["bonus_used"] = use_bonus
                else:
                    consume_details.append({
                        "deposit_order_id": deposit.id,
                        "principal_used": Decimal("0.00"),
                        "bonus_used": use_bonus
                    })
        
        if remaining > 0:
            raise ValueError(f"余额不足，无法完成消费")
        
        order = ConsumeOrder(
            order_no=IdGenerator.consume_order_no(),
            account_id=account.id,
            store_id=store_id,
            total_amount=total_amount,
            principal_paid=principal_paid,
            bonus_paid=bonus_paid,
            other_paid=Decimal("0.00"),
            consume_time=datetime.utcnow(),
            status="completed",
            is_refundable=True,
            created_by=operator,
            updated_by=operator,
            remark=remark
        )
        db.add(order)
        db.flush()
        
        for detail in consume_details:
            dc = DepositConsumption(
                consume_order_id=order.id,
                deposit_order_id=detail["deposit_order_id"],
                principal_used=detail["principal_used"],
                bonus_used=detail["bonus_used"],
                consume_time=datetime.utcnow()
            )
            db.add(dc)
        
        account.principal_balance -= principal_paid
        account.bonus_balance -= bonus_paid
        account.total_consumed += (principal_paid + bonus_paid)
        
        JournalService.record_journal(
            db=db,
            account=account,
            biz_type="consume",
            biz_order_no=order.order_no,
            direction="out",
            principal_delta=-principal_paid,
            bonus_delta=-bonus_paid,
            operator=operator,
            remark=remark,
            commit=False
        )
        
        db.flush()
        return order
