from app import create_app
from app.database import db
from app.models import (
    InspectionItem, DefectTicket, WorkOrder, Reinspection,
    DowntimeRecord, ImpactStatistics
)
from app.enums import TicketStatus, DefectSeverity
from datetime import datetime, timedelta

app = create_app()

with app.app_context():
    db.drop_all()
    db.create_all()

    print('=== 1. 创建设备点检项 ===')
    items = [
        InspectionItem(
            name='电机温度检查',
            equipment='生产流水线A-01',
            description='检查电机运行温度是否在正常范围内（40-70°C）'
        ),
        InspectionItem(
            name='传送带张力',
            equipment='生产流水线A-01',
            description='检查传送带张紧度，确保运行平稳'
        ),
        InspectionItem(
            name='液压油位',
            equipment='液压机B-02',
            description='检查液压系统油位，低于最低线需补充'
        ),
    ]
    for item in items:
        db.session.add(item)
    db.session.commit()
    print(f'已创建 {len(items)} 个点检项')
    for item in InspectionItem.query.all():
        print(f'  - ID={item.id}: {item.name}（{item.equipment}）')

    print('\n=== 2. 创建缺陷工单（点检发现缺陷） ===')
    now = datetime.utcnow()
    tickets = [
        DefectTicket(
            inspection_item_id=1,
            severity=DefectSeverity.CRITICAL,
            description='电机温度持续 85°C，超过安全阈值，可能导致烧毁',
            created_by='点检员-张三'
        ),
        DefectTicket(
            inspection_item_id=2,
            severity=DefectSeverity.MEDIUM,
            description='传送带张力偏松，运行时有轻微打滑现象',
            created_by='点检员-张三'
        ),
        DefectTicket(
            inspection_item_id=3,
            severity=DefectSeverity.LOW,
            description='液压油位接近最低线，下周需要补充',
            created_by='点检员-李四'
        ),
    ]
    for ticket in tickets:
        db.session.add(ticket)
    db.session.commit()
    print(f'已创建 {len(tickets)} 个缺陷工单')
    for t in DefectTicket.query.all():
        print(f'  - ID={t.id}: {t.severity.value} - {t.status.value}（版本{t.version}）')

    print('\n=== 3. 模拟主流程：工单 #1 ===')
    ticket = db.session.get(DefectTicket, 1)
    print(f'初始状态：{ticket.status.value}（版本 {ticket.version}）')

    print('  动作：派单给维修组A')
    work_order = WorkOrder(
        defect_ticket_id=ticket.id,
        assignee='维修组A',
        instructions='立即检查电机过热原因，必要时更换部件'
    )
    db.session.add(work_order)
    ticket.assigned_to = '维修组A'
    ticket.status = TicketStatus.ASSIGNED
    db.session.commit()
    print(f'  状态变为：{ticket.status.value}（版本 {ticket.version}）')

    print('  动作：维修开始')
    work_order.started_at = now + timedelta(minutes=10)
    ticket.status = TicketStatus.IN_PROGRESS
    db.session.commit()
    print(f'  状态变为：{ticket.status.value}（版本 {ticket.version}）')

    print('  动作：记录停机影响')
    downtime = DowntimeRecord(
        defect_ticket_id=ticket.id,
        start_time=now + timedelta(minutes=5),
        end_time=now + timedelta(hours=2, minutes=30),
        duration_hours=2.5,
        reason='电机过热需要停机冷却并检查'
    )
    db.session.add(downtime)
    ticket.downtime_hours = ticket.downtime_hours + 2.5
    db.session.commit()
    print(f'  记录停机：2.5 小时，工单停机总数={ticket.downtime_hours}')

    print('  动作：维修完成')
    work_order.completed_at = now + timedelta(hours=3)
    work_order.notes = '已清理电机散热片，更换老化轴承，温度恢复正常'
    ticket.status = TicketStatus.COMPLETED
    db.session.commit()
    print(f'  状态变为：{ticket.status.value}（版本 {ticket.version}）')

    print('  动作：复验通过')
    reinspection = Reinspection(
        defect_ticket_id=ticket.id,
        inspector='质量检查员-王五',
        result=True,
        comments='电机温度稳定在 55°C，运行正常'
    )
    db.session.add(reinspection)
    ticket.status = TicketStatus.REINSPECTED
    db.session.commit()
    print(f'  状态变为：{ticket.status.value}（版本 {ticket.version}）')

    print('  动作：关闭工单')
    ticket.status = TicketStatus.CLOSED
    db.session.commit()
    print(f'  状态变为：{ticket.status.value}（版本 {ticket.version}）')

    print('\n=== 4. 模拟停机记录累加测试（验证修复的 bug）===')
    ticket_test = db.session.get(DefectTicket, 1)
    original_downtime = ticket_test.downtime_hours
    print(f'  工单 #1 当前停机时长：{original_downtime} 小时')

    print('  添加 1.5 小时停机记录...')
    downtime2 = DowntimeRecord(
        defect_ticket_id=ticket_test.id,
        start_time=now + timedelta(hours=4),
        end_time=now + timedelta(hours=5, minutes=30),
        duration_hours=1.5,
        reason='额外测试停机'
    )
    db.session.add(downtime2)
    ticket_test.downtime_hours = ticket_test.downtime_hours + 1.5
    db.session.commit()
    db.session.refresh(ticket_test)

    expected = original_downtime + 1.5
    actual = ticket_test.downtime_hours
    print(f'  预期结果：{expected} 小时')
    print(f'  实际结果：{actual} 小时')
    if abs(expected - actual) < 0.001:
        print('  ✓ 停机时间累加正确，未重复计算')
    else:
        print(f'  ✗ 停机时间累加错误！预期 {expected}，实际 {actual}')

    print('\n=== 5. 模拟另一个工单的复验失败场景：工单 #2 ===')
    ticket2 = db.session.get(DefectTicket, 2)
    print(f'初始状态：{ticket2.status.value}（版本 {ticket2.version}）')

    work_order2 = WorkOrder(
        defect_ticket_id=ticket2.id,
        assignee='维修组B',
        instructions='调整传送带张紧轮'
    )
    db.session.add(work_order2)
    ticket2.assigned_to = '维修组B'
    ticket2.status = TicketStatus.ASSIGNED
    work_order2.started_at = now + timedelta(minutes=5)
    ticket2.status = TicketStatus.IN_PROGRESS
    work_order2.completed_at = now + timedelta(minutes=45)
    work_order2.notes = '已张紧传送带'
    ticket2.status = TicketStatus.COMPLETED
    db.session.commit()
    print(f'  维修完成，状态：{ticket2.status.value}')

    print('  动作：复验失败，重新打开')
    reinspection2 = Reinspection(
        defect_ticket_id=ticket2.id,
        inspector='质量检查员-王五',
        result=False,
        comments='仍有轻微打滑，张力还不够'
    )
    db.session.add(reinspection2)
    ticket2.status = TicketStatus.REOPENED
    ticket2.assigned_to = None
    db.session.commit()
    print(f'  状态变为：{ticket2.status.value}（复验失败，需要重新派单）')

    print('\n=== 6. 生成影响统计 ===')
    period_end = now
    period_start = now - timedelta(days=30)
    all_tickets = DefectTicket.query.filter(
        DefectTicket.created_at >= period_start
    ).all()

    stats = ImpactStatistics(
        period_start=period_start,
        period_end=period_end,
        total_tickets=len(all_tickets),
        critical_count=sum(1 for t in all_tickets if t.severity == DefectSeverity.CRITICAL),
        high_count=sum(1 for t in all_tickets if t.severity == DefectSeverity.HIGH),
        medium_count=sum(1 for t in all_tickets if t.severity == DefectSeverity.MEDIUM),
        low_count=sum(1 for t in all_tickets if t.severity == DefectSeverity.LOW),
        total_downtime_hours=sum(t.downtime_hours for t in all_tickets),
        avg_resolution_hours=3.5
    )
    db.session.add(stats)
    db.session.commit()
    print(f'已生成统计：共 {stats.total_tickets} 个工单，总停机 {stats.total_downtime_hours} 小时')

    print('\n=== 测试数据生成完成 ===')
    print('可以启动应用后通过 /api/tickets 等接口查看数据')
