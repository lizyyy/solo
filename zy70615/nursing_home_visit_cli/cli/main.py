import click
from datetime import datetime
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from nursing_home_visit_cli.models import AppointmentStatus, Elder, Visitor, Room
from nursing_home_visit_cli.services import StorageService, AppointmentService, ReportService


class Context:
    def __init__(self):
        self.data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'data')
        self.reports_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'reports')
        self.storage = StorageService(self.data_dir)
        self.appointment_service = AppointmentService(self.storage)
        self.report_service = ReportService(self.storage, self.reports_dir)


pass_ctx = click.make_pass_decorator(Context)


@click.group()
@click.pass_context
def cli(ctx):
    """养老院探访预约管理系统 - 探访容量健康申报改约留痕排查CLI"""
    ctx.obj = Context()


@cli.group()
def init():
    """初始化基础数据"""
    pass


@init.command('sample')
@pass_ctx
def init_sample(ctx: Context):
    """初始化样例数据"""
    elders = [
        Elder(id='E001', name='张三', id_card='110101194001011234', room_number='101', bed_number='A', health_status='良好'),
        Elder(id='E002', name='李四', id_card='110101194102025678', room_number='101', bed_number='B', health_status='一般'),
        Elder(id='E003', name='王五', id_card='110101194203039012', room_number='102', bed_number='A', health_status='需要关注'),
    ]
    for e in elders:
        ctx.storage.add_elder(e)

    visitors = [
        Visitor(id='V001', name='张明', id_card='110101196501013456', phone='13800138001', relation='儿子'),
        Visitor(id='V002', name='李华', id_card='110101196602027890', phone='13800138002', relation='女儿'),
        Visitor(id='V003', name='王芳', id_card='110101196703031234', phone='13800138003', relation='孙女'),
    ]
    for v in visitors:
        ctx.storage.add_visitor(v)

    rooms = [
        Room(id='R001', room_number='101', capacity=2, floor='1楼', area='A区'),
        Room(id='R002', room_number='102', capacity=3, floor='1楼', area='A区'),
        Room(id='R003', room_number='201', capacity=2, floor='2楼', area='B区'),
    ]
    for r in rooms:
        ctx.storage.add_room(r)

    click.echo("✅ 样例数据初始化完成")
    click.echo(f"  - 老人: {len(ctx.storage.elders)} 人")
    click.echo(f"  - 探访人: {len(ctx.storage.visitors)} 人")
    click.echo(f"  - 房间: {len(ctx.storage.rooms)} 间")


@cli.group()
def appointment():
    """预约管理"""
    pass


@appointment.command('create')
@click.option('--elder', required=True, help='老人ID')
@click.option('--visitors', required=True, help='探访人ID列表，逗号分隔')
@click.option('--room', required=True, help='房间号')
@click.option('--start', required=True, help='开始时间 (YYYY-MM-DD HH:MM)')
@click.option('--end', required=True, help='结束时间 (YYYY-MM-DD HH:MM)')
@click.option('--operator', default='system', help='操作员')
@click.option('--notes', default='', help='备注')
@pass_ctx
def create_appointment(ctx: Context, elder, visitors, room, start, end, operator, notes):
    """创建预约"""
    visitor_ids = [v.strip() for v in visitors.split(',')]

    try:
        start_time = datetime.strptime(start, '%Y-%m-%d %H:%M')
        end_time = datetime.strptime(end, '%Y-%m-%d %H:%M')
    except ValueError:
        click.echo("❌ 时间格式错误，请使用 YYYY-MM-DD HH:MM 格式")
        return

    appointment, results = ctx.appointment_service.create_appointment(
        elder_id=elder,
        visitor_ids=visitor_ids,
        room_number=room,
        scheduled_start=start_time,
        scheduled_end=end_time,
        operator=operator,
        notes=notes
    )

    for result in results:
        if result.is_valid:
            click.echo(f"✅ {result.message}")
        else:
            click.echo(f"❌ {result.message} (错误码: {result.error_code})")

    if appointment:
        click.echo(f"\n✅ 预约创建成功！预约ID: {appointment.id}")
        click.echo(f"  当前状态: {appointment.status.value}")
    else:
        click.echo("\n❌ 预约创建失败")


