from typing import Optional, Dict, Any, List
from datetime import datetime
from decimal import Decimal
import json

from sqlalchemy.orm import Session

from app.models import (
    LoanAccount, RepaymentPlan, RepaymentInstallment
)
from app.utils import (
    AccountStatus, SourceType, RepaymentPlanStatus, InstallmentStatus,
    IdGenerator, DateTimeUtils, BusinessType, OperationType
)


class LoanAccountService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_loan_account(
        self,
        account_no: str,
        customer_id: str,
        customer_name: str,
        loan_amount: Decimal,
        remaining_principal: Decimal,
        total_interest: Decimal,
        paid_interest: Decimal,
        annual_interest_rate: Decimal,
        loan_term: int,
        original_maturity_date: datetime,
        current_maturity_date: datetime,
        credit_limit_used: Decimal,
        extension_interest_rate: Optional[Decimal] = None,
        max_extension_count: int = 2,
        max_extension_months: int = 6
    ) -> Dict[str, Any]:
        existing_account = self.db.query(LoanAccount).filter(
            LoanAccount.account_no == account_no
        ).first()
        
        if existing_account:
            raise ValueError(f"贷款账号已存在: {account_no}")
        
        account = LoanAccount(
            account_no=account_no,
            customer_id=customer_id,
            customer_name=customer_name,
            loan_amount=loan_amount,
            remaining_principal=remaining_principal,
            total_interest=total_interest,
            paid_interest=paid_interest,
            annual_interest_rate=annual_interest_rate,
            extension_interest_rate=extension_interest_rate,
            loan_term=loan_term,
            original_maturity_date=original_maturity_date,
            current_maturity_date=current_maturity_date,
            credit_limit_used=credit_limit_used,
            status=AccountStatus.ACTIVE.value,
            extension_count=0,
            max_extension_count=max_extension_count,
            max_extension_months=max_extension_months
        )
        
        self.db.add(account)
        self.db.flush()
        
        from app.services.audit_service import AuditService
        audit_service = AuditService(self.db)
        audit_service.log_success(
            business_type=BusinessType.LOAN_ACCOUNT,
            operation_type=OperationType.CREATE,
            business_id=account.id,
            business_no=account.account_no,
            operation_desc=f"创建贷款账户: {account_no}",
            after_data=self._snapshot_account(account),
            operator_type="SYSTEM"
        )
        
        self.db.commit()
        
        return self._snapshot_account(account)
    
    def get_loan_account(
        self,
        account_no: str
    ) -> Optional[Dict[str, Any]]:
        account = self.db.query(LoanAccount).filter(
            LoanAccount.account_no == account_no
        ).first()
        
        if not account:
            return None
        
        return self._snapshot_account(account)
    
    def get_loan_account_by_id(
        self,
        account_id: int
    ) -> Optional[LoanAccount]:
        return self.db.query(LoanAccount).get(account_id)
    
    def create_initial_repayment_plan(
        self,
        loan_account: LoanAccount,
        start_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        if start_date is None:
            start_date = DateTimeUtils.now_naive()
        
        from app.services.repayment_calculator import RepaymentCalculator
        calculator = RepaymentCalculator(self.db)
        
        installments_data = calculator.calculate_equal_installment(
            principal=loan_account.loan_amount,
            annual_rate=loan_account.annual_interest_rate,
            months=loan_account.loan_term,
            start_date=start_date
        )
        
        total_principal = sum(i["principal"] for i in installments_data)
        total_interest = sum(i["interest"] for i in installments_data)
        total_amount = sum(i["amount"] for i in installments_data)
        
        plan = RepaymentPlan(
            plan_no=IdGenerator.generate_plan_no(),
            loan_account_id=loan_account.id,
            version=1,
            is_current=True,
            total_principal=total_principal,
            total_interest=total_interest,
            total_amount=total_amount,
            start_date=installments_data[0]["due_date"] if installments_data else start_date,
            end_date=installments_data[-1]["due_date"] if installments_data else DateTimeUtils.add_months(start_date, loan_account.loan_term),
            source_type=SourceType.ORIGINAL.value,
            status=RepaymentPlanStatus.ACTIVE.value,
            created_by="SYSTEM"
        )
        
        self.db.add(plan)
        self.db.flush()
        
        for inst_data in installments_data:
            inst = RepaymentInstallment(
                plan_id=plan.id,
                installment_no=inst_data["installment_no"],
                due_date=inst_data["due_date"],
                principal=inst_data["principal"],
                interest=inst_data["interest"],
                amount=inst_data["amount"],
                status=InstallmentStatus.PENDING.value
            )
            self.db.add(inst)
        
        self.db.flush()
        
        loan_account.current_repayment_plan_id = plan.id
        self.db.flush()
        
        from app.services.audit_service import AuditService
        audit_service = AuditService(self.db)
        audit_service.log_success(
            business_type=BusinessType.REPAYMENT_PLAN,
            operation_type=OperationType.CREATE,
            business_id=plan.id,
            business_no=plan.plan_no,
            operation_desc=f"创建初始还款计划: {plan.plan_no}",
            after_data={
                "plan_no": plan.plan_no,
                "version": plan.version,
                "total_amount": str(plan.total_amount),
                "installment_count": len(installments_data)
            },
            operator_type="SYSTEM"
        )
        
        self.db.commit()
        
        return {
            "plan_no": plan.plan_no,
            "version": plan.version,
            "total_principal": str(plan.total_principal),
            "total_interest": str(plan.total_interest),
            "total_amount": str(plan.total_amount),
            "start_date": plan.start_date.isoformat(),
            "end_date": plan.end_date.isoformat(),
            "installment_count": len(installments_data),
            "installments": [
                {
                    "installment_no": i["installment_no"],
                    "due_date": i["due_date"].isoformat(),
                    "principal": str(i["principal"]),
                    "interest": str(i["interest"]),
                    "amount": str(i["amount"])
                }
                for i in installments_data
            ]
        }
    
    def _snapshot_account(self, account: LoanAccount) -> Dict[str, Any]:
        return {
            "id": account.id,
            "account_no": account.account_no,
            "customer_id": account.customer_id,
            "customer_name": account.customer_name,
            "status": account.status,
            "loan_amount": str(account.loan_amount),
            "remaining_principal": str(account.remaining_principal),
            "total_interest": str(account.total_interest),
            "paid_interest": str(account.paid_interest),
            "annual_interest_rate": str(account.annual_interest_rate),
            "extension_interest_rate": str(account.extension_interest_rate) if account.extension_interest_rate else None,
            "loan_term": account.loan_term,
            "original_maturity_date": account.original_maturity_date.isoformat() if account.original_maturity_date else None,
            "current_maturity_date": account.current_maturity_date.isoformat() if account.current_maturity_date else None,
            "credit_limit_used": str(account.credit_limit_used),
            "extension_count": account.extension_count,
            "max_extension_count": account.max_extension_count,
            "max_extension_months": account.max_extension_months,
            "current_repayment_plan_id": account.current_repayment_plan_id,
            "version": account.version,
            "created_at": account.created_at.isoformat() if account.created_at else None,
            "updated_at": account.updated_at.isoformat() if account.updated_at else None
        }
    
    def list_loan_accounts(
        self,
        customer_id: Optional[str] = None,
        status: Optional[AccountStatus] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        query = self.db.query(LoanAccount)
        
        if customer_id:
            query = query.filter(LoanAccount.customer_id == customer_id)
        if status:
            query = query.filter(LoanAccount.status == status.value)
        
        accounts = query.order_by(LoanAccount.created_at.desc()).limit(limit).all()
        
        return [self._snapshot_account(acc) for acc in accounts]
