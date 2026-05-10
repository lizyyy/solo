from datetime import date, datetime, timedelta
from typing import Dict, List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse

from models import (
    PaymentPlan, PaymentPlanStatus, PaymentPriority,
    Invoice, InvoiceStatus,
    FundCalendar, FundCalendarEntry, FundStatus,
    PaymentSchedule, ScheduleRecord, ScheduleStatus,
    InsertionApproval, ApprovalStatus,
    DelayNotification, NotificationStatus
)
from repositories import (
    PaymentPlanRepository, InvoiceRepository, FundRepository,
    ScheduleRepository, ApprovalRepository, NotificationRepository
)
from services import (
    PaymentPlanService, InvoiceService, SchedulingService,
    ApprovalService, NotificationService, FundService
)
from api import (
    CreatePaymentPlanRequest, SubmitForSchedulingRequest,
    InsertionRequest, InsertionApprovalRequest,
    CreateInvoiceRequest, MatchInvoiceRequest,
    CreateFundCalendarRequest, AddFundEntryRequest,
    RunSchedulingRequest,
    BusinessResponse, RuleTrace,
    ScheduleReportRequest
)


plan_repo = PaymentPlanRepository()
invoice_repo = InvoiceRepository()
fund_repo = FundRepository()
schedule_repo = ScheduleRepository()
approval_repo = ApprovalRepository()
notification_repo = NotificationRepository()

plan_service = PaymentPlanService(plan_repo, invoice_repo, schedule_repo)
invoice_service = InvoiceService(invoice_repo, plan_repo)
fund_service = FundService(fund_repo)
scheduling_service = SchedulingService(plan_repo, invoice_repo, fund_repo, schedule_repo, notification_repo)
approval_service = ApprovalService(approval_repo, plan_repo)
notification_service = NotificationService(notification_repo, plan_repo)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title='采购付款排程 API',
    description='用于管理采购付款计划、发票匹配、资金日历和自动排程的后端服务',
    version='1.0.0',
    lifespan=lifespan
)


def to_business_response(result: Dict, code_prefix: str = '001') -> BusinessResponse:
    success = result.get('success', True)
    if 'needs_manual_review' in result:
        success = not result['needs_manual_review']
    
    code = f'{code_prefix}_{"000" if success else "999"}'
    
    return BusinessResponse(
        success=success,
        code=code,
        message=result.get('message', '操作完成' if success else '操作失败'),
        data={k: v for k, v in result.items() 
              if k not in ['success', 'message', 'needs_manual_review', 'review_reason', 'next_action', 'rule_traces']},
        needs_manual_review=result.get('needs_manual_review', False),
        review_reason=result.get('review_reason'),
        next_action=result.get('next_action'),
        rule_traces=[RuleTrace(**trace) for trace in result.get('rule_traces', [])]
    )


@app.post('/api/payment-plans', response_model=BusinessResponse, summary='创建付款计划')
async def create_payment_plan(request: CreatePaymentPlanRequest):
    """
    创建新的付款计划，这是整个排程流程的入口。
    
    业务规则：
    - 付款计划ID自动生成：PP-YYYYMMDD-XXXXXX
    - 期望付款日期：如果不指定，则按 发票日期 + 账期天数 自动计算
    - 初始状态为草稿，需要关联发票后才能提交排程
    """
    try:
        plan, result = plan_service.create_payment_plan(
            purchase_order_id=request.purchase_order_id,
            vendor_id=request.vendor_id,
            vendor_name=request.vendor_name,
            contract_payment_terms=request.contract_payment_terms,
            credit_period_days=request.credit_period_days,
            total_amount=request.total_amount,
            created_by=request.created_by,
            priority=request.priority,
            expected_payment_date=request.expected_payment_date,
            remark=request.remark
        )
        response = to_business_response(result, 'PLAN')
        response.data['plan'] = plan.model_dump()
        return response
    except ValueError as e:
        return BusinessResponse(
            success=False,
            code='PLAN_999',
            message=f'创建付款计划失败：{str(e)}'
        )


