from typing import Optional, Dict, Any
from datetime import datetime
from decimal import Decimal
import json

from sqlalchemy.orm import Session

from app.models import LoanAccount, CreditLimitRecord
from app.utils import IdGenerator, DateTimeUtils, BusinessType


class LimitService:
    def __init__(self, db: Session):
        self.db = db
    
    def get_customer_limits(self, customer_id: str) -> Dict[str, Any]:
        records = self.db.query(CreditLimitRecord).filter(
            CreditLimitRecord.customer_id == customer_id
        ).order_by(CreditLimitRecord.operation_time.desc()).first()
        
        if records:
            return {
                "customer_id": customer_id,
                "available_limit": str(records.after_limit),
                "used_limit": str(records.after_used),
                "last_update_time": records.operation_time.isoformat()
            }
        return {
            "customer_id": customer_id,
            "available_limit": "0",
            "used_limit": "0",
            "last_update_time": None
        }
    
    def _get_latest_record(self, customer_id: str) -> Optional[CreditLimitRecord]:
        return self.db.query(CreditLimitRecord).filter(
            CreditLimitRecord.customer_id == customer_id
        ).order_by(CreditLimitRecord.operation_time.desc()).first()
    
    def _record_limit_change(
        self,
        customer_id: str,
        loan_account: LoanAccount,
        operation_type: str,
        change_amount: Decimal,
        reason: str,
        related_application_id: Optional[int] = None,
        related_business_no: Optional[str] = None
    ) -> CreditLimitRecord:
        latest = self._get_latest_record(customer_id)
        
        before_limit = latest.after_limit if latest else Decimal("1000000")
        before_used = latest.after_used if latest else Decimal("0")
        
        after_limit = before_limit - change_amount
        after_used = before_used + change_amount
        
        record = CreditLimitRecord(
            record_no=IdGenerator.generate_record_no(),
            customer_id=customer_id,
            loan_account_id=loan_account.id,
            operation_type=operation_type,
            operation_reason=reason,
            before_limit=before_limit,
            before_used=before_used,
            after_limit=after_limit,
            after_used=after_used,
            change_amount=change_amount,
            operation_time=DateTimeUtils.now_naive(),
            related_application_id=related_application_id,
            related_business_no=related_business_no
        )
        
        self.db.add(record)
        self.db.flush()
        
        return record
    
    def extend_limit(
        self,
        loan_account: LoanAccount,
        extension_months: int,
        related_application_id: Optional[int] = None,
        related_business_no: Optional[str] = None
    ) -> CreditLimitRecord:
        change_amount = loan_account.remaining_principal * Decimal(str(extension_months)) / Decimal("12")
        change_amount = change_amount.quantize(Decimal("0.01"))
        
        return self._record_limit_change(
            customer_id=loan_account.customer_id,
            loan_account=loan_account,
            operation_type="EXTEND",
            change_amount=change_amount,
            reason=f"贷款展期，展期{extension_months}个月",
            related_application_id=related_application_id,
            related_business_no=related_business_no
        )
    
    def release_limit(
        self,
        loan_account: LoanAccount,
        release_amount: Decimal,
        reason: str,
        related_application_id: Optional[int] = None,
        related_business_no: Optional[str] = None
    ) -> CreditLimitRecord:
        return self._record_limit_change(
            customer_id=loan_account.customer_id,
            loan_account=loan_account,
            operation_type="RELEASE",
            change_amount=-release_amount,
            reason=reason,
            related_application_id=related_application_id,
            related_business_no=related_business_no
        )
    
    def get_limit_history(
        self,
        customer_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100
    ) -> list:
        query = self.db.query(CreditLimitRecord).filter(
            CreditLimitRecord.customer_id == customer_id
        )
        
        if start_date:
            query = query.filter(CreditLimitRecord.operation_time >= start_date)
        if end_date:
            query = query.filter(CreditLimitRecord.operation_time <= end_date)
        
        records = query.order_by(
            CreditLimitRecord.operation_time.desc()
        ).limit(limit).all()
        
        return [
            {
                "record_no": r.record_no,
                "operation_type": r.operation_type,
                "operation_reason": r.operation_reason,
                "before_limit": str(r.before_limit),
                "before_used": str(r.before_used),
                "after_limit": str(r.after_limit),
                "after_used": str(r.after_used),
                "change_amount": str(r.change_amount),
                "operation_time": r.operation_time.isoformat(),
                "related_application_id": r.related_application_id,
                "related_business_no": r.related_business_no
            }
            for r in records
        ]
