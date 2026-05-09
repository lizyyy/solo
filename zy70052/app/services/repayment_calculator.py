from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.models import (
    LoanAccount, RepaymentPlan, RepaymentInstallment, 
    RepaymentPlanHistory
)
from app.utils import (
    RepaymentPlanStatus, InstallmentStatus, SourceType,
    IdGenerator, DateTimeUtils, OperationType
)


class RepaymentCalculator:
    def __init__(self, db: Session):
        self.db = db
    
    def calculate_equal_installment(
        self,
        principal: Decimal,
        annual_rate: Decimal,
        months: int,
        start_date: datetime
    ) -> List[Dict[str, Any]]:
        monthly_rate = annual_rate / Decimal("12") / Decimal("100")
        
        if monthly_rate == 0:
            monthly_principal = principal / Decimal(str(months))
            installments = []
            for i in range(months):
                due_date = DateTimeUtils.add_months(start_date, i + 1)
                installments.append({
                    "installment_no": i + 1,
                    "due_date": due_date,
                    "principal": monthly_principal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
                    "interest": Decimal("0"),
                    "amount": monthly_principal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                })
            return installments
        
        monthly_payment = (
            principal * monthly_rate * (1 + monthly_rate) ** months
        ) / ((1 + monthly_rate) ** months - 1)
        
        remaining_principal = principal
        installments = []
        
        for i in range(months):
            due_date = DateTimeUtils.add_months(start_date, i + 1)
            interest = remaining_principal * monthly_rate
            principal_payment = monthly_payment - interest
            
            if i == months - 1:
                principal_payment = remaining_principal
                interest = remaining_principal * monthly_rate
                monthly_payment = principal_payment + interest
            
            interest = interest.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            principal_payment = principal_payment.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            monthly_payment = monthly_payment.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            
            installments.append({
                "installment_no": i + 1,
                "due_date": due_date,
                "principal": principal_payment,
                "interest": interest,
                "amount": monthly_payment
            })
            
            remaining_principal -= principal_payment
        
        return installments
    
    def calculate_extension_plan(
        self,
        loan_account: LoanAccount,
        current_plan: RepaymentPlan,
        extension_months: int,
        extension_rate: Optional[Decimal] = None
    ) -> Tuple[RepaymentPlan, List[RepaymentInstallment]]:
        remaining_principal = loan_account.remaining_principal
        
        effective_rate = extension_rate or loan_account.extension_interest_rate or loan_account.annual_interest_rate
        
        installments_data = self.calculate_equal_installment(
            principal=remaining_principal,
            annual_rate=effective_rate,
            months=extension_months,
            start_date=DateTimeUtils.now_naive()
        )
        
        total_principal = sum(i["principal"] for i in installments_data)
        total_interest = sum(i["interest"] for i in installments_data)
        total_amount = sum(i["amount"] for i in installments_data)
        
        new_plan = RepaymentPlan(
            plan_no=IdGenerator.generate_plan_no(),
            loan_account_id=loan_account.id,
            version=current_plan.version + 1,
            is_current=False,
            total_principal=total_principal,
            total_interest=total_interest,
            total_amount=total_amount,
            start_date=installments_data[0]["due_date"] if installments_data else DateTimeUtils.now_naive(),
            end_date=installments_data[-1]["due_date"] if installments_data else DateTimeUtils.now_naive(),
            source_type=SourceType.EXTENSION.value,
            status=RepaymentPlanStatus.ACTIVE.value
        )
        
        self.db.add(new_plan)
        self.db.flush()
        
        installments = []
        for inst_data in installments_data:
            inst = RepaymentInstallment(
                plan_id=new_plan.id,
                installment_no=inst_data["installment_no"],
                due_date=inst_data["due_date"],
                principal=inst_data["principal"],
                interest=inst_data["interest"],
                amount=inst_data["amount"],
                status=InstallmentStatus.PENDING.value
            )
            installments.append(inst)
            self.db.add(inst)
        
        self.db.flush()
        
        return new_plan, installments
    
    def create_history_record(
        self,
        plan: RepaymentPlan,
        change_type: str,
        change_reason: str,
        before_data: Dict[str, Any],
        after_data: Dict[str, Any],
        operation_source: str = "SYSTEM",
        created_by: Optional[str] = None,
        related_application_id: Optional[int] = None
    ) -> RepaymentPlanHistory:
        import json
        
        history = RepaymentPlanHistory(
            plan_id=plan.id,
            change_type=change_type,
            change_reason=change_reason,
            before_data=json.dumps(before_data, ensure_ascii=False) if before_data else None,
            after_data=json.dumps(after_data, ensure_ascii=False) if after_data else None,
            created_by=created_by,
            operation_source=operation_source,
            related_application_id=related_application_id
        )
        self.db.add(history)
        self.db.flush()
        return history
    
    def activate_new_plan(
        self,
        old_plan: RepaymentPlan,
        new_plan: RepaymentPlan,
        related_application_id: Optional[int] = None,
        created_by: Optional[str] = None
    ) -> None:
        old_plan.is_current = False
        old_plan.status = RepaymentPlanStatus.REPLACED.value
        
        new_plan.is_current = True
        new_plan.status = RepaymentPlanStatus.ACTIVE.value
        
        self.create_history_record(
            plan=old_plan,
            change_type="DEACTIVATED",
            change_reason="还款计划被新计划替换",
            before_data={"is_current": True, "status": "ACTIVE"},
            after_data={"is_current": False, "status": "REPLACED"},
            operation_source="SYSTEM",
            created_by=created_by,
            related_application_id=related_application_id
        )
        
        self.create_history_record(
            plan=new_plan,
            change_type="ACTIVATED",
            change_reason="新还款计划激活",
            before_data={"is_current": False, "status": "ACTIVE"},
            after_data={"is_current": True, "status": "ACTIVE"},
            operation_source="SYSTEM",
            created_by=created_by,
            related_application_id=related_application_id
        )
        
        self.db.flush()
    
    def calculate_penalty(
        self,
        overdue_principal: Decimal,
        overdue_interest: Decimal,
        overdue_days: int,
        penalty_rate: Decimal
    ) -> Tuple[Decimal, List[Dict[str, Any]]]:
        daily_rate = penalty_rate / Decimal("100")
        
        principal_penalty = overdue_principal * daily_rate * Decimal(str(overdue_days))
        interest_penalty = overdue_interest * daily_rate * Decimal(str(overdue_days))
        
        total_penalty = (principal_penalty + interest_penalty).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        
        details = [
            {
                "item": "逾期本金罚息",
                "base_amount": str(overdue_principal),
                "rate": str(daily_rate),
                "days": overdue_days,
                "amount": str(principal_penalty.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
            },
            {
                "item": "逾期利息罚息",
                "base_amount": str(overdue_interest),
                "rate": str(daily_rate),
                "days": overdue_days,
                "amount": str(interest_penalty.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
            }
        ]
        
        return total_penalty, details
    
    def get_plan_snapshot(self, plan: RepaymentPlan) -> Dict[str, Any]:
        installments = self.db.query(RepaymentInstallment).filter(
            RepaymentInstallment.plan_id == plan.id
        ).order_by(RepaymentInstallment.installment_no).all()
        
        return {
            "plan_id": plan.id,
            "plan_no": plan.plan_no,
            "version": plan.version,
            "is_current": plan.is_current,
            "total_principal": str(plan.total_principal),
            "total_interest": str(plan.total_interest),
            "total_amount": str(plan.total_amount),
            "start_date": plan.start_date.isoformat(),
            "end_date": plan.end_date.isoformat(),
            "source_type": plan.source_type,
            "status": plan.status,
            "installments": [
                {
                    "installment_no": inst.installment_no,
                    "due_date": inst.due_date.isoformat(),
                    "principal": str(inst.principal),
                    "interest": str(inst.interest),
                    "amount": str(inst.amount),
                    "paid_principal": str(inst.paid_principal),
                    "paid_interest": str(inst.paid_interest),
                    "status": inst.status
                }
                for inst in installments
            ]
        }
