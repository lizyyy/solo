from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
import json
import uuid
from app import db
from app.models import (
    Account, InstallmentPlan, FeeAmortization, InstallmentPayment,
    RevocationRecord, BillRecord, ExceptionRecord, PendingTask
)
from config import Config
from app.services.installment_service import InstallmentService


class RevocationService:
    
    @staticmethod
    def revoke_installment_plan(plan_id, reason=None, transaction_id=None):
        plan = InstallmentPlan.query.get(plan_id)
        if not plan:
            raise ValueError(f"Installment plan {plan_id} not found")
        
        if plan.status != InstallmentPlan.STATUS_ACTIVE:
            raise ValueError(f"Cannot revoke plan with status: {plan.status}")
        
        account = Account.query.get(plan.account_id)
        if not account:
            raise ValueError(f"Account {plan.account_id} not found")
        
        now = datetime.now()
        if transaction_id is None:
            transaction_id = f"REV-{plan.id}-{uuid.uuid4().hex[:8]}"
        
        paid_amortizations = FeeAmortization.query.filter_by(
            plan_id=plan.id,
            status=FeeAmortization.STATUS_PAID
        ).order_by(FeeAmortization.period).all()
        
        original_paid_principal = sum(a.principal for a in paid_amortizations)
        original_paid_fee = sum(a.fee for a in paid_amortizations)
        
        refund_principal = original_paid_principal
        refund_fee = original_paid_fee
        total_refund = refund_principal + refund_fee
        penalty_fee = Decimal('0')
        amount_to_collect = plan.remaining_principal
        
        credit_restored = plan.original_amount
        
        revocation = RevocationRecord(
            plan_id=plan.id,
            revocation_type=RevocationRecord.TYPE_FULL_REVOCATION,
            transaction_id=transaction_id,
            original_paid_principal=original_paid_principal,
            original_paid_fee=original_paid_fee,
            refund_principal=refund_principal,
            refund_fee=refund_fee,
            total_refund=total_refund,
            penalty_fee=penalty_fee,
            amount_to_collect=amount_to_collect,
            remaining_principal_before=plan.remaining_principal,
            remaining_fee_before=plan.remaining_fee,
            credit_restored=credit_restored,
            reason=reason
        )
        db.session.add(revocation)
        
        plan.status = InstallmentPlan.STATUS_REVOKED
        plan.remaining_principal = Decimal('0')
        plan.remaining_fee = Decimal('0')
        
        unpaid_amortizations = FeeAmortization.query.filter_by(
            plan_id=plan.id,
            status=FeeAmortization.STATUS_UNPAID
        ).all()
        for amort in unpaid_amortizations:
            amort.status = FeeAmortization.STATUS_WAIVED
        
        account.used_credit -= credit_restored
        account.available_credit += credit_restored
        
        RevocationService._record_revocation_bill_entries(
            account, plan, revocation, now
        )
        
        if total_refund > 0:
            task = PendingTask(
                task_type=PendingTask.TYPE_REFUND_PROCESS,
                account_id=account.id,
                plan_id=plan.id,
                transaction_id=transaction_id,
                title=f"分期撤销退款处理 - 计划#{plan.id}",
                description=f"需要退回客户已支付的本金{refund_principal}和手续费{refund_fee}",
                task_data=json.dumps({
                    'refund_principal': float(refund_principal),
                    'refund_fee': float(refund_fee),
                    'total_refund': float(total_refund)
                })
            )
            db.session.add(task)
        
        if amount_to_collect > 0:
            task = PendingTask(
                task_type=PendingTask.TYPE_FEE_ADJUSTMENT,
                account_id=account.id,
                plan_id=plan.id,
                transaction_id=transaction_id,
                title=f"分期撤销待收金额处理 - 计划#{plan.id}",
                description=f"需要向客户收取未还本金{amount_to_collect}",
                task_data=json.dumps({
                    'amount_to_collect': float(amount_to_collect)
                })
            )
            db.session.add(task)
        
        RevocationService._validate_revocation(plan, revocation, account)
        
        db.session.commit()
        return revocation
    
    @staticmethod
    def early_settle_installment_plan(plan_id, reason=None, transaction_id=None):
        plan = InstallmentPlan.query.get(plan_id)
        if not plan:
            raise ValueError(f"Installment plan {plan_id} not found")
        
        if plan.status != InstallmentPlan.STATUS_ACTIVE:
            raise ValueError(f"Cannot early settle plan with status: {plan.status}")
        
        account = Account.query.get(plan.account_id)
        if not account:
            raise ValueError(f"Account {plan.account_id} not found")
        
        now = datetime.now()
        if transaction_id is None:
            transaction_id = f"ES-{plan.id}-{uuid.uuid4().hex[:8]}"
        
        paid_amortizations = FeeAmortization.query.filter_by(
            plan_id=plan.id,
            status=FeeAmortization.STATUS_PAID
        ).order_by(FeeAmortization.period).all()
        
        original_paid_principal = sum(a.principal for a in paid_amortizations)
        original_paid_fee = sum(a.fee for a in paid_amortizations)
        
        remaining_periods = plan.installment_months - plan.paid_months
        penalty_fee = (plan.remaining_principal * Decimal(str(Config.EARLY_REPAYMENT_FEE_RATE))).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        
        refund_principal = Decimal('0')
        refund_fee = Decimal('0')
        total_refund = Decimal('0')
        amount_to_collect = plan.remaining_principal + plan.remaining_fee + penalty_fee
        
        credit_restored = plan.remaining_principal
        
        revocation = RevocationRecord(
            plan_id=plan.id,
            revocation_type=RevocationRecord.TYPE_EARLY_SETTLEMENT,
            transaction_id=transaction_id,
            original_paid_principal=original_paid_principal,
            original_paid_fee=original_paid_fee,
            refund_principal=refund_principal,
            refund_fee=refund_fee,
            total_refund=total_refund,
            penalty_fee=penalty_fee,
            amount_to_collect=amount_to_collect,
            remaining_principal_before=plan.remaining_principal,
            remaining_fee_before=plan.remaining_fee,
            credit_restored=credit_restored,
            reason=reason
        )
        db.session.add(revocation)
        
        payment = InstallmentPayment(
            plan_id=plan.id,
            payment_type=InstallmentPayment.TYPE_EARLY,
            transaction_id=f"PYMT-{transaction_id}",
            principal_paid=plan.remaining_principal,
            fee_paid=plan.remaining_fee,
            total_paid=plan.remaining_principal + plan.remaining_fee
        )
        db.session.add(payment)
        
        plan.status = InstallmentPlan.STATUS_EARLY_SETTLED
        plan.remaining_principal = Decimal('0')
        plan.remaining_fee = Decimal('0')
        
        unpaid_amortizations = FeeAmortization.query.filter_by(
            plan_id=plan.id,
            status=FeeAmortization.STATUS_UNPAID
        ).all()
        for amort in unpaid_amortizations:
            amort.status = FeeAmortization.STATUS_ADJUSTED
            amort.actual_paid_amount = amort.total
            amort.paid_at = now
        
        account.used_credit -= credit_restored
        account.available_credit += credit_restored
        
        RevocationService._record_early_settlement_bill_entries(
            account, plan, revocation, payment, now
        )
        
        if amount_to_collect > 0:
            task = PendingTask(
                task_type=PendingTask.TYPE_FEE_ADJUSTMENT,
                account_id=account.id,
                plan_id=plan.id,
                transaction_id=transaction_id,
                title=f"提前还款待收金额处理 - 计划#{plan.id}",
                description=f"需要向客户收取提前还款金额: 本金{plan.remaining_principal} + 剩余手续费{plan.remaining_fee} + 违约金{penalty_fee}",
                task_data=json.dumps({
                    'remaining_principal': float(plan.remaining_principal),
                    'remaining_fee': float(plan.remaining_fee),
                    'penalty_fee': float(penalty_fee),
                    'amount_to_collect': float(amount_to_collect)
                })
            )
            db.session.add(task)
        
        RevocationService._validate_early_settlement(plan, revocation, account)
        
        db.session.commit()
        return revocation
    
    @staticmethod
    def _record_revocation_bill_entries(account, plan, revocation, now):
        if revocation.total_refund > 0:
            InstallmentService._record_bill_entry(
                account_id=account.id,
                transaction_id=f"BILL-REF-{revocation.transaction_id}",
                transaction_date=now.date(),
                transaction_type='refund',
                description=f"分期撤销退款 - 计划#{plan.id}: 本金{revocation.refund_principal} + 手续费{revocation.refund_fee}",
                debit_amount=Decimal('0'),
                credit_amount=revocation.total_refund,
                source='revocation_service',
                source_id=str(revocation.id)
            )
        
        if revocation.amount_to_collect > 0:
            InstallmentService._record_bill_entry(
                account_id=account.id,
                transaction_id=f"BILL-COL-{revocation.transaction_id}",
                transaction_date=now.date(),
                transaction_type='installment_revocation',
                description=f"分期撤销待收本金 - 计划#{plan.id}",
                debit_amount=revocation.amount_to_collect,
                credit_amount=Decimal('0'),
                source='revocation_service',
                source_id=str(revocation.id)
            )
        
        InstallmentService._record_bill_entry(
            account_id=account.id,
            transaction_id=f"BILL-CREDIT-{revocation.transaction_id}",
            transaction_date=now.date(),
            transaction_type='credit_restore',
            description=f"额度恢复 - 计划#{plan.id}: 恢复{revocation.credit_restored}",
            debit_amount=Decimal('0'),
            credit_amount=revocation.credit_restored,
            source='credit_service',
            source_id=str(revocation.id)
        )
    
    @staticmethod
    def _record_early_settlement_bill_entries(account, plan, revocation, payment, now):
        InstallmentService._record_bill_entry(
            account_id=account.id,
            transaction_id=f"BILL-ES-{revocation.transaction_id}",
            transaction_date=now.date(),
            transaction_type='early_settlement',
            description=f"提前还款 - 计划#{plan.id}: 本金{payment.principal_paid} + 手续费{payment.fee_paid} + 违约金{revocation.penalty_fee}",
            debit_amount=revocation.amount_to_collect,
            credit_amount=Decimal('0'),
            source='revocation_service',
            source_id=str(revocation.id)
        )
        
        InstallmentService._record_bill_entry(
            account_id=account.id,
            transaction_id=f"BILL-CREDIT-{revocation.transaction_id}",
            transaction_date=now.date(),
            transaction_type='credit_restore',
            description=f"提前还款额度恢复 - 计划#{plan.id}: 恢复{revocation.credit_restored}",
            debit_amount=Decimal('0'),
            credit_amount=revocation.credit_restored,
            source='credit_service',
            source_id=str(revocation.id)
        )
    
    @staticmethod
    def _validate_revocation(plan, revocation, account):
        errors = []
        
        if revocation.credit_restored != plan.original_amount:
            errors.append(f"额度恢复金额不符: 预期{plan.original_amount}, 实际{revocation.credit_restored}")
        
        expected_remaining = plan.original_amount - revocation.original_paid_principal
        if expected_remaining != revocation.remaining_principal_before:
            errors.append(f"剩余本金计算错误: 预期{expected_remaining}, 实际{revocation.remaining_principal_before}")
        
        account_expected = account.credit_limit - account.used_credit
        if abs(account_expected - account.available_credit) > Decimal('0.01'):
            errors.append(f"账户额度校验失败: 可用额度{account.available_credit} 应等于 信用额度{account.credit_limit} - 已用额度{account.used_credit}")
        
        if errors:
            exception = ExceptionRecord(
                account_id=account.id,
                plan_id=plan.id,
                exception_type='revocation_validation_error',
                severity=ExceptionRecord.SEVERITY_HIGH,
                title='分期撤销校验失败',
                description='; '.join(errors),
                source_data=json.dumps({
                    'plan_id': plan.id,
                    'revocation_id': revocation.id,
                    'errors': errors
                })
            )
            db.session.add(exception)
    
    @staticmethod
    def _validate_early_settlement(plan, revocation, account):
        errors = []
        
        expected_penalty = plan.remaining_principal * Decimal(str(Config.EARLY_REPAYMENT_FEE_RATE))
        expected_penalty = expected_penalty.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        if abs(revocation.penalty_fee - expected_penalty) > Decimal('0.01'):
            errors.append(f"违约金计算错误: 预期{expected_penalty}, 实际{revocation.penalty_fee}")
        
        expected_total = plan.remaining_principal + plan.remaining_fee + expected_penalty
        if abs(revocation.amount_to_collect - expected_total) > Decimal('0.01'):
            errors.append(f"应收金额计算错误: 预期{expected_total}, 实际{revocation.amount_to_collect}")
        
        if revocation.credit_restored != plan.remaining_principal:
            errors.append(f"额度恢复金额不符: 预期{plan.remaining_principal}, 实际{revocation.credit_restored}")
        
        if errors:
            exception = ExceptionRecord(
                account_id=account.id,
                plan_id=plan.id,
                exception_type='early_settlement_validation_error',
                severity=ExceptionRecord.SEVERITY_HIGH,
                title='提前还款校验失败',
                description='; '.join(errors),
                source_data=json.dumps({
                    'plan_id': plan.id,
                    'revocation_id': revocation.id,
                    'errors': errors
                })
            )
            db.session.add(exception)
    
    @staticmethod
    def get_revocation_records(plan_id=None, account_id=None):
        query = RevocationRecord.query
        if plan_id:
            query = query.filter_by(plan_id=plan_id)
        if account_id:
            query = query.join(InstallmentPlan).filter(InstallmentPlan.account_id == account_id)
        records = query.order_by(RevocationRecord.created_at.desc()).all()
        return [r.to_dict() for r in records]