@appointment.command('confirm')
@click.argument('appointment_id')
@click.option('--operator', default='system', help='操作员')
@pass_ctx
def confirm_appointment(ctx: Context, appointment_id, operator):
    """确认预约"""
    apt, result = ctx.appointment_service.update_status(
        appointment_id, AppointmentStatus.CONFIRMED, operator, "确认预约"
    )

    if result.is_valid:
        click.echo(f"✅ {result.message}")
        click.echo(f"  预约 {apt.id} 已确认")
    else:
        click.echo(f"❌ {result.message} (错误码: {result.error_code})")


@appointment.command('cancel')
@click.argument('appointment_id')
@click.option('--operator', default='system', help='操作员')
@click.option('--reason', default='', help='取消原因')
@pass_ctx
def cancel_appointment(ctx: Context, appointment_id, operator, reason):
    """取消预约"""
    apt, result = ctx.appointment_service.update_status(
        appointment_id, AppointmentStatus.CANCELLED, operator, reason or "用户取消"
    )

    if result.is_valid:
        click.echo(f"✅ {result.message}")
        click.echo(f"  预约 {apt.id} 已取消")
    else:
        click.echo(f"❌ {result.message} (错误码: {result.error_code})")


@appointment.command('reschedule')
@click.argument('appointment_id')
@click.option('--start', required=True, help='新开始时间 (YYYY-MM-DD HH:MM)')
@click.option('--end', required=True, help='新结束时间 (YYYY-MM-DD HH:MM)')
@click.option('--operator', default='system', help='操作员')
@click.option('--reason', default='', help='改约原因')
@pass_ctx
def reschedule_appointment(ctx: Context, appointment_id, start, end, operator, reason):
    """改约"""
    try:
        start_time = datetime.strptime(start, '%Y-%m-%d %H:%M')
        end_time = datetime.strptime(end, '%Y-%m-%d %H:%M')
    except ValueError:
        click.echo("❌ 时间格式错误，请使用 YYYY-MM-DD HH:MM 格式")
        return

    apt, results = ctx.appointment_service.reschedule(
        appointment_id, start_time, end_time, operator, reason or "用户改约"
    )

    for result in results:
        if result.is_valid:
            click.echo(f"✅ {result.message}")
        else:
            click.echo(f"❌ {result.message} (错误码: {result.error_code})")

    if apt:
        click.echo(f"\n✅ 改约成功！预约ID: {apt.id}")
        click.echo(f"  新时间: {apt.scheduled_start} - {apt.scheduled_end}")
    else:
        click.echo("\n❌ 改约失败")


@appointment.command('list')
@pass_ctx
def list_appointments(ctx: Context):
    """列出所有预约"""
    appointments = ctx.storage.get_all_appointments()

    if not appointments:
        click.echo("暂无预约记录")
        return

    click.echo(f"共找到 {len(appointments)} 个预约:\n")
    for apt in appointments:
        click.echo(f"ID: {apt.id}")
        click.echo(f"  老人: {apt.elder_id}")
        click.echo(f"  探访人: {', '.join(apt.visitor_ids)}")
        click.echo(f"  房间: {apt.room_number}")
        click.echo(f"  时间: {apt.scheduled_start} - {apt.scheduled_end}")
        click.echo(f"  状态: {apt.status.value}")
        click.echo("")


