"""
采购付款排程系统使用示例

演示完整的业务流程：
1. 创建资金日历
2. 创建付款计划
3. 创建并匹配发票
4. 提交排程
5. 执行排程
6. 查看结果
"""

from datetime import date, datetime, timedelta
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import PaymentPriority
from repositories import (
    PaymentPlanRepository, InvoiceRepository, FundRepository,
    ScheduleRepository, ApprovalRepository, NotificationRepository
)
from services import (
    PaymentPlanService, InvoiceService, FundService,
    SchedulingService, ApprovalService, NotificationService
)
from tasks import SchedulerTask, NotificationTask, ReportTask


def main():
    print('=' * 60)
    print('采购付款排程系统 - 使用示例')
    print('=' * 60)
    print()
    
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
    
    scheduler_task = SchedulerTask(plan_repo, invoice_repo, fund_repo, schedule_repo, notification_repo)
    notification_task = NotificationTask(notification_repo, plan_repo)
    report_task = ReportTask(plan_repo, fund_repo, schedule_repo, notification_repo)
    
    print('【步骤1】创建2026财年资金日历')
    calendar, result = fund_service.create_calendar(
        name='2026财年资金计划',
        fiscal_year=2026,
        created_by='财务主管'
    )
    print(f'  资金日历ID: {calendar.id}')
    print(f'  状态: {result["success"] and "成功" or "失败"}')
    print()
    
    print('【步骤2】配置5月份资金额度')
    today = date.today()
    fund_entries = []
    for i in range(3):
        entry_date = today + timedelta(days=i)
        entry, entry_result = fund_service.add_fund_entry(
            calendar_id=calendar.id,
            entry_date=entry_date,
            total_fund=500000.00,
            operator='财务主管',
            remark=f'{entry_date.isoformat()} 日常付款资金'
        )
        fund_entries.append(entry)
        print(f'  {entry_date.isoformat()}: 配置 500,000.00 元')
    print()
    
    print('【步骤3】创建3个付款计划')
    plans = []
    
    plan1, result1 = plan_service.create_payment_plan(
        purchase_order_id='PO-2026-001',
        vendor_id='V-001',
        vendor_name='华为技术有限公司',
        contract_payment_terms='货到验收后30天付款',
        credit_period_days=30,
        total_amount=100000.00,
        created_by='采购专员A',
        priority=PaymentPriority.NORMAL
    )
    plans.append(plan1)
    print(f'  计划1: {plan1.vendor_name} - ¥{plan1.total_amount:,.2f} (普通优先级)')
    
    plan2, result2 = plan_service.create_payment_plan(
        purchase_order_id='PO-2026-002',
        vendor_id='V-002',
        vendor_name='阿里巴巴集团',
        contract_payment_terms='月结60天',
        credit_period_days=60,
        total_amount=200000.00,
        created_by='采购专员B',
        priority=PaymentPriority.HIGH
    )
    plans.append(plan2)
    print(f'  计划2: {plan2.vendor_name} - ¥{plan2.total_amount:,.2f} (高优先级)')
    
    plan3, result3 = plan_service.create_payment_plan(
        purchase_order_id='PO-2026-003',
        vendor_id='V-003',
        vendor_name='腾讯科技',
        contract_payment_terms='预付款',
        credit_period_days=0,
        total_amount=50000.00,
        created_by='采购经理',
        priority=PaymentPriority.URGENT
    )
    plans.append(plan3)
    print(f'  计划3: {plan3.vendor_name} - ¥{plan3.total_amount:,.2f} (紧急优先级)')
    print()
    
    print('【步骤4】为每个付款计划创建并匹配发票')
    for idx, plan in enumerate(plans, 1):
        invoice_no = f'INV-{datetime.now().strftime("%Y%m%d")}-{idx:03d}'
        invoice_date = date.today()
        
        invoice, inv_result = invoice_service.create_invoice(
            invoice_no=invoice_no,
            vendor_id=plan.vendor_id,
            purchase_order_id=plan.purchase_order_id,
            invoice_date=invoice_date,
            invoice_amount=plan.total_amount * 1.06,
            tax_amount=plan.total_amount * 0.06
        )
        print(f'  计划{idx} - 创建发票: {invoice_no} (¥{invoice.invoice_amount:,.2f})')
        
        invoice.status = 'verified'
        invoice.verified_date = invoice_date
        invoice.mark_updated()
        invoice_repo.save(invoice)
        print(f'    → 发票已认证')
        
        match_result = invoice_service.match_to_plan(
            invoice_id=invoice.id,
            payment_plan_id=plan.id,
            operator='财务专员'
        )
        print(f'    → 发票匹配: {match_result["success"] and "成功" or "失败"}')
    print()
    
    print('【步骤5】提交付款计划进入排程队列')
    for idx, plan in enumerate(plans, 1):
        updated_plan, submit_result = plan_service.submit_for_scheduling(
            plan_id=plan.id,
            submitted_by='采购专员'
        )
        status = submit_result.get('needs_manual_review', False)
        print(f'  计划{idx} ({plan.vendor_name}):')
        print(f'    状态: {updated_plan.status.value}')
        if status:
            print(f'    ⚠️ 需要人工复核: {submit_result.get("review_reason")}')
        else:
            print(f'    ✅ 已进入待排程队列')
    print()
    
    print('【步骤6】查看当前待排程队列')
    pending_plans = plan_repo.get_pending_scheduling()
    print(f'  待排程队列共有 {len(pending_plans)} 笔计划:')
    for idx, p in enumerate(pending_plans, 1):
        priority_label = {
            'urgent': '🔴 紧急',
            'high': '🟡 高',
            'normal': '🟢 普通'
        }.get(p.priority.value, p.priority.value)
        print(f'    {idx}. {priority_label} - {p.vendor_name} (¥{p.total_amount:,.2f})')
    print()
    
    print('【步骤7】执行自动排程任务')
    target_month = today.strftime('%Y-%m')
    schedule_result = scheduler_task.run(target_month=target_month)
    print(f'  任务ID: {schedule_result["task_id"]}')
    print(f'  状态: {schedule_result["status"]}')
    print(f'  消息: {schedule_result["message"]}')
    if 'scheduled_count' in schedule_result:
        print(f'  成功排程: {schedule_result["scheduled_count"]} 笔')
    if 'manual_review_count' in schedule_result:
        print(f'  人工复核: {schedule_result["manual_review_count"]} 笔')
    if 'delayed_count' in schedule_result:
        print(f'  需要延后: {schedule_result["delayed_count"]} 笔')
    print()
    
    print('【步骤8】查看排程结果')
    all_plans = plan_repo.get_all()
    scheduled_plans = [p for p in all_plans if p.status.value == 'scheduled']
    review_plans = [p for p in all_plans if p.status.value == 'manual_review']
    
    print(f'  已排程计划 ({len(scheduled_plans)} 笔):')
    for p in scheduled_plans:
        payment_date = p.current_payment_date.isoformat() if p.current_payment_date else '待定'
        print(f'    ✅ {p.vendor_name}: {payment_date} (¥{p.total_amount:,.2f})')
    
    if review_plans:
        print(f'  需要人工复核 ({len(review_plans)} 笔):')
        for p in review_plans:
            print(f'    ⚠️ {p.vendor_name}: {p.remark}')
    print()
    
    print('【步骤9】查看待发送的延后通知')
    pending_notifications = notification_service.get_pending_notifications()
    print(f'  待发送通知: {len(pending_notifications)} 笔')
    for n in pending_notifications:
        print(f'    - {n["vendor_name"]}: 延后{n["delay_days"]}天 ({n["delay_reason"]})')
    print()
    
    print('【步骤10】发送延后通知')
    if pending_notifications:
        notif_result = notification_task.run()
        print(f'  通知任务状态: {notif_result["status"]}')
        print(f'  成功发送: {notif_result.get("sent_count", 0)} 条')
        print(f'  发送失败: {notif_result.get("failed_count", 0)} 条')
    print()
    
    print('【步骤11】生成排程报表')
    report = report_task.generate_daily_report(today)
    print(f'  报表ID: {report["report_id"]}')
    print(f'  报表日期: {report["report_date"]}')
    if 'summary' in report:
        print(f'  已排程金额: ¥{report["summary"]["total_scheduled_amount"]:,.2f}')
        print(f'  已排程笔数: {report["summary"]["total_scheduled_count"]}')
        print(f'  插单笔数: {report["summary"]["insertion_count"]}')
        print(f'  人工复核: {report["summary"]["manual_review_count"]}')
    if 'recommendations' in report and report['recommendations']:
        print(f'  建议事项:')
        for rec in report['recommendations']:
            print(f'    💡 {rec}')
    print()
    
    print('=' * 60)
    print('示例执行完成！')
    print('=' * 60)
    print()
    print('【关键设计说明】')
    print()
    print('1. 规则可追溯')
    print('   所有业务规则执行都有 rule_traces，记录输入、输出和结果')
    print('   可通过接口 /api/payment-plans/{id}/rule-traces 查询')
    print()
    print('2. 状态清晰')
    print('   付款计划状态: draft → pending_schedule → scheduled → ')
    print('                partially_paid → fully_paid')
    print('   异常时转入: manual_review (需要人工处理)')
    print()
    print('3. 业务化返回')
    print('   接口返回使用业务语言，如：')
    print('   - "发票金额不足，计划金额10000元，关联发票仅9500元"')
    print('   - "该日期未配置资金日历，请先配置"')
    print()
    print('4. 插单审批')
    print('   - 紧急优先级(URGENT): 直接插队，无需审批')
    print('   - 其他优先级: 需要审批，记录影响范围')
    print()
    print('5. 后台任务')
    print('   - SchedulerTask: 每日自动排程，部分失败不影响其他')
    print('   - NotificationTask: 每小时发送通知，失败可重试')
    print('   - ReportTask: 每日生成报表，可重复生成')
    print()


if __name__ == '__main__':
    main()