@app.post('/api/payment-plans/{plan_id}/submit', response_model=BusinessResponse, summary='提交付款计划进入排程')
async def submit_for_scheduling(plan_id: str, request: SubmitForSchedulingRequest):
    """
    将草稿状态的付款计划提交到排程队列。
    
    提交前校验：
    1. 状态必须为草稿
    2. 必须有关联的发票
    3. 发票总金额必须 >= 计划付款金额
    4. 所有发票必须已完成认证
    
    校验不通过时，付款计划将转入人工复核状态。
    """
    try:
        if plan_id != request.plan_id:
            raise ValueError('URL中的计划ID与请求体中的计划ID不一致')
        
        plan, result = plan_service.submit_for_scheduling(
            plan_id=plan_id,
            submitted_by=request.submitted_by
        )
        response = to_business_response(result, 'SUBMIT')
        response.data['plan'] = plan.model_dump()
        return response
    except ValueError as e:
        return BusinessResponse(
            success=False,
            code='SUBMIT_999',
            message=f'提交排程失败：{str(e)}'
        )


@app.get('/api/payment-plans/pending', summary='获取待排程队列')
async def get_pending_scheduling():
    """
    获取当前待排程队列，按优先级排序：
    1. 紧急 (URGENT)
    2. 高 (HIGH)
    3. 普通 (NORMAL)
    
    同优先级按创建时间升序排列。
    """
    plans = plan_repo.get_pending_scheduling()
    
    return BusinessResponse(
        success=True,
        code='QUEUE_000',
        message=f'当前待排程队列共有{len(plans)}笔付款计划',
        data={
            'queue': [
                {
                    'position': idx + 1,
                    'plan_id': p.id,
                    'vendor_name': p.vendor_name,
                    'amount': p.total_amount,
                    'priority': p.priority.value,
                    'expected_date': p.expected_payment_date.isoformat() if p.expected_payment_date else None,
                    'is_insertion': p.is_insertion
                }
                for idx, p in enumerate(plans)
            ],
            'total_count': len(plans)
        }
    )


@app.post('/api/payment-plans/{plan_id}/insertion-request', response_model=BusinessResponse, summary='申请插单')
async def request_insertion(plan_id: str, request: InsertionRequest):
    """
    申请将某个付款计划插队到队列前面。
    
    规则：
    - 紧急优先级计划可直接插队，无需审批
    - 非紧急优先级需要走插单审批流程
    - 只能向前插队，不能向后
    - 会影响目标位置到原位置之间的所有计划
    """
    try:
        if plan_id != request.plan_id:
            raise ValueError('URL中的计划ID与请求体中的计划ID不一致')
        
        result = plan_service.request_insertion(
            plan_id=plan_id,
            target_position=request.target_position,
            justification=request.justification,
            requested_by=request.requested_by
        )
        
        if result.get('approval_required') and not result.get('insertion_approved'):
            approval_result = approval_service.create_insertion_approval(
                plan_id=plan_id,
                current_position=result['current_position'],
                target_position=request.target_position,
                justification=request.justification,
                requester=request.requested_by,
                impact_analysis=f'将影响{result["affected_count"]}个付款计划'
            )
            result['approval_id'] = approval_result.get('approval_id')
        
        response = to_business_response(result, 'INSERT')
        return response
    except ValueError as e:
        return BusinessResponse(
            success=False,
            code='INSERT_999',
            message=f'插单申请失败：{str(e)}'
        )