@appointment.command('health')
@click.argument('appointment_id')
@click.option('--visitor', required=True, help='探访人ID')
@click.option('--temp', type=float, required=True, help='体温')
@click.option('--fever/--no-fever', default=False, help='是否有发热')
@click.option('--cough/--no-cough', default=False, help='是否有咳嗽')
@click.option('--other/--no-other', default=False, help='是否有其他症状')
@click.option('--symptoms', default='', help='症状详情')
@click.option('--operator', default='system', help='操作员')
@pass_ctx
def add_health(ctx: Context, appointment_id, visitor, temp, fever, cough, other, symptoms, operator):
    """添加健康申报"""
    declaration, result = ctx.appointment_service.add_health_declaration(
        appointment_id=appointment_id,
        visitor_id=visitor,
        temperature=temp,
        has_fever=fever,
        has_cough=cough,
        has_other_symptoms=other,
        symptoms_detail=symptoms,
        operator=operator
    )

    if result.is_valid:
        click.echo(f"✅ {result.message}")
        click.echo(f"  健康申报ID: {declaration.id}")
        click.echo(f"  体温: {declaration.temperature}℃")
        click.echo(f"  状态: {'通过' if declaration.is_passed else '未通过'}")
    else:
        click.echo(f"❌ {result.message} (错误码: {result.error_code})")


@cli.group()
def report():
    """报告管理"""
    pass


@report.command('daily')
@click.option('--date', help='日期 (YYYY-MM-DD)，默认为今天')
@pass_ctx
def daily_report(ctx: Context, date):
    """生成日报"""
    if date:
        try:
            report_date = datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            click.echo("❌ 日期格式错误，请使用 YYYY-MM-DD 格式")
            return
    else:
        report_date = datetime.now()

    report = ctx.report_service.generate_daily_report(report_date)

    filename = f"daily_{report_date.strftime('%Y%m%d')}"
    json_path = ctx.report_service.save_report_json(report, filename)
    txt_path = ctx.report_service.save_report_text(report, filename)

    click.echo(ctx.report_service.format_report_human_readable(report))
    click.echo("\n" + "=" * 60)
    click.echo(f"✅ 报告已保存:")
    click.echo(f"  JSON格式: {json_path}")
    click.echo(f"  文本格式: {txt_path}")


@report.command('detail')
@click.argument('appointment_id')
@pass_ctx
def detail_report(ctx: Context, appointment_id):
    """生成预约详情报告"""
    report = ctx.report_service.generate_appointment_detail_report(appointment_id)

    if 'error' in report:
        click.echo(f"❌ {report['error']}")
        return

    filename = f"appointment_{appointment_id}"
    json_path = ctx.report_service.save_report_json(report, filename)
    txt_path = ctx.report_service.save_report_text(report, filename)

    click.echo(ctx.report_service.format_report_human_readable(report))
    click.echo("\n" + "=" * 60)
    click.echo(f"✅ 报告已保存:")
    click.echo(f"  JSON格式: {json_path}")
    click.echo(f"  文本格式: {txt_path}")


@cli.group()
def list():
    """列出数据"""
    pass


@list.command('elders')
@pass_ctx
def list_elders(ctx: Context):
    """列出所有老人"""
    elders = ctx.storage.get_all_elders()
    if not elders:
        click.echo("暂无老人记录")
        return

    for e in elders:
        click.echo(f"{e.id}: {e.name} (房间{e.room_number}-{e.bed_number}, 健康:{e.health_status})")


@list.command('visitors')
@pass_ctx
def list_visitors(ctx: Context):
    """列出所有探访人"""
    visitors = ctx.storage.get_all_visitors()
    if not visitors:
        click.echo("暂无探访人记录")
        return

    for v in visitors:
        click.echo(f"{v.id}: {v.name} ({v.relation}, 电话:{v.phone})")


@list.command('rooms')
@pass_ctx
def list_rooms(ctx: Context):
    """列出所有房间"""
    rooms = ctx.storage.get_all_rooms()
    if not rooms:
        click.echo("暂无房间记录")
        return

    for r in rooms:
        click.echo(f"{r.id}: 房间{r.room_number} (容量:{r.capacity}人, {r.floor}{r.area})")


if __name__ == '__main__':
    cli()
