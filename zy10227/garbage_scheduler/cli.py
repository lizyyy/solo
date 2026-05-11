import click
import sys
from datetime import datetime
from .database import init_db, DB_PATH
from .services import (
    import_appointments_from_csv,
    import_vehicles_from_csv,
    import_violations_from_csv,
    check_anomalies,
    get_unresolved_anomalies,
    resolve_anomaly,
    update_appointment_payment,
    cancel_appointment,
    generate_schedules,
    finalize_schedules,
    generate_daily_report,
    export_schedules_to_csv,
    get_vehicles,
    get_appointments_for_scheduling
)
from .models import VALID_PAYMENT_STATUSES, VALID_TIME_SLOTS

SEVERITY_COLORS = {
    'low': 'green',
    'warning': 'yellow',
    'high': 'bright_red',
    'critical': 'red'
}

PAYMENT_COLORS = {
    'paid': 'green',
    'unpaid': 'red',
    'partial': 'yellow'
}

TIMESLOT_NAMES = {
    'morning': '上午',
    'afternoon': '下午',
    'evening': '晚上'
}

ANOMALY_TYPE_NAMES = {
    'unpaid_appointment': '未缴费预约',
    'duplicate_appointment': '重复预约',
    'overloaded_vehicle': '车辆超载',
    'violation_skipped': '违规户投诉',
    'volume_mismatch': '清运量差异',
    'other': '其他'
}

def init_context(ctx, param, value):
    if value:
        init_db()
        click.echo(f"数据库已初始化: {DB_PATH}")
        ctx.exit()

@click.group()
@click.version_option(version='1.0.0', prog_name='garbage-scheduler')
@click.option('--init-db', is_flag=True, callback=init_context,
              expose_value=False, is_eager=True,
              help='初始化 SQLite 数据库')
def cli():
    """装修垃圾清运排班 CLI 工具
    
    工作流程: import -> check -> fix -> schedule -> confirm -> report
    """
    init_db()

@cli.group()
def import_cmd():
    """导入数据 (appointments/vehicles/violations)"""
    pass

@import_cmd.command('appointments')
@click.argument('csv_path', type=click.Path(exists=True, readable=True))
@click.option('--batch-id', help='批次ID，用于重复导入检测')
def import_appointments(csv_path, batch_id):
    """从 CSV 导入预约数据
    
    CSV 必需字段: name, building, appointment_date, time_slot, volume_cubic
    可选字段: unit, room, phone, payment_status
    时段有效值: morning, afternoon, evening
    缴费状态: paid, unpaid, partial
    """
    try:
        stats = import_appointments_from_csv(csv_path, batch_id)
        click.echo(f"\n导入批次: {stats['batch_id']}")
        click.echo(f"总计: {stats['total']} 条")
        click.echo(f"成功: {stats['successful']} 条")
        click.echo(f"重复: {stats['duplicates']} 条 (已跳过)")
        click.echo(f"失败: {stats['failed']} 条")
        
        if stats['errors']:
            click.echo("\n错误详情:")
            for err in stats['errors'][:10]:
                click.echo(f"  - {err}")
            if len(stats['errors']) > 10:
                click.echo(f"  ... 还有 {len(stats['errors']) - 10} 条错误")
    except Exception as e:
        click.echo(f"导入失败: {e}", err=True)
        sys.exit(1)

@import_cmd.command('vehicles')
@click.argument('csv_path', type=click.Path(exists=True, readable=True))
def import_vehicles(csv_path):
    """从 CSV 导入车辆数据
    
    CSV 字段: plate_number, capacity_cubic, driver_name, is_active
    """
    try:
        stats = import_vehicles_from_csv(csv_path)
        click.echo(f"总计: {stats['total']} 条")
        click.echo(f"成功: {stats['successful']} 条")
        click.echo(f"重复: {stats['duplicates']} 条 (已跳过)")
        click.echo(f"失败: {stats['failed']} 条")
        
        if stats['errors']:
            click.echo("\n错误详情:")
            for err in stats['errors'][:5]:
                click.echo(f"  - {err}")
    except Exception as e:
        click.echo(f"导入失败: {e}", err=True)
        sys.exit(1)