@app.post('/api/approvals/{approval_id}/approve', response_model=BusinessResponse, summary='审批通过插单')
async def approve_insertion(approval_id: str, request: InsertionApprovalRequest):
    """
    审批通过插单申请。
    
    审批通过后：
    1. 付款计划标记为插单
    2. 受影响的计划生成调整记录
    3. 需要重新跑一次排程以更新付款日期
    """
    try:
        if approval_id != request.approval_id:
            raise ValueError('URL中的审批ID与请求体中的审批ID不一致')
        
        result = approval_service.approve_insertion(
            approval_id=approval_id,
            approver=request.approver,
            comment=request.comment
        )
        
        if result.get('needs_scheduling_refresh'):
            approval = approval_repo.get_by_id(approval_id)
            if approval:
                scheduling_service.handle_insertion_approved(
                    plan_id=approval.payment_plan_id,
                    target_position=approval.requested_queue_position,
                    approved_by=request.approver
                )
        
        return to_business_response(result, 'APPR')
    except ValueError as e:
        return BusinessResponse(
            success=False,
            code='APPR_999',
            message=f'审批失败：{str(e)}'
        )


@app.post('/api/approvals/{approval_id}/reject', response_model=BusinessResponse, summary='驳回插单申请')
async def reject_insertion(approval_id: str, request: InsertionApprovalRequest):
    """
    驳回插单申请，必须提供驳回理由。
    """
    try:
        if approval_id != request.approval_id:
            raise ValueError('URL中的审批ID与请求体中的审批ID不一致')
        
        if not request.rejection_reason:
            raise ValueError('驳回时必须提供驳回理由')
        
        result = approval_service.reject_insertion(
            approval_id=approval_id,
            approver=request.approver,
            rejection_reason=request.rejection_reason
        )
        return to_business_response(result, 'REJECT')
    except ValueError as e:
        return BusinessResponse(
            success=False,
            code='REJECT_999',
            message=f'驳回失败：{str(e)}'
        )


@app.get('/api/approvals/pending', summary='获取待审批的插单申请')
async def get_pending_approvals():
    """
    获取所有待审批的插单申请列表。
    """
    approvals = approval_service.get_pending_approvals()
    
    return BusinessResponse(
        success=True,
        code='APPR_LIST_000',
        message=f'共有{len(approvals)}笔插单申请待审批',
        data={
            'approvals': approvals,
            'total_count': len(approvals)
        }
    )


@app.post('/api/invoices', response_model=BusinessResponse, summary='创建发票')
async def create_invoice(request: CreateInvoiceRequest):
    """
    创建新发票。
    
    发票生命周期：
    1. 待收票 (pending_received) - 刚创建
    2. 已收票 (received) - 录入收到日期
    3. 已认证 (verified) - 完成发票认证
    4. 已匹配 (matched) - 匹配到付款计划
    5. 已使用 (partially_used/fully_used) - 付款完成
    """
    try:
        invoice, result = invoice_service.create_invoice(
            invoice_no=request.invoice_no,
            vendor_id=request.vendor_id,
            purchase_order_id=request.purchase_order_id,
            invoice_date=request.invoice_date,
            invoice_amount=request.invoice_amount,
            tax_amount=request.tax_amount,
            invoice_code=request.invoice_code
        )
        response = to_business_response(result, 'INV')
        response.data['invoice'] = invoice.model_dump()
        return response
    except ValueError as e:
        return BusinessResponse(
            success=False,
            code='INV_999',
            message=f'创建发票失败：{str(e)}'
        )


@app.post('/api/invoices/{invoice_id}/match', response_model=BusinessResponse, summary='匹配发票到付款计划')
async def match_invoice(invoice_id: str, request: MatchInvoiceRequest):
    """
    将发票匹配到付款计划。
    
    匹配规则：
    1. 发票必须已完成认证
    2. 发票供应商必须与付款计划供应商一致
    3. 发票采购订单必须与付款计划采购订单一致（跨订单需人工复核）
    4. 发票不能已匹配到其他付款计划
    
    匹配成功后，发票状态变为已匹配。
    """
    try:
        if invoice_id != request.invoice_id:
            raise ValueError('URL中的发票ID与请求体中的发票ID不一致')
        
        result = invoice_service.match_to_plan(
            invoice_id=invoice_id,
            payment_plan_id=request.payment_plan_id,
            operator=request.operator
        )
        return to_business_response(result, 'MATCH')
    except ValueError as e:
        return BusinessResponse(
            success=False,
            code='MATCH_999',
            message=f'发票匹配失败：{str(e)}'
        )


