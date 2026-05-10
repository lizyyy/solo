from decimal import Decimal
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from ..models.journal import AccountJournal
from ..models.account import PrepaidAccount
from .id_generator import IdGenerator


class JournalService:
    @staticmethod
    def record_journal(
        db: Session,
        account: PrepaidAccount,
        biz_type: str,
        biz_order_no: str,
        direction: str,
        principal_delta: Decimal,
        bonus_delta: Decimal,
        operator: Optional[str] = None,
        remark: Optional[str] = None,
        commit: bool = True
    ) -> AccountJournal:
        total_delta = principal_delta + bonus_delta
        
        journal = AccountJournal(
            journal_no=IdGenerator.journal_no(),
            account_id=account.id,
            biz_type=biz_type,
            biz_order_no=biz_order_no,
            direction=direction,
            principal_delta=principal_delta,
            bonus_delta=bonus_delta,
            total_delta=total_delta,
            principal_balance_after=account.principal_balance,
            bonus_balance_after=account.bonus_balance,
            total_balance_after=account.total_balance,
            journal_time=datetime.utcnow(),
            operator=operator,
            remark=remark
        )
        
        db.add(journal)
        if commit:
            db.flush()
        
        return journal
