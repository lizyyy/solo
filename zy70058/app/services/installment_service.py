from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timedelta
from app import db
from app.models import (
    Account, InstallmentPlan, FeeAmortization, InstallmentPayment,
    BillRecord, ExceptionRecord, PendingTask
)
from config import Config


class InstallmentService:
    
    @staticmethod
    def create_installment_plan(
        account_id,
        original_transaction_id,
        original_amount,
        installment_months,
        fee_rate=None,
        start_date=None
    ):
        if fee_rate is None:
            fee_rate = Config.DEFAULT_FEE_RATE
        
        if start_date is None:
            start_date = datetime.now().date()
        
        original_amount = Decimal(str(original_amount))
        fee_rate = Decimal(str(fee_rate))
        
        account = Account.query.get(account_id)
        if not account:
            raise ValueError(f"Account {account_id} not found")
        
        if installment_months <= 0 or installment_months > Config.MAX_INSTALLMENT_MONTHS:
            raise ValueError(f"Invalid installment months: {installment_months}")
        
        if original_amount <= 0:
            raise ValueError("Original amount must be positive")
        
        if original_amount > account.available_credit:
            raise ValueError("Insufficient available credit")
        
        total_fee = (original_amount * fee_rate * installment_months).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        total_amount = original_amount + total_fee
        
        monthly_principal = (original_amount / installment_months).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        monthly_fee = (total_fee / installment_months).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        monthly_installment = monthly_principal + monthly_fee
        
        next_due_date = start_date + timedelta(days=30)
        
        plan = InstallmentPlan(
            account_id=account_id,
            original_transaction_id=original_transaction_id,
            original_amount=original_amount,
            total_fee=total_fee,
            total_amount=total_amount,
            installment_months=installment_months,
            monthly_principal=monthly_principal,
            monthly_fee=monthly_fee,
            monthly_installment=monthly_installment,
            fee_rate=fee_rate,
            start_date=start_date,
            next_due_date=next_due_date,
            remaining_principal=original_amount,
            remaining_fee=total_fee
        )
        
        db.session.add(plan)
        db.session.flush()
        
        InstallmentService._generate_amortization_schedule(
            plan, original_amount, total_fee, installment_months,
            monthly_principal, monthly_fee, start_date
        )
        
        account.used_credit += original_amount
        account.available_credit -= original_amount
        
        InstallmentService._record_bill_entry(
            account_id=account_id,
            transaction_id=f"INST-{original_transaction_id}",
            transaction_date=start_date,
            transaction_type='installment_activation',
            description=f"分期激活 - 金额: {original_amount}, 期数: {installment_months}",
            debit_amount=original_amount,
            credit_amount=Decimal('0'),
            source='installment_service',
            source_id=str(plan.id)
        )
        
        db.session.commit()
        return plan
    
    @staticmethod
    def _generate_amortization_schedule(
        plan, original_amount, total_fee, installment_months,
        monthly_principal, monthly_fee, start_date
    ):
        remaining_principal = original_amount
        
        for period in range(1, installment_months + 1):
            due_date = start_date + timedelta(days=30 * period)
            
            if period == installment_months:
                period_principal = remaining_principal
                period_fee = total_fee - (monthly_fee * (installment_months - 1))
                period_fee = period_fee.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            else:
                period_principal = monthly_principal
                period_fee = monthly_fee
            
            total = period_principal + period_fee
            remaining_principal_after = remaining_principal - period_principal
            
            amortization = FeeAmortization(
                plan_id=plan.id,
                period=period,
                due_date=due_date,
                principal=period_principal,
                fee=period_fee,
                total=total,
                remaining_principal_before=remaining_principal,
                remaining_principal_after=remaining_principal_after
            )
            
            db.session.add(amortization)
            remaining_principal = remaining_principal_after
    
    @staticmethod
    def get_installment_plan(plan_id, include_amortizations=False):
        plan = InstallmentPlan.query.get(plan_id)
        if not plan:
            return None
        return plan.to_dict(include_amortizations=include_amortizations)
    
    @staticmethod
    def get_account_installments(account_id, status=None):
        query = InstallmentPlan.query.filter_by(account_id=account_id)
        if status:
            query = query.filter_by(status=status)
        plans = query.order_by(InstallmentPlan.created_at.desc()).all()
        return [p.to_dict() for p in plans]
    
    @staticmethod
    def _record_bill_entry(**kwargs):
        account_id = kwargs.get('account_id')
        if account_id:
            last_bill = BillRecord.query.filter_by(
                account_id=account_id
            ).order_by(BillRecord.created_at.desc()).first()
            previous_balance = last_bill.balance if last_bill else Decimal('0')
        else:
            previous_balance = Decimal('0')
        
        debit = kwargs.get('debit_amount', Decimal('0'))
        credit = kwargs.get('credit_amount', Decimal('0'))
        balance = previous_balance + debit - credit
        
        bill = BillRecord(
            account_id=kwargs.get('account_id'),
            bill_cycle=kwargs.get('transaction_date').strftime('%Y-%m'),
            transaction_id=kwargs.get('transaction_id'),
            transaction_date=kwargs.get('transaction_date'),
            transaction_type=kwargs.get('transaction_type'),
            description=kwargs.get('description'),
            debit_amount=debit,
            credit_amount=credit,
            balance=balance,
            source=kwargs.get('source', 'system'),
            source_id=kwargs.get('source_id')
        )
        db.session.add(bill)
