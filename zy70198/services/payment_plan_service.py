from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple
from uuid import uuid4

from models import (
    PaymentPlan, PaymentPlanStatus, PaymentPriority,
    ScheduleRecord, ScheduleStatus
)
from repositories import PaymentPlanRepository, InvoiceRepository, ScheduleRepository


class PaymentPlanService:
    def __init__(
        self,
        plan_repo: PaymentPlanRepository,
        invoice_repo: InvoiceRepository,
        schedule_repo: ScheduleRepository
    ):
        self.plan_repo = plan_repo
        self.invoice_repo = invoice_repo
        self.schedule_repo = schedule_repo

    def create_payment_plan(
        self,
        purchase_order_id: str,
        vendor_id: str,
        vendor_name: str,
        contract_payment_terms: str,
        credit_period_days: int,
        total_amount: float,
        created_by: str,
        priority: PaymentPriority = PaymentPriority.NORMAL,
        expected_payment_date: Optional[date] = None,
        remark: Optional[str] = None
    ) -> Tuple[PaymentPlan, Dict]:
        rule_traces = []
        
        plan_id = f'PP-{datetime.now().strftime("%Y%m%d")}-{str(uuid4())[:6].upper()}'
        
        rule_traces.append({
            'rule': 'PLAN_CREATE_001',
            'description': '付款计划ID生成规则',
            'input': {'timestamp': datetime.now().strftime("%Y%m%d")},
            'output': plan_id,
            'passed': True
        })
        
        if expected_payment_date is None:
            if credit_period_days > 0:
                expected_payment_date = date.today() + timedelta(days=credit_period_days)
                rule_traces.append({
                    'rule': 'PLAN_CREATE_002',
                    'description': '期望付款日期自动计算：开票日期 + 账期天数',
                    'input': {'base_date': date.today().isoformat(), 'credit_days': credit_period_days},
                    'output': expected_payment_date.isoformat(),
                    'passed': True
                })
            else:
                expected_payment_date = date.today()
                rule_traces.append({
                    'rule': 'PLAN_CREATE_003',
                    'description': '账期为0时，期望付款日期设为今日',
                    'input': {'credit_days': 0},
                    'output': expected_payment_date.isoformat(),
                    'passed': True
                })
        else:
            rule_traces.append({
                'rule': 'PLAN_CREATE_004',
                'description': '使用指定的期望付款日期',
                'input': {'specified_date': expected_payment_date.isoformat()},
                'output': expected_payment_date.isoformat(),
                'passed': True
            })
        
        plan = PaymentPlan(
            id=plan_id,
            purchase_order_id=purchase_order_id,
            vendor_id=vendor_id,
            vendor_name=vendor_name,
            contract_payment_terms=contract_payment_terms,
            credit_period_days=credit_period_days,
            total_amount=total_amount,
            priority=priority,
            expected_payment_date=expected_payment_date,
            status=PaymentPlanStatus.DRAFT,
            created_by=created_by,
            remark=remark
        )
        
        self.plan_repo.save(plan)
        
        rule_traces.append({
            'rule': 'PLAN_CREATE_005',
            'description': '付款计划创建成功，初始状态为草稿',
            'input': {'plan_id': plan_id},
            'output': {'status': PaymentPlanStatus.DRAFT.value},
            'passed': True
        })
        
        result_context = {
            'plan_id': plan_id,
            'status': plan.status.value,
            'next_action': '请关联发票后提交排程',
            'rule_traces': rule_traces
        }
        
        return plan, result_context

    def submit_for_scheduling(
        self,
        plan_id: str,
        submitted_by: str
    ) -> Tuple[PaymentPlan, Dict]:
        rule_traces = []
        
        plan = self.plan_repo.get_by_id(plan_id)
        if not plan:
            rule_traces.append({
                'rule': 'PLAN_SUBMIT_001',
                'description': '检查付款计划是否存在',
                'input': {'plan_id': plan_id},
                'output': '未找到付款计划',
                'passed': False
            })
            raise ValueError(f'付款计划 {plan_id} 不存在')
        
        rule_traces.append({
            'rule': 'PLAN_SUBMIT_001',
            'description': '检查付款计划是否存在',
            'input': {'plan_id': plan_id},
            'output': '已找到付款计划',
            'passed': True
        })
        
        if plan.status != PaymentPlanStatus.DRAFT:
            rule_traces.append({
                'rule': 'PLAN_SUBMIT_002',
                'description': '检查付款计划状态是否为草稿',
                'input': {'current_status': plan.status.value},
                'output': '仅草稿状态可提交排程',
                'passed': False
            })
            plan.status = PaymentPlanStatus.MANUAL_REVIEW
            plan.remark = f'状态异常：当前状态为{plan.status.value}，无法提交排程'
            plan.mark_updated()
            self.plan_repo.save(plan)
            
            result_context = {
                'plan_id': plan_id,
                'status': plan.status.value,
                'needs_manual_review': True,
                'review_reason': f'付款计划状态异常，当前为{plan.status.value}，应在草稿状态提交',
                'rule_traces': rule_traces
            }
            return plan, result_context
        
        rule_traces.append({
            'rule': 'PLAN_SUBMIT_002',
            'description': '检查付款计划状态是否为草稿',
            'input': {'current_status': plan.status.value},
            'output': '状态校验通过',
            'passed': True
        })
        
        invoices = self.invoice_repo.get_by_plan_id(plan_id)
        total_invoice_amount = sum(inv.invoice_amount for inv in invoices)
        
        if total_invoice_amount < plan.total_amount:
            rule_traces.append({
                'rule': 'PLAN_SUBMIT_003',
                'description': '检查发票金额是否覆盖计划金额',
                'input': {
                    'plan_amount': plan.total_amount,
                    'invoice_amount': total_invoice_amount,
                    'invoice_count': len(invoices)
                },
                'output': f'发票金额不足，缺口{plan.total_amount - total_invoice_amount:.2f}元',
                'passed': False
            })
            plan.status = PaymentPlanStatus.MANUAL_REVIEW
            plan.remark = f'发票金额不足：计划{plan.total_amount:.2f}元，发票仅{total_invoice_amount:.2f}元'
            plan.mark_updated()
            self.plan_repo.save(plan)
            
            result_context = {
                'plan_id': plan_id,
                'status': plan.status.value,
                'needs_manual_review': True,
                'review_reason': f'发票金额不足，计划金额{plan.total_amount:.2f}元，关联发票仅{total_invoice_amount:.2f}元，请补充发票',
                'rule_traces': rule_traces
            }
            return plan, result_context
        
        rule_traces.append({
            'rule': 'PLAN_SUBMIT_003',
            'description': '检查发票金额是否覆盖计划金额',
            'input': {
                'plan_amount': plan.total_amount,
                'invoice_amount': total_invoice_amount,
                'invoice_count': len(invoices)
            },
            'output': '发票金额校验通过',
            'passed': True
        })
        
        verified_invoices = [inv for inv in invoices if inv.status.value in ['verified', 'matched', 'partially_used', 'fully_used']]
        if len(verified_invoices) < len(invoices):
            unverified_count = len(invoices) - len(verified_invoices)
            rule_traces.append({
                'rule': 'PLAN_SUBMIT_004',
                'description': '检查发票是否已认证',
                'input': {
                    'total_invoices': len(invoices),
                    'verified_count': len(verified_invoices)
                },
                'output': f'{unverified_count}张发票未认证',
                'passed': False
            })
            plan.status = PaymentPlanStatus.MANUAL_REVIEW
            plan.remark = f'{unverified_count}张发票未完成认证'
            plan.mark_updated()
            self.plan_repo.save(plan)
            
            result_context = {
                'plan_id': plan_id,
                'status': plan.status.value,
                'needs_manual_review': True,
                'review_reason': f'存在{unverified_count}张未认证发票，请先完成发票认证后再提交',
                'rule_traces': rule_traces
            }
            return plan, result_context
        
        rule_traces.append({
            'rule': 'PLAN_SUBMIT_004',
            'description': '检查发票是否已认证',
            'input': {'verified_count': len(verified_invoices)},
            'output': '所有发票均已认证',
            'passed': True
        })
        
        plan.status = PaymentPlanStatus.PENDING_SCHEDULE
        plan.mark_updated()
        self.plan_repo.save(plan)
        
        rule_traces.append({
            'rule': 'PLAN_SUBMIT_005',
            'description': '提交排程成功',
            'input': {'plan_id': plan_id},
            'output': {'status': PaymentPlanStatus.PENDING_SCHEDULE.value},
            'passed': True
        })
        
        result_context = {
            'plan_id': plan_id,
            'status': plan.status.value,
            'needs_manual_review': False,
            'next_action': '等待自动排程或手动触发排程',
            'rule_traces': rule_traces
        }
        
        return plan, result_context

    def request_insertion(
        self,
        plan_id: str,
        target_position: int,
        justification: str,
        requested_by: str
    ) -> Dict:
        rule_traces = []
        
        plan = self.plan_repo.get_by_id(plan_id)
        if not plan:
            raise ValueError(f'付款计划 {plan_id} 不存在')
        
        if plan.priority == PaymentPriority.URGENT:
            rule_traces.append({
                'rule': 'INSERTION_001',
                'description': '检查是否为紧急优先级',
                'input': {'priority': plan.priority.value},
                'output': '紧急优先级可直接插队，无需审批',
                'passed': True
            })
            
            pending_plans = self.plan_repo.get_pending_scheduling()
            current_position = next(
                (i + 1 for i, p in enumerate(pending_plans) if p.id == plan_id),
                len(pending_plans) + 1
            )
            
            return {
                'plan_id': plan_id,
                'insertion_approved': True,
                'approval_required': False,
                'current_position': current_position,
                'message': '该付款计划为紧急优先级，已自动插队到队列最前端',
                'rule_traces': rule_traces
            }
        
        rule_traces.append({
            'rule': 'INSERTION_001',
            'description': '检查是否为紧急优先级',
            'input': {'priority': plan.priority.value},
            'output': '非紧急优先级，需要走插单审批流程',
            'passed': True
        })
        
        if target_position <= 0:
            rule_traces.append({
                'rule': 'INSERTION_002',
                'description': '校验目标位置有效性',
                'input': {'target_position': target_position},
                'output': '目标位置必须大于0',
                'passed': False
            })
            return {
                'plan_id': plan_id,
                'insertion_approved': False,
                'approval_required': True,
                'error': '目标位置无效',
                'rule_traces': rule_traces
            }
        
        rule_traces.append({
            'rule': 'INSERTION_002',
            'description': '校验目标位置有效性',
            'input': {'target_position': target_position},
            'output': '目标位置有效',
            'passed': True
        })
        
        pending_plans = self.plan_repo.get_pending_scheduling()
        current_position = next(
            (i + 1 for i, p in enumerate(pending_plans) if p.id == plan_id),
            None
        )
        
        if current_position is None:
            rule_traces.append({
                'rule': 'INSERTION_003',
                'description': '检查付款计划是否在待排程队列中',
                'input': {'plan_id': plan_id},
                'output': '该计划不在待排程队列中',
                'passed': False
            })
            return {
                'plan_id': plan_id,
                'insertion_approved': False,
                'approval_required': False,
                'error': '该付款计划不在待排程队列中',
                'rule_traces': rule_traces
            }
        
        if target_position >= current_position:
            rule_traces.append({
                'rule': 'INSERTION_004',
                'description': '检查目标位置是否在当前位置之前',
                'input': {
                    'current_position': current_position,
                    'target_position': target_position
                },
                'output': '目标位置必须在当前位置之前',
                'passed': False
            })
            return {
                'plan_id': plan_id,
                'insertion_approved': False,
                'approval_required': False,
                'error': '插单只能向前插队，不能向后',
                'rule_traces': rule_traces
            }
        
        affected_count = current_position - target_position
        affected_plans = pending_plans[target_position - 1:current_position - 1] if target_position > 1 else pending_plans[:current_position - 1]
        
        rule_traces.append({
            'rule': 'INSERTION_005',
            'description': '计算受影响的付款计划数量',
            'input': {
                'current_position': current_position,
                'target_position': target_position
            },
            'output': f'将影响{affected_count}个付款计划的排程时间',
            'passed': True
        })
        
        return {
            'plan_id': plan_id,
            'insertion_approved': False,
            'approval_required': True,
            'current_position': current_position,
            'target_position': target_position,
            'affected_count': affected_count,
            'affected_plan_ids': [p.id for p in affected_plans],
            'message': f'插单请求已提交，将影响{affected_count}个付款计划，请等待审批',
            'rule_traces': rule_traces
        }