@import_cmd.command('violations')
@click.argument('csv_path', type=click.Path(exists=True, readable=True))
def import_violations(csv_path):
    """从 CSV 导入违规记录
    
    CSV 字段: name, building, unit, room, violation_date, violation_type, description, has_complaint
    违规类型: illegal_dumping, exceeding_quota, wrong_time, other
    """
    try:
        stats = import_violations_from_csv(csv_path)
        click.echo(f"总计: {stats['total']} 条")
        click.echo(f"成功: {stats['successful']} 条")
        click.echo(f"失败: {stats['failed']} 条")
        
        if stats['errors']:
            click.echo("\n错误详情:")
            for err in stats['errors'][:5]:
                click.echo(f"  - {err}")
    except Exception as e:
        click.echo(f"导入失败: {e}", err=True)
        sys.exit(1)

@cli.command('check')
@click.option('--date', help='检查指定日期 (YYYY-MM-DD)')
@click.option('--all', 'check_all', is_flag=True, help='检查所有日期')
def check(date, check_all):
    """异常检查
    
    检查类型:
    - 未缴费预约 (high)
    - 同一住户重复排班 (warning)
    - 车辆超载 (high)
    - 违规户被跳过又产生投诉 (critical)
    """
    if not date and not check_all:
        click.echo("请使用 --date 指定日期，或使用 --all 检查所有日期")
        sys.exit(1)
    
    anomalies = check_anomalies(date, check_all)
    unresolved = get_unresolved_anomalies()
    
    click.echo(f"\n{'='*60}")
    click.echo(f"异常检查结果 - {date or '全部日期'}")
    click.echo(f"{'='*60}")
    
    if not unresolved:
        click.echo(click.style("✅ 没有待处理的异常", fg='green'))
        return
    
    click.echo(f"发现 {len(unresolved)} 个待处理异常:\n")
    
    for an in unresolved:
        severity = an['severity']
        an_type = ANOMALY_TYPE_NAMES.get(an['anomaly_type'], an['anomaly_type'])
        color = SEVERITY_COLORS.get(severity, 'white')
        
        click.echo(f"[{an['id']}] {click.style(f'{severity.upper()}', fg=color, bold=True)} - {an_type}")
        click.echo(f"    住户: {an.get('resident_name', 'N/A')}")
        click.echo(f"    楼栋: {an.get('building', 'N/A')}")
        if an.get('appointment_date'):
            click.echo(f"    预约: {an['appointment_date']} {TIMESLOT_NAMES.get(an.get('time_slot'), '')}")
        click.echo(f"    说明: {an['description']}")
        click.echo()

@cli.group()
def fix():
    """人工修正命令"""
    pass

@fix.command('list')
def list_anomalies():
    """列出所有待处理异常"""
    unresolved = get_unresolved_anomalies()
    
    if not unresolved:
        click.echo(click.style("✅ 没有待处理的异常", fg='green'))
        return
    
    click.echo(f"\n{'ID':<5} {'严重度':<10} {'类型':<15} {'住户':<15} {'描述'}")
    click.echo('-' * 80)
    
    for an in unresolved:
        severity = an['severity']
        color = SEVERITY_COLORS.get(severity, 'white')
        an_type = ANOMALY_TYPE_NAMES.get(an['anomaly_type'], an['anomaly_type'])[:12]
        
        click.echo(
            f"{an['id']:<5} "
            f"{click.style(severity.upper()[:8], fg=color):<10} "
            f"{an_type:<15} "
            f"{(an.get('resident_name') or 'N/A')[:14]:<15} "
            f"{an['description'][:40]}"
        )

@fix.command('resolve')
@click.argument('anomaly_id', type=int)
@click.option('--resolution', '-r', required=True, help='解决方案说明')
def resolve(anomaly_id, resolution):
    """标记异常为已解决
    
    注意: 这只是标记，实际业务操作需要使用其他命令
    """
    if resolve_anomaly(anomaly_id, resolution):
        click.echo(click.style(f"异常 {anomaly_id} 已标记为已解决", fg='green'))
    else:
        click.echo(f"未找到异常 ID: {anomaly_id}", err=True)
        sys.exit(1)

@fix.command('payment')
@click.argument('appointment_id', type=int)
@click.option('--status', '-s', required=True,
              type=click.Choice(VALID_PAYMENT_STATUSES),
              help='缴费状态: paid/unpaid/partial')
@click.option('--amount-paid', '-a', type=float,
              help='已收金额（元）')