@app.post('/api/fund-calendars', response_model=BusinessResponse, summary='创建资金日历')
async def create_fund_calendar(request: CreateFundCalendarRequest):
    """
    创建新财年的资金日历。
    
    每个财年只能有一个激活的资金日历。
    """
    try:
        calendar, result = fund_service.create_calendar(
            name=request.name,
            fiscal_year=request.fiscal_year,
            created_by=request.created_by
        )
        response = to_business_response(result, 'FC')
        response.data['calendar'] = calendar.model_dump()
        return response
    except ValueError as e:
        return BusinessResponse(
            success=False,
            code='FC_999',
            message=f'创建资金日历失败：{str(e)}'
        )


@app.post('/api/fund-calendars/{calendar_id}/entries', response_model=BusinessResponse, summary='添加资金日历条目')
async def add_fund_entry(calendar_id: str, request: AddFundEntryRequest):
    """
    为指定日期配置可用资金额度。
    
    这是排程时查找可用资金的依据。
    """
    try:
        if calendar_id != request.calendar_id:
            raise ValueError('URL中的日历ID与请求体中的日历ID不一致')
        
        entry, result = fund_service.add_fund_entry(
            calendar_id=calendar_id,
            entry_date=request.entry_date,
            total_fund=request.total_fund,
            operator=request.operator,
            remark=request.remark
        )
        response = to_business_response(result, 'FE')
        response.data['entry'] = entry.model_dump()
        return response
    except ValueError as e:
        return BusinessResponse(
            success=False,
            code='FE_999',
            message=f'添加资金条目失败：{str(e)}'
        )


@app.get('/api/fund-calendars/check', summary='检查指定日期的资金可用性')
async def check_fund_availability(
    check_date: date = Query(..., description='要检查的日期'),
    required_amount: float = Query(..., gt=0, description='需要的资金金额')
):
    """
    检查指定日期是否有足够的可用资金。
    
    返回资金充足/不足的判断，以及缺口金额。
    """
    result = fund_service.check_fund_availability(check_date, required_amount)
    return to_business_response(result, 'FUND_CHECK')


@app.post('/api/scheduling/run', response_model=BusinessResponse, summary='执行排程')
async def run_scheduling(request: RunSchedulingRequest):
    """
    执行付款排程计算。
    
    排程流程：
    1. 获取所有待排程的付款计划（按优先级排序）
    2. 对每个计划：
       a. 校验发票（存在、金额覆盖、已认证）
       b. 计算期望付款日期（发票日期 + 账期天数，周末顺延）
       c. 从期望日期开始查找可用资金
       d. 如果资金不足，向后顺延直到找到足够资金
    3. 生成排程记录，更新付款计划状态
    4. 对需要延后的，生成延后通知
    
    排程失败的付款计划将转入人工复核状态。
    """
    try:
        result = scheduling_service.run_scheduling(
            target_month=request.target_month,
            triggered_by=request.triggered_by,
            is_auto_run=request.is_auto_run
        )
        
        for delay_info in result.get('delayed_notifications', []):
            plan = plan_repo.get_by_id(delay_info['plan_id'])
            if plan:
                notification_service.create_delay_notification(
                    plan_id=delay_info['plan_id'],
                    original_date=delay_info['original_date'],
                    new_date=delay_info['new_date'],
                    delay_reason=delay_info['reason'],
                    notify_to=f'采购负责人-{plan.vendor_name}'
                )
        
        response = to_business_response(result, 'SCHEDULE')
        response.success = True
        response.code = 'SCHEDULE_000'
        return response
    except Exception as e:
        return BusinessResponse(
            success=False,
            code='SCHEDULE_999',
            message=f'排程执行失败：{str(e)}'
        )


