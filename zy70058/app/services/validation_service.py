from decimal import Decimal
from datetime import datetime
import json
from app import db
from app.models import (
    Account, InstallmentPlan, FeeAmortization, InstallmentPayment,
    RevocationRecord, BillRecord, ExceptionRecord, PendingTask
)
from config import Config


class ValidationService:
    
    @staticmethod
    def validate_credit_restore(account_id, plan_id, expected_restore_amount):
        account = Account.query.get(account_id)
        if not account:
            raise ValueError(f"Account {account_id} not found")
        
        plan = InstallmentPlan.query.get(plan_id)
        if not plan:
            raise ValueError(f"Installment plan {plan_id} not found")
        
        expected_restore_amount = Decimal(str(expected_restore_amount))
        
        revocation = RevocationRecord.query.filter_by(plan_id=plan_id).order_by(
            RevocationRecord.created_at.desc()
        ).first()
        
        validation = {
            'is_valid': True,
            'account_id': account_id,
            'plan_id': plan_id,
            'expected_restore': float(expected_restore_amount),
            'plan_status': plan.status,
            'errors': [],
            'warnings': []
        }
        
        if plan.status not in [InstallmentPlan.STATUS_REVOKED, InstallmentPlan.STATUS_EARLY_SETTLED]:
            validation['errors'].append(f"分期计划状态不正确: {plan.status}, 应为已撤销或提前结清")
            validation['is_valid'] = False
        
        if plan.remaining_principal != Decimal('0'):
            validation['errors'].append(f"分期计划剩余本金不为0: {plan.remaining_principal}")
            validation['is_valid'] = False
        
        if plan.remaining_fee != Decimal('0'):
            validation['errors'].append(f"分期计划剩余手续费不为0: {plan.remaining_fee}")
            validation['is_valid'] = False
        
        if revocation:
            validation['revocation_type'] = revocation.revocation_type
            validation['credit_restored'] = float(revocation.credit_restored)
            
            if plan.status == InstallmentPlan.STATUS_REVOKED:
                if revocation.credit_restored != plan.original_amount:
                    validation['errors'].append(
                        f"撤销场景额度恢复值不正确: 预期{plan.original_amount}, 实际{revocation.credit_restored}"
                    )
                    validation['is_valid'] = False
            elif plan.status == InstallmentPlan.STATUS_EARLY_SETTLED:
                if revocation.credit_restored != revocation.remaining_principal_before:
                    validation['errors'].append(
                        f"提前还款场景额度恢复值不正确: 预期{revocation.remaining_principal_before}, 实际{revocation.credit_restored}"
                    )
                    validation['is_valid'] = False
        
        if abs(account.credit_limit - (account.available_credit + account.used_credit)) > Decimal('0.01'):
            validation['errors'].append(
                f"账户总额度校验失败: 信用额度{account.credit_limit} 不等于 可用额度{account.available_credit} + 已用额度{account.used_credit}"
            )
            validation['is_valid'] = False
        
        if not validation['is_valid']:
            exception = ExceptionRecord(
                account_id=account_id,
                plan_id=plan_id,
                exception_type='credit_restore_validation_error',
                severity=ExceptionRecord.SEVERITY_CRITICAL,
                title='额度恢复校验失败',
                description='; '.join(validation['errors']),
                source_data=json.dumps(validation, ensure_ascii=False, default=str)
            )
            db.session.add(exception)
            db.session.commit()
        
        return validation
    
    @staticmethod
    def validate_fee_amortization(plan_id):
        plan = InstallmentPlan.query.get(plan_id)
        if not plan:
            raise ValueError(f"Installment plan {plan_id} not found")
        
        amortizations = FeeAmortization.query.filter_by(
            plan_id=plan_id
        ).order_by(FeeAmortization.period).all()
        
        validation = {
            'is_valid': True,
            'plan_id': plan_id,
            'total_amortizations': len(amortizations),
            'expected_periods': plan.installment_months,
            'calculated_total_principal': 0,
            'calculated_total_fee': 0,
            'calculated_total': 0,
            'plan_total_principal': float(plan.original_amount),
            'plan_total_fee': float(plan.total_fee),
            'plan_total_amount': float(plan.total_amount),
            'errors': [],
            'warnings': [],
            'period_details': []
        }
        
        if len(amortizations) != plan.installment_months:
            validation['errors'].append(
                f"摊销期数不符: 预期{plan.installment_months}, 实际{len(amortizations)}"
            )
            validation['is_valid'] = False
        
        remaining_principal = plan.original_amount
        
        for i, amort in enumerate(amortizations):
            period_detail = {
                'period': amort.period,
                'principal': float(amort.principal),
                'fee': float(amort.fee),
                'total': float(amort.total),
                'remaining_before': float(amort.remaining_principal_before),
                'remaining_after': float(amort.remaining_principal_after),
                'errors': []
            }
            
            validation['calculated_total_principal'] += float(amort.principal)
            validation['calculated_total_fee'] += float(amort.fee)
            validation['calculated_total'] += float(amort.total)
            
            if abs(amort.remaining_principal_before - remaining_principal) > Decimal('0.01'):
                period_detail['errors'].append(
                    f"期初剩余本金不正确: 预期{remaining_principal}, 实际{amort.remaining_principal_before}"
                )
                validation['is_valid'] = False
            
            expected_remaining_after = remaining_principal - amort.principal
            if abs(amort.remaining_principal_after - expected_remaining_after) > Decimal('0.01'):
                period_detail['errors'].append(
                    f"期末剩余本金不正确: 预期{expected_remaining_after}, 实际{amort.remaining_principal_after}"
                )
                validation['is_valid'] = False
            
            if abs(amort.total - (amort.principal + amort.fee)) > Decimal('0.01'):
                period_detail['errors'].append(
                    f"期供金额计算错误: 本金+手续费={amort.principal + amort.fee}, 期供={amort.total}"
                )
                validation['is_valid'] = False
            
            validation['period_details'].append(period_detail)
            remaining_principal = expected_remaining_after
        
        if abs(validation['calculated_total_principal'] - float(plan.original_amount)) > 0.01:
            validation['errors'].append(
                f"摊销本金总和不正确: 预期{plan.original_amount}, 计算值{validation['calculated_total_principal']}"
            )
            validation['is_valid'] = False
        
        if abs(validation['calculated_total_fee'] - float(plan.total_fee)) > 0.01:
            validation['errors'].append(
                f"摊销手续费总和不正确: 预期{plan.total_fee}, 计算值{validation['calculated_total_fee']}"
            )
            validation['is_valid'] = False
        
        if not validation['is_valid']:
            exception = ExceptionRecord(
                plan_id=plan_id,
                exception_type='fee_amortization_validation_error',
                severity=ExceptionRecord.SEVERITY_HIGH,
                title='手续费摊销校验失败',
                description='; '.join(validation['errors']),
                source_data=json.dumps(validation, ensure_ascii=False, default=str)
            )
            db.session.add(exception)
            db.session.commit()
        
        return validation
    
    @staticmethod
    def validate_bill_consistency(account_id, start_date=None, end_date=None):
        account = Account.query.get(account_id)
        if not account:
            raise ValueError(f"Account {account_id} not found")
        
        query = BillRecord.query.filter_by(account_id=account_id)
        if start_date:
            query = query.filter(BillRecord.transaction_date >= start_date)
        if end_date:
            query = query.filter(BillRecord.transaction_date <= end_date)
        
        bills = query.order_by(BillRecord.transaction_date, BillRecord.created_at).all()
        
        validation = {
            'is_valid': True,
            'account_id': account_id,
            'total_bills': len(bills),
            'total_debit': 0,
            'total_credit': 0,
            'errors': [],
            'warnings': [],
            'bill_checks': []
        }
        
        expected_balance = Decimal('0')
        previous_balance = Decimal('0')
        
        for i, bill in enumerate(bills):
            check = {
                'bill_id': bill.id,
                'transaction_id': bill.transaction_id,
                'transaction_type': bill.transaction_type,
                'debit': float(bill.debit_amount),
                'credit': float(bill.credit_amount),
                'stated_balance': float(bill.balance),
                'errors': []
            }
            
            validation['total_debit'] += float(bill.debit_amount)
            validation['total_credit'] += float(bill.credit_amount)
            
            expected_balance = previous_balance + bill.debit_amount - bill.credit_amount
            
            if abs(bill.balance - expected_balance) > Decimal('0.01'):
                check['errors'].append(
                    f"余额计算不正确: 前余额{previous_balance} + 借方{bill.debit_amount} - 贷方{bill.credit_amount} = {expected_balance}, 实际{bill.balance}"
                )
                validation['is_valid'] = False
            
            if bill.bill_cycle != bill.transaction_date.strftime('%Y-%m'):
                check['errors'].append(
                    f"账单周期不一致: transaction_date={bill.transaction_date}, bill_cycle={bill.bill_cycle}"
                )
                validation['is_valid'] = False
            
            validation['bill_checks'].append(check)
            previous_balance = bill.balance
        
        duplicate_checks = {}
        for bill in bills:
            if bill.transaction_id in duplicate_checks:
                validation['errors'].append(f"交易ID重复: {bill.transaction_id}")
                validation['is_valid'] = False
            duplicate_checks[bill.transaction_id] = True
        
        if not validation['is_valid']:
            exception = ExceptionRecord(
                account_id=account_id,
                exception_type='bill_consistency_error',
                severity=ExceptionRecord.SEVERITY_CRITICAL,
                title='账单一致性校验失败',
                description='; '.join(validation['errors']),
                source_data=json.dumps(validation, ensure_ascii=False, default=str)
            )
            db.session.add(exception)
            db.session.commit()
        
        return validation
    
    @staticmethod
    def validate_payment_chain(plan_id):
        plan = InstallmentPlan.query.get(plan_id)
        if not plan:
            raise ValueError(f"Installment plan {plan_id} not found")
        
        payments = InstallmentPayment.query.filter_by(
            plan_id=plan_id
        ).order_by(InstallmentPayment.paid_at).all()
        
        amortizations = FeeAmortization.query.filter_by(
            plan_id=plan_id
        ).order_by(FeeAmortization.period).all()
        
        validation = {
            'is_valid': True,
            'plan_id': plan_id,
            'total_payments': len(payments),
            'total_principal_paid': 0,
            'total_fee_paid': 0,
            'plan_paid_months': plan.paid_months,
            'errors': [],
            'payment_details': []
        }
        
        for payment in payments:
            detail = {
                'payment_id': payment.id,
                'payment_type': payment.payment_type,
                'principal_paid': float(payment.principal_paid),
                'fee_paid': float(payment.fee_paid),
                'total_paid': float(payment.total_paid),
                'period_covered': payment.period_covered,
                'errors': []
            }
            
            validation['total_principal_paid'] += float(payment.principal_paid)
            validation['total_fee_paid'] += float(payment.fee_paid)
            
            if abs(payment.total_paid - (payment.principal_paid + payment.fee_paid)) > Decimal('0.01'):
                detail['errors'].append(
                    f"付款金额不一致: total={payment.total_paid}, principal+fee={payment.principal_paid + payment.fee_paid}"
                )
                validation['is_valid'] = False
            
            validation['payment_details'].append(detail)
        
        paid_amorts = [a for a in amortizations if a.status == FeeAmortization.STATUS_PAID]
        actual_paid_months = len(paid_amorts)
        
        if plan.paid_months != actual_paid_months:
            validation['errors'].append(
                f"已还期数不一致: plan.paid_months={plan.paid_months}, 实际已还={actual_paid_months}"
            )
            validation['is_valid'] = False
        
        expected_remaining_principal = plan.original_amount - Decimal(str(validation['total_principal_paid']))
        if abs(plan.remaining_principal - expected_remaining_principal) > Decimal('0.01'):
            validation['errors'].append(
                f"剩余本金计算不一致: plan.remaining_principal={plan.remaining_principal}, 计算值={expected_remaining_principal}"
            )
            validation['is_valid'] = False
        
        if not validation['is_valid']:
            exception = ExceptionRecord(
                plan_id=plan_id,
                exception_type='payment_chain_validation_error',
                severity=ExceptionRecord.SEVERITY_HIGH,
                title='还款链路校验失败',
                description='; '.join(validation['errors']),
                source_data=json.dumps(validation, ensure_ascii=False, default=str)
            )
            db.session.add(exception)
            db.session.commit()
        
        return validation
    
    @staticmethod
    def run_comprehensive_validation(plan_id):
        plan = InstallmentPlan.query.get(plan_id)
        if not plan:
            raise ValueError(f"Installment plan {plan_id} not found")
        
        results = {
            'plan_id': plan_id,
            'account_id': plan.account_id,
            'status': plan.status,
            'validated_at': datetime.now().isoformat(),
            'amortization_validation': None,
            'payment_chain_validation': None,
            'bill_validation': None,
            'credit_restore_validation': None,
            'overall_status': 'pending',
            'total_errors': 0,
            'critical_severity_count': 0
        }
        
        results['amortization_validation'] = ValidationService.validate_fee_amortization(plan_id)
        results['payment_chain_validation'] = ValidationService.validate_payment_chain(plan_id)
        results['bill_validation'] = ValidationService.validate_bill_consistency(plan.account_id)
        
        if plan.status in [InstallmentPlan.STATUS_REVOKED, InstallmentPlan.STATUS_EARLY_SETTLED]:
            results['credit_restore_validation'] = ValidationService.validate_credit_restore(
                plan.account_id, plan_id, 0
            )
        
        total_errors = 0
        has_critical = False
        
        for key in ['amortization_validation', 'payment_chain_validation', 'bill_validation', 'credit_restore_validation']:
            if results.get(key):
                total_errors += len(results[key].get('errors', []))
        
        results['total_errors'] = total_errors
        results['overall_status'] = 'passed' if total_errors == 0 else 'failed'
        
        return results
