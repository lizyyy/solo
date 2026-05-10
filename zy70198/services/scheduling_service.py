from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple
from uuid import uuid4

from models import (
    PaymentPlan, PaymentPlanStatus, PaymentPriority,
    Invoice, InvoiceStatus,
    FundCalendarEntry, FundStatus,
    PaymentSchedule, ScheduleRecord, ScheduleStatus
)
from repositories import (
    PaymentPlanRepository, InvoiceRepository, FundRepository,
    ScheduleRepository, NotificationRepository
)


class SchedulingService:
    def __init__(
        self,
        plan_repo: PaymentPlanRepository,
        invoice_repo: InvoiceRepository,
        fund_repo: FundRepository,
        schedule_repo: ScheduleRepository,
        notification_repo: NotificationRepository
    ):
        self.plan_repo = plan_repo
        self.invoice_repo = invoice_repo
        self.fund_repo = fund_repo
        self.schedule_repo = schedule_repo
        self.notification_repo = notification_repo

    def calculate_expected_payment_date(
        self,
        invoice_date: date,
        credit_period_days: int,
        rule_traces: List[Dict]
    ) -> date:
        base_date = invoice_date
        
        rule_traces.append({
            'rule': 'CREDIT_CALC_001',
            'description': '账期计算基准日期：发票开票日期',
            'input': {'invoice_date': invoice_date.isoformat()},
            'output': {'base_date': base_date.isoformat()},
            'passed': True
        })
        
        expected_date = base_date + timedelta(days=credit_period_days)
        
        rule_traces.append({
            'rule': 'CREDIT_CALC_002',
            'description': '期望付款日期 = 发票日期 + 账期天数',
            'input': {
                'base_date': base_date.isoformat(),
                'credit_days': credit_period_days
            },
            'output': expected_date.isoformat(),
            'passed': True
        })
        
        if expected_date.weekday() >= 5:
            days_to_add = 7 - expected_date.weekday()
            expected_date = expected_date + timedelta(days=days_to_add)
            rule_traces.append({
                'rule': 'CREDIT_CALC_003',
                'description': '周末顺延规则：如果期望日期是周末，顺延到下周一',
                'input': {'original_date': (base_date + timedelta(days=credit_period_days)).isoformat()},
                'output': {
                    'adjusted_date': expected_date.isoformat(),
                    'days_postponed': days_to_add
                },
                'passed': True
            })
        
        return expected_date

    def check_invoice_requirements(
        self,
        plan: PaymentPlan,
        rule_traces: List[Dict]
    ) -> Tuple[bool, str]:
        invoices = self.invoice_repo.get_by_plan_id(plan.id)
        
        if not invoices:
            rule_traces.append({
                'rule': 'INVOICE_CHECK_001',
                'description': '检查付款计划是否有关联发票',
                'input': {'plan_id': plan.id, 'invoice_count': 0},
                'output': '未关联任何发票',
                'passed': False
            })
            return False, '付款计划未关联任何发票'
        
        rule_traces.append({
            'rule': 'INVOICE_CHECK_001',
            'description': '检查付款计划是否有关联发票',
            'input': {'plan_id': plan.id, 'invoice_count': len(invoices)},
            'output': f'已关联{len(invoices)}张发票',
            'passed': True
        })
        
        total_invoice_amount = sum(inv.invoice_amount for inv in invoices)
        if total_invoice_amount < plan.total_amount:
            gap = plan.total_amount - total_invoice_amount
            rule_traces.append({
                'rule': 'INVOICE_CHECK_002',
                'description': '检查发票金额是否覆盖计划付款金额',
                'input': {
                    'plan_amount': plan.total_amount,
                    'invoice_amount': total_invoice_amount
                },
                'output': f'发票金额不足，缺口{gap:.2f}元',
                'passed': False
            })
            return False, f'发票金额不足，缺口{gap:.2f}元'
        
        rule_traces.append({
            'rule': 'INVOICE_CHECK_002',
            'description': '检查发票金额是否覆盖计划付款金额',
            'input': {
                'plan_amount': plan.total_amount,
                'invoice_amount': total_invoice_amount
            },
            'output': '发票金额覆盖计划金额',
            'passed': True
        })
        
        verified_invoices = [
            inv for inv in invoices
            if inv.status in [InvoiceStatus.VERIFIED, InvoiceStatus.MATCHED, 
                            InvoiceStatus.PARTIALLY_USED, InvoiceStatus.FULLY_USED]
        ]
        
        if len(verified_invoices) < len(invoices):
            unverified = len(invoices) - len(verified_invoices)
            rule_traces.append({
                'rule': 'INVOICE_CHECK_003',
                'description': '检查发票是否已完成认证',
                'input': {
                    'total_invoices': len(invoices),
                    'verified_count': len(verified_invoices)
                },
                'output': f'{unverified}张发票未认证',
                'passed': False
            })
            return False, f'{unverified}张发票未完成认证'
        
        rule_traces.append({
            'rule': 'INVOICE_CHECK_003',
            'description': '检查发票是否已完成认证',
            'input': {'verified_count': len(verified_invoices)},
            'output': '所有发票均已认证',
            'passed': True
        })
        
        return True, '发票校验通过'

    def find_available_fund_date(
        self,
        plan: PaymentPlan,
        start_date: date,
        amount: float,
        rule_traces: List[Dict],
        max_search_days: int = 90
    ) -> Tuple[Optional[FundCalendarEntry], str]:
        current_date = start_date
        search_count = 0
        
        rule_traces.append({
            'rule': 'FUND_SEARCH_001',
            'description': '资金日历查找起始日期',
            'input': {
                'start_date': start_date.isoformat(),
                'required_amount': amount,
                'max_search_days': max_search_days
            },
            'output': '开始查找可用资金',
            'passed': True
        })
        
        while search_count < max_search_days:
            fund_entry = self.fund_repo.get_by_date(current_date)
            
            if not fund_entry:
                rule_traces.append({
                    'rule': 'FUND_SEARCH_002',
                    'description': '检查当日是否有资金配置',
                    'input': {'check_date': current_date.isoformat()},
                    'output': '当日无资金配置，跳过',
                    'passed': False
                })
                current_date += timedelta(days=1)
                search_count += 1
                continue
            
            if fund_entry.status in [FundStatus.FULLY_USED, FundStatus.LOCKED, FundStatus.CANCELLED]:
                rule_traces.append({
                    'rule': 'FUND_SEARCH_003',
                    'description': '检查资金状态',
                    'input': {
                        'check_date': current_date.isoformat(),
                        'status': fund_entry.status.value
                    },
                    'output': f'资金状态为{fund_entry.status.value}，不可用',
                    'passed': False
                })
                current_date += timedelta(days=search_count + 1)
                search_count += 1
                continue
            
            available = fund_entry.available_fund
            
            if available >= amount:
                rule_traces.append({
                    'rule': 'FUND_SEARCH_004',
                    'description': '检查可用资金是否充足',
                    'input': {
                        'check_date': current_date.isoformat(),
                        'available_fund': available,
                        'required_amount': amount
                    },
                    'output': '可用资金充足',
                    'passed': True
                })
                return fund_entry, f'找到可用资金：{current_date.isoformat()}，可用余额{available:.2f}元'
            
            rule_traces.append({
                'rule': 'FUND_SEARCH_004',
                'description': '检查可用资金是否充足',
                'input': {
                    'check_date': current_date.isoformat(),
                    'available_fund': available,
                    'required_amount': amount
                },
                'output': f'资金不足，缺口{amount - available:.2f}元，继续查找',
                'passed': False
            })
            
            current_date += timedelta(days=1)
            search_count += 1
        
        rule_traces.append({
            'rule': 'FUND_SEARCH_005',
            'description': '资金查找结果',
            'input': {'search_days': search_count},
            'output': f'{max_search_days}天内未找到足够资金',
            'passed': False
        })
        
        return None, f'{max_search_days}天内未找到足够资金，请人工处理'

    def run_scheduling(
        self,
        target_month: str,
        triggered_by: str,
        is_auto_run: bool = False
    ) -> Dict:
        rule_traces = []
        schedule_records: List[ScheduleRecord] = []
        affected_plans: List[PaymentPlan] = []
        delayed_notifications: List[Dict] = []
        
        batch_no = f'SCH-{datetime.now().strftime("%Y%m%d%H%M%S")}'
        
        rule_traces.append({
            'rule': 'SCHEDULE_BATCH_001',
            'description': '排程批次创建',
            'input': {
                'target_month': target_month,
                'triggered_by': triggered_by,
                'is_auto_run': is_auto_run
            },
            'output': {'batch_no': batch_no},
            'passed': True
        })
        
        pending_plans = self.plan_repo.get_pending_scheduling()
        urgent_plans = [p for p in pending_plans if p.priority == PaymentPriority.URGENT]
        high_plans = [p for p in pending_plans if p.priority == PaymentPriority.HIGH]
        normal_plans = [p for p in pending_plans if p.priority == PaymentPriority.NORMAL]
        
        sorted_plans = urgent_plans + high_plans + normal_plans
        
        rule_traces.append({
            'rule': 'SCHEDULE_BATCH_002',
            'description': '付款计划优先级排序',
            'input': {
                'total_pending': len(pending_plans),
                'urgent_count': len(urgent_plans),
                'high_count': len(high_plans),
                'normal_count': len(normal_plans)
            },
            'output': '排序规则：紧急 > 高 > 普通，同优先级按创建时间',
            'passed': True
        })
        
        total_planned_amount = 0.0
        
        for plan in sorted_plans:
            plan_traces: List[Dict] = []
            plan_result = self._schedule_single_plan(plan, plan_traces)
            
            rule_traces.extend(plan_traces)
            
            if plan_result['success']:
                schedule_record = ScheduleRecord(
                    id=f'SR-{str(uuid4())[:8].upper()}',
                    payment_plan_id=plan.id,
                    original_payment_date=plan_result['original_date'],
                    new_payment_date=plan_result['scheduled_date'],
                    schedule_amount=plan.total_amount,
                    reason=plan_result['reason'],
                    adjustment_type=plan_result.get('adjustment_type'),
                    fund_calendar_entry_id=plan_result['fund_entry_id'],
                    status=ScheduleStatus.CONFIRMED,
                    created_by=triggered_by
                )
                schedule_records.append(schedule_record)
                
                plan.current_payment_date = plan_result['scheduled_date']
                plan.status = PaymentPlanStatus.SCHEDULED
                plan.mark_updated()
                affected_plans.append(plan)
                
                total_planned_amount += plan.total_amount
                
                if plan_result['is_delayed']:
                    delayed_notifications.append({
                        'plan_id': plan.id,
                        'original_date': plan_result['original_date'],
                        'new_date': plan_result['scheduled_date'],
                        'delay_days': plan_result['delay_days'],
                        'reason': plan_result['reason']
                    })
            else:
                plan.status = PaymentPlanStatus.MANUAL_REVIEW
                plan.remark = plan_result['error_message']
                plan.mark_updated()
                affected_plans.append(plan)
        
        for record in schedule_records:
            self.schedule_repo.save_record(record)
            
            if record.fund_calendar_entry_id:
                fund_entry = self.fund_repo.get_entry_by_id(record.fund_calendar_entry_id)
                if fund_entry:
                    fund_entry.reserved_fund += record.schedule_amount
                    if fund_entry.available_fund <= 0:
                        fund_entry.status = FundStatus.FULLY_USED
                    else:
                        fund_entry.status = FundStatus.PARTIALLY_USED
                    fund_entry.mark_updated()
                    self.fund_repo.save_entry(fund_entry)
        
        for plan in affected_plans:
            self.plan_repo.save(plan)
        
        payment_schedule = PaymentSchedule(
            id=f'PS-{str(uuid4())[:8].upper()}',
            batch_no=batch_no,
            schedule_date=date.today(),
            target_month=target_month,
            total_planned_amount=total_planned_amount,
            affected_plan_count=len(affected_plans),
            is_auto_run=is_auto_run,
            trigger_source='auto' if is_auto_run else 'manual',
            created_by=triggered_by
        )
        self.schedule_repo.save_schedule(payment_schedule)
        
        return {
            'batch_no': batch_no,
            'schedule_id': payment_schedule.id,
            'total_planned_amount': total_planned_amount,
            'scheduled_count': len([p for p in affected_plans if p.status == PaymentPlanStatus.SCHEDULED]),
            'manual_review_count': len([p for p in affected_plans if p.status == PaymentPlanStatus.MANUAL_REVIEW]),
            'delayed_count': len(delayed_notifications),
            'delayed_notifications': delayed_notifications,
            'rule_traces': rule_traces,
            'message': f'排程完成：成功排程{len([p for p in affected_plans if p.status == PaymentPlanStatus.SCHEDULED])}笔，{len(delayed_notifications)}笔需要延后通知'
        }

    def _schedule_single_plan(
        self,
        plan: PaymentPlan,
        rule_traces: List[Dict]
    ) -> Dict:
        invoices = self.invoice_repo.get_by_plan_id(plan.id)
        
        if not invoices:
            rule_traces.append({
                'rule': 'PLAN_SCHEDULE_001',
                'description': '检查付款计划关联发票',
                'input': {'plan_id': plan.id},
                'output': '未关联发票',
                'passed': False
            })
            return {
                'success': False,
                'error_message': '付款计划未关联发票，无法排程'
            }
        
        invoice_passed, invoice_msg = self.check_invoice_requirements(plan, rule_traces)
        if not invoice_passed:
            return {
                'success': False,
                'error_message': invoice_msg
            }
        
        latest_invoice = max(invoices, key=lambda inv: inv.invoice_date)
        expected_date = self.calculate_expected_payment_date(
            latest_invoice.invoice_date,
            plan.credit_period_days,
            rule_traces
        )
        
        rule_traces.append({
            'rule': 'PLAN_SCHEDULE_002',
            'description': '期望付款日期确定',
            'input': {
                'invoice_date': latest_invoice.invoice_date.isoformat(),
                'credit_days': plan.credit_period_days
            },
            'output': expected_date.isoformat(),
            'passed': True
        })
        
        fund_entry, fund_msg = self.find_available_fund_date(
            plan, expected_date, plan.total_amount, rule_traces
        )
        
        if not fund_entry:
            rule_traces.append({
                'rule': 'PLAN_SCHEDULE_003',
                'description': '资金查找结果',
                'input': {'expected_date': expected_date.isoformat()},
                'output': fund_msg,
                'passed': False
            })
            return {
                'success': False,
                'error_message': fund_msg
            }
        
        scheduled_date = fund_entry.calendar_date
        is_delayed = scheduled_date > expected_date
        delay_days = (scheduled_date - expected_date).days if is_delayed else 0
        
        if is_delayed:
            rule_traces.append({
                'rule': 'PLAN_SCHEDULE_004',
                'description': '付款日期延后判断',
                'input': {
                    'expected_date': expected_date.isoformat(),
                    'scheduled_date': scheduled_date.isoformat()
                },
                'output': f'需延后{delay_days}天，原因：资金不足',
                'passed': True,
                'is_warning': True
            })
        
        return {
            'success': True,
            'original_date': expected_date,
            'scheduled_date': scheduled_date,
            'fund_entry_id': fund_entry.id,
            'is_delayed': is_delayed,
            'delay_days': delay_days,
            'reason': '按账期和资金日历排程' if not is_delayed else f'资金不足，延后{delay_days}天',
            'adjustment_type': 'fund_shortage' if is_delayed else None
        }

    def handle_insertion_approved(
        self,
        plan_id: str,
        target_position: int,
        approved_by: str
    ) -> Dict:
        rule_traces = []
        
        plan = self.plan_repo.get_by_id(plan_id)
        if not plan:
            raise ValueError(f'付款计划 {plan_id} 不存在')
        
        pending_plans = self.plan_repo.get_pending_scheduling()
        current_position = next(
            (i + 1 for i, p in enumerate(pending_plans) if p.id == plan_id),
            None
        )
        
        if current_position is None:
            return {
                'success': False,
                'error': '付款计划不在待排程队列中'
            }
        
        if target_position >= current_position:
            return {
                'success': False,
                'error': '目标位置必须在当前位置之前'
            }
        
        affected_plans = pending_plans[target_position - 1:current_position - 1] if target_position > 1 else pending_plans[:current_position - 1]
        
        rule_traces.append({
            'rule': 'INSERTION_EXEC_001',
            'description': '插单执行',
            'input': {
                'plan_id': plan_id,
                'from_position': current_position,
                'to_position': target_position,
                'affected_count': len(affected_plans)
            },
            'output': f'将影响{len(affected_plans)}个付款计划',
            'passed': True
        })
        
        if plan.current_payment_date:
            for affected_plan in affected_plans:
                if affected_plan.current_payment_date and affected_plan.current_payment_date < plan.current_payment_date:
                    record = ScheduleRecord(
                        id=f'SR-{str(uuid4())[:8].upper()}',
                        payment_plan_id=affected_plan.id,
                        original_payment_date=affected_plan.current_payment_date,
                        new_payment_date=affected_plan.current_payment_date,
                        schedule_amount=affected_plan.total_amount,
                        reason=f'插单影响：{plan.vendor_name}的付款计划插队',
                        adjustment_type='insertion',
                        status=ScheduleStatus.ADJUSTED,
                        created_by=approved_by
                    )
                    self.schedule_repo.save_record(record)
        
        plan.is_insertion = True
        plan.mark_updated()
        self.plan_repo.save(plan)
        
        return {
            'success': True,
            'plan_id': plan_id,
            'new_position': target_position,
            'affected_plan_count': len(affected_plans),
            'affected_plan_ids': [p.id for p in affected_plans],
            'message': f'插单成功，该付款计划已排到第{target_position}位，影响了{len(affected_plans)}笔计划',
            'rule_traces': rule_traces
        }