@app.get('/api/scheduling/queue', summary='获取当前排程队列')
async def get_schedule_queue(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
):
    """
    获取已排程的付款计划队列。
    
    可按日期范围筛选。
    """
    if not start_date:
        start_date = date.today()
    if not end_date:
        end_date = start_date + timedelta(days=30)
    
    all_plans = plan_repo.get_all()
    scheduled_plans = [
        p for p in all_plans
        if p.status in [PaymentPlanStatus.SCHEDULED, PaymentPlanStatus.PARTIALLY_PAID]
        and p.current_payment_date
        and start_date <= p.current_payment_date <= end_date
    ]
    
    sorted_plans = sorted(scheduled_plans, key=lambda p: (p.current_payment_date, p.priority))
    
    return BusinessResponse(
        success=True,
        code='QUEUE_SCHED_000',
        message=f'{start_date.isoformat()} 至 {end_date.isoformat()} 共有{len(sorted_plans)}笔已排程付款计划',
        data={
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'plans': [
                {
                    'plan_id': p.id,
                    'vendor_name': p.vendor_name,
                    'amount': p.total_amount,
                    'payment_date': p.current_payment_date.isoformat() if p.current_payment_date else None,
                    'priority': p.priority.value,
                    'status': p.status.value,
                    'is_insertion': p.is_insertion
                }
                for p in sorted_plans
            ],
            'total_count': len(sorted_plans),
            'total_amount': sum(p.total_amount for p in sorted_plans)
        }
    )


@app.post('/api/notifications/{notification_id}/send', response_model=BusinessResponse, summary='发送延后通知')
async def send_notification(notification_id: str):
    """
    发送延后通知给供应商或采购负责人。
    
    通知状态流转：
    pending -> sent -> acknowledged
             -> failed (可重试)
    """
    try:
        result = notification_service.send_notification(notification_id)
        return to_business_response(result, 'NOTI_SEND')
    except ValueError as e:
        return BusinessResponse(
            success=False,
            code='NOTI_SEND_999',
            message=f'发送通知失败：{str(e)}'
        )


@app.get('/api/notifications/pending', summary='获取待发送的延后通知')
async def get_pending_notifications():
    """
    获取所有待发送的延后通知。
    """
    notifications = notification_service.get_pending_notifications()
    
    return BusinessResponse(
        success=True,
        code='NOTI_LIST_000',
        message=f'共有{len(notifications)}笔延后通知待发送',
        data={
            'notifications': notifications,
            'total_count': len(notifications)
        }
    )


@app.get('/api/reviews/manual', summary='获取需要人工复核的付款计划')
async def get_manual_review_plans():
    """
    获取所有转入人工复核状态的付款计划。
    
    这些计划因为规则校验失败而无法自动排程，需要人工处理。
    """
    plans = plan_repo.get_manual_review_plans()
    
    return BusinessResponse(
        success=True,
        code='REVIEW_000',
        message=f'共有{len(plans)}笔付款计划需要人工复核',
        data={
            'plans': [
                {
                    'plan_id': p.id,
                    'vendor_name': p.vendor_name,
                    'amount': p.total_amount,
                    'status': p.status.value,
                    'review_reason': p.remark,
                    'created_at': p.created_at.isoformat()
                }
                for p in plans
            ],
            'total_count': len(plans)
        }
    )