def update_payment(appointment_id, status, amount_paid):
    """更新预约的缴费状态和已收金额"""
    try:
        if update_appointment_payment(appointment_id, status, amount_paid):
            msg = f"预约 {appointment_id} 缴费状态已更新为: {status}"
            if amount_paid is not None:
                msg += f", 已收金额: {amount_paid}元"
            click.echo(click.style(msg, fg=PAYMENT_COLORS.get(status, 'white')))
        else:
            click.echo(f"未找到预约 ID: {appointment_id}", err=True)
            sys.exit(1)
    except ValueError as e:
        click.echo(str(e), err=True)
        sys.exit(1)

@fix.command('cancel')
@click.argument('appointment_id', type=int)
def cancel(appointment_id):
    """取消预约（用于处理重复预约等情况）"""
    if cancel_appointment(appointment_id):
        click.echo(click.style(f"预约 {appointment_id} 已取消", fg='yellow'))
    else:
        click.echo(f"未找到预约 ID: {appointment_id}", err=True)
        sys.exit(1)

@cli.command('schedule')
@click.argument('date')
def schedule(date):
    """生成排班方案
    
    会自动考虑:
    - 车辆容量限制
    - 时段分配 (上午/下午/晚上)
    - 跳过未缴费和有投诉的违规户
    """
    try:
        result = generate_schedules(date)
        
        click.echo(f"\n{'='*60}")
        click.echo(f"排班结果 - {date}")
        click.echo(f"{'='*60}")
        
        if not result.get('schedules'):
            click.echo(result.get('message', '没有可排班的预约'))
            return
        
        click.echo(f"总预约数: {result['total_appointments']}")
        click.echo(f"符合条件: {result['eligible']}")
        click.echo(f"已安排: {click.style(str(result['scheduled']), fg='green')}")
        click.echo(f"不符合条件: {click.style(str(result['ineligible']), fg='yellow')}")
        
        if result['schedules']:
            click.echo(f"\n车次安排:")
            click.echo(f"{'车牌':<12} {'时段':<8} {'住户':<15} {'楼栋':<8} {'清运量':<10}")
            click.echo('-' * 55)
            for s in result['schedules']:
                click.echo(
                    f"{s['plate']:<12} "
                    f"{TIMESLOT_NAMES.get(s['time_slot'], s['time_slot']):<8} "
                    f"{s['resident'][:14]:<15} "
                    f"{s['building']:<8} "
                    f"{s['volume']}m³"
                )
        
        if result['ineligible_details']:
            click.echo(f"\n不符合条件的预约 ({result['ineligible']} 条):")
            for apt in result['ineligible_details']:
                click.echo(f"  - [{apt['id']}] {apt['name']} ({apt['building']}) "
                          f"{apt['appointment_date']} {TIMESLOT_NAMES.get(apt['time_slot'])} "
                          f"- 缴费: {click.style(apt['payment_status'], fg=PAYMENT_COLORS.get(apt['payment_status'], 'white'))}")
        
    except Exception as e:
        click.echo(f"排班失败: {e}", err=True)
        sys.exit(1)

@cli.command('confirm')
@click.argument('date')
@click.option('--force', is_flag=True, help='忽略高优先级异常强制确认（不推荐）')
def confirm(date, force):
    """最终确认排班
    
    确认前必须没有高优先级(high/critical)异常未解决
    """
    if force:
        click.echo(click.style("⚠️  警告: 使用 --force 强制确认，可能导致问题", fg='yellow', bold=True))
    
    result = finalize_schedules(date)
    
    if result['success']:
        click.echo(click.style(f"\n✅ {result['message']}", fg='green', bold=True))
    else:
        click.echo(click.style(f"\n❌ {result['message']}", fg='red', bold=True))
        click.echo("\n请运行 'garbage-scheduler check' 查看异常详情，")
        click.echo("使用 'garbage-scheduler fix' 相关命令处理后再确认。")
        sys.exit(1)

@cli.group()
def report():
    """报表输出"""
    pass