@app.post('/api/reports/schedule', summary='生成排程报表')
async def generate_schedule_report(request: ScheduleReportRequest):
    """
    生成指定日期范围的排程报表。
    
    报表内容：
    - 每日计划付款金额和笔数
    - 资金使用情况
    - 插单记录
    - 延后记录
    - 人工复核记录
    """
    plans_in_range = [
        p for p in plan_repo.get_all()
        if p.current_payment_date
        and request.start_date <= p.current_payment_date <= request.end_date
    ]
    
    schedules_in_range = schedule_repo.get_all_records()
    
    delayed_notifications = [
        n for n in notification_repo.get_all()
        if request.start_date <= n.new_payment_date <= request.end_date
    ]
    
    insertions = [
        p for p in plans_in_range if p.is_insertion
    ]
    
    manual_reviews = [
        p for p in plan_repo.get_manual_review_plans()
        if request.start_date <= p.created_at.date() <= request.end_date
    ]
    
    daily_summary: Dict[str, Dict] = {}
    for p in plans_in_range:
        if not p.current_payment_date:
            continue
        date_key = p.current_payment_date.isoformat()
        if date_key not in daily_summary:
            daily_summary[date_key] = {
                'date': date_key,
                'total_amount': 0,
                'plan_count': 0,
                'insertion_count': 0,
                'vendors': []
            }
        daily_summary[date_key]['total_amount'] += p.total_amount
        daily_summary[date_key]['plan_count'] += 1
        if p.is_insertion:
            daily_summary[date_key]['insertion_count'] += 1
        if p.vendor_name not in daily_summary[date_key]['vendors']:
            daily_summary[date_key]['vendors'].append(p.vendor_name)
    
    return BusinessResponse(
        success=True,
        code='REPORT_000',
        message=f'排程报表已生成：{request.start_date.isoformat()} 至 {request.end_date.isoformat()}',
        data={
            'period': {
                'start_date': request.start_date.isoformat(),
                'end_date': request.end_date.isoformat()
            },
            'summary': {
                'total_planned_amount': sum(p.total_amount for p in plans_in_range),
                'total_plan_count': len(plans_in_range),
                'insertion_count': len(insertions),
                'delay_count': len(delayed_notifications),
                'manual_review_count': len(manual_reviews)
            },
            'daily_summary': list(daily_summary.values()),
            'insertions': [
                {
                    'plan_id': p.id,
                    'vendor_name': p.vendor_name,
                    'amount': p.total_amount,
                    'payment_date': p.current_payment_date.isoformat() if p.current_payment_date else None
                }
                for p in insertions
            ],
            'delays': [
                {
                    'plan_id': n.payment_plan_id,
                    'original_date': n.original_payment_date.isoformat(),
                    'new_date': n.new_payment_date.isoformat(),
                    'delay_days': n.delay_days,
                    'reason': n.delay_reason
                }
                for n in delayed_notifications
            ],
            'manual_reviews': [
                {
                    'plan_id': p.id,
                    'vendor_name': p.vendor_name,
                    'amount': p.total_amount,
                    'reason': p.remark
                }
                for p in manual_reviews
            ]
        }
    )


@app.get('/api/payment-plans/{plan_id}/rule-traces', summary='查询付款计划的规则执行轨迹')
async def get_plan_rule_traces(plan_id: str):
    """
    查询指定付款计划的所有规则执行轨迹，用于追溯和复查。
    
    这是实现"后台规则可复查"的关键接口。
    """
    plan = plan_repo.get_by_id(plan_id)
    if not plan:
        return BusinessResponse(
            success=False,
            code='TRACE_999',
            message=f'付款计划 {plan_id} 不存在'
        )
    
    records = schedule_repo.get_records_by_plan(plan_id)
    
    return BusinessResponse(
        success=True,
        code='TRACE_000',
        message=f'已获取付款计划 {plan_id} 的规则轨迹',
        data={
            'plan_id': plan_id,
            'plan_status': plan.status.value,
            'schedule_records': [
                {
                    'record_id': r.id,
                    'original_date': r.original_payment_date.isoformat(),
                    'new_date': r.new_payment_date.isoformat() if r.new_payment_date else None,
                    'amount': r.schedule_amount,
                    'reason': r.reason,
                    'adjustment_type': r.adjustment_type,
                    'status': r.status.value,
                    'created_at': r.created_at.isoformat()
                }
                for r in records
            ],
            'record_count': len(records)
        }
    )


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)