@report.command('daily')
@click.argument('date')
@click.option('--output', '-o', type=click.Path(), help='输出 JSON 文件路径')
@click.option('--csv', '-c', type=click.Path(), help='输出 CSV 文件路径（推荐用于 Excel）')
def daily_report(date, output, csv):
    """生成日报表
    
    包含:
    - 车次安排详情
    - 车辆装载汇总
    - 未处理预约及原因
    - 按楼栋核对表
    """
    try:
        if csv:
            result = export_schedules_to_csv(date, csv)
            click.echo(click.style(f"CSV 报表已生成: {csv}", fg='green'))
            
            report = result['report']
        else:
            report = generate_daily_report(date, output)
        
        if output:
            click.echo(click.style(f"JSON 数据已保存: {output}", fg='green'))
        
        summary = report['summary']
        click.echo(f"\n{'='*60}")
        click.echo(f"排班日报 - {date}")
        click.echo(f"{'='*60}")
        click.echo(f"已安排车次: {click.style(str(summary['total_scheduled']), fg='green')}")
        click.echo(f"未处理预约: {click.style(str(summary['total_unhandled']), fg='yellow')}")
        click.echo(f"使用车辆数: {summary['vehicles_used']}")
        click.echo(f"涉及楼栋数: {summary['buildings_affected']}")
        click.echo(f"待处理异常: {click.style(str(summary['active_anomalies']), fg='red') if summary['active_anomalies'] > 0 else summary['active_anomalies']}")
        
        if report['building_summary']:
            click.echo(f"\n按楼栋核对:")
            click.echo(f"{'楼栋':<10} {'已安排':<8} {'未处理':<8} {'清运量':<10} {'未缴费':<8}")
            click.echo('-' * 50)
            for building, data in sorted(report['building_summary'].items()):
                click.echo(
                    f"{building:<10} "
                    f"{data.get('scheduled_count', 0):<8} "
                    f"{data.get('unhandled_count', 0):<8} "
                    f"{data.get('total_volume', 0):<8}m³ "
                    f"{click.style(str(data.get('unpaid_count', 0)), fg='red') if data.get('unpaid_count', 0) > 0 else '0':<8}"
                )
        
        if report['unhandled_appointments']:
            click.echo(f"\n未处理预约 ({len(report['unhandled_appointments'])} 条):")
            for u in report['unhandled_appointments']:
                reasons = []
                for an in report['anomalies']:
                    if an['appointment_id'] == u['id']:
                        reasons.append(an['description'])
                click.echo(f"  - [{u['id']}] {u['name']} ({u['building']}) "
                          f"{TIMESLOT_NAMES.get(u['time_slot'], u['time_slot'])} "
                          f"{u['volume_cubic']}m³ - "
                          f"{click.style(u['payment_status'], fg=PAYMENT_COLORS.get(u['payment_status'], 'white'))}")
                if reasons:
                    click.echo(f"    原因: {'; '.join(reasons)}")
        
    except Exception as e:
        click.echo(f"生成报表失败: {e}", err=True)
        sys.exit(1)

@cli.command('vehicles')
@click.option('--all', 'show_all', is_flag=True, help='显示所有车辆（包括停用的）')
def list_vehicles(show_all):
    """列出所有车辆"""
    vehicles = get_vehicles(active_only=not show_all)
    
    if not vehicles:
        click.echo("没有车辆数据，请先导入车辆")
        return
    
    click.echo(f"{'ID':<5} {'车牌':<15} {'容量(m³)':<10} {'司机':<15} {'状态':<10}")
    click.echo('-' * 60)
    for v in vehicles:
        status = '启用' if v['is_active'] else '停用'
        color = 'green' if v['is_active'] else 'yellow'
        click.echo(
            f"{v['id']:<5} "
            f"{v['plate_number']:<15} "
            f"{v['capacity_cubic']:<10} "
            f"{(v['driver_name'] or '')[:14]:<15} "
            f"{click.style(status, fg=color):<10}"
        )

@cli.command('appointments')
@click.argument('date')
def list_appointments(date):
    """查看指定日期的预约"""
    appointments = get_appointments_for_scheduling(date)
    
    if not appointments:
        click.echo(f"{date} 没有预约")
        return
    
    click.echo(f"\n{'ID':<5} {'住户':<15} {'楼栋':<10} {'时段':<10} {'清运量':<10} {'缴费':<10} {'状态'}")
    click.echo('-' * 75)
    for a in appointments:
        eligible = '符合条件' if a['is_eligible'] else '不符合'
        elg_color = 'green' if a['is_eligible'] else 'red'
        click.echo(
            f"{a['id']:<5} "
            f"{a['name'][:14]:<15} "
            f"{a['building']:<10} "
            f"{TIMESLOT_NAMES.get(a['time_slot'], a['time_slot']):<10} "
            f"{a['volume_cubic']}m³{'':<5} "
            f"{click.style(a['payment_status'], fg=PAYMENT_COLORS.get(a['payment_status'], 'white')):<10} "
            f"{click.style(eligible, fg=elg_color)}"
        )

def main():
    cli()

if __name__ == '__main__':
    main()
