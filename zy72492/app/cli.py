import click
import json
from . import service
from .store import store
from .demo_data import init_demo_data, run_demo_workflow
from .models import Status


@click.group()
def cli():
    """街道家具破损派单系统 - 命令行工具"""
    pass


@cli.command()
def init_demo():
    """初始化演示数据"""
    init_demo_data()


@cli.command()
def run_demo():
    """运行完整演示流程"""
    run_demo_workflow()


@cli.command()
@click.argument('point_id')
@click.argument('title')
@click.argument('description')
@click.option('--operator', default='系统导入', help='操作人')
def import_notice(point_id, title, description, operator):
    """导入施工告示

    POINT_ID: 街道点ID
    TITLE: 派单标题
    DESCRIPTION: 派单描述
    """
    order, heatmap = service.import_construction_notice(point_id, title, description, operator)
    click.echo(f"✅ 派单创建成功: {order.id}")
    click.echo(f"   标题: {order.title}")
    click.echo(f"   状态: {order.status.value}")
    click.echo(f"   热力图版本: v{heatmap.version}")


@cli.command()
@click.argument('order_id')
@click.argument('ramp_description')
@click.option('--operator', default='市政巡检员小付', help='操作人')
@click.option('--night', is_flag=True, help='是否为晚间采样')
def supplement_ramp(order_id, ramp_description, operator, night):
    """补录无障碍坡道记录

    ORDER_ID: 派单ID
    RAMP_DESCRIPTION: 坡道记录描述
    """
    order, heatmap = service.supplement_ramp_record(order_id, ramp_description, operator, is_night=night)
    click.echo(f"✅ 补录成功")
    click.echo(f"   派单: {order.id}")
    click.echo(f"   新状态: {order.status.value}")
    click.echo(f"   原因: {order.missing_reason}")
    click.echo(f"   热力图版本: v{heatmap.version}")


@cli.command()
@click.argument('order_id')
@click.argument('correction_note')
@click.option('--operator', default='市政巡检员小付', help='操作人')
@click.option('--status', type=click.Choice([s.value for s in Status]), default=Status.NORMAL.value, help='修正后的状态')
def correct(order_id, correction_note, operator, status):
    """人工修正派单状态

    ORDER_ID: 派单ID
    CORRECTION_NOTE: 修正说明
    """
    new_status = Status(status)
    order, heatmap = service.manual_correct(
        order_id,
        new_status=new_status,
        new_reason=f"人工修正: {correction_note}",
        operator=operator,
        correction_note=correction_note
    )
    click.echo(f"✅ 修正成功")
    click.echo(f"   派单: {order.id}")
    click.echo(f"   新状态: {order.status.value}")
    click.echo(f"   热力图版本: v{heatmap.version}")


@cli.command()
@click.option('--operator', default='系统', help='操作人')
@click.option('--reason', default='手动重跑', help='重跑原因')
def rerun_heatmap(operator, reason):
    """重跑热力图"""
    heatmap = service.generate_heatmap(operator, reason)
    click.echo(f"✅ 热力图重跑完成")
    click.echo(f"   版本: v{heatmap.version}")
    click.echo(f"   生成时间: {heatmap.generated_at}")
    click.echo(f"   提示信息 ({len(heatmap.notes)} 条):")
    for note in heatmap.notes:
        click.echo(f"   - {note}")


@cli.command()
@click.argument('order_id')
def order_detail(order_id):
    """查看派单详情"""
    detail = service.get_order_detail(order_id)
    if not detail:
        click.echo(f"❌ 派单 {order_id} 不存在")
        return

    order = detail['order']
    click.echo(f"=== 派单详情 {order_id} ===")
    click.echo(f"标题: {order['title']}")
    click.echo(f"描述: {order['description']}")
    click.echo(f"状态: {order['status']}")
    click.echo(f"热力图得分: {order['heatmap_score']}")
    click.echo(f"原因: {order['missing_reason']}")
    click.echo(f"下一步: {order['next_action']}")
    click.echo(f"负责人: {order['responsible_person']}")

    if detail['point']:
        click.echo(f"\n📍 点位: {detail['point']['name']} ({detail['point']['district']})")

    if detail['records']:
        click.echo(f"\n📋 采样记录 ({len(detail['records'])} 条):")
        for r in detail['records']:
            click.echo(f"  [{r['sampling_time']}] {r['record_type']} - 得分: {r['score']}")

    if detail['audit_logs']:
        click.echo(f"\n📜 变更历史 ({len(detail['audit_logs'])} 条):")
        for log in sorted(detail['audit_logs'], key=lambda x: x['timestamp']):
            click.echo(f"  [{log['timestamp'][:19]}] {log['operator']} - {log['action']}")
            click.echo(f"    原因: {log['reason']}")


@cli.command()
def list_orders():
    """列出所有派单"""
    if not store.orders:
        click.echo("暂无派单记录")
        return

    click.echo(f"{'ID':<10} {'标题':<20} {'状态':<15} {'得分':<8} {'负责人'}")
    click.echo("-" * 70)
    for order in store.orders.values():
        click.echo(f"{order.id:<10} {order.title:<20} {order.status.value:<15} {order.heatmap_score:<8} {order.responsible_person or '-'}")


@cli.command()
def heatmap():
    """查看当前热力图"""
    latest = store.get_latest_heatmap()
    if not latest:
        click.echo("暂无热力图数据")
        return

    click.echo(f"=== 热力图 v{latest.version} ===")
    click.echo(f"生成时间: {latest.generated_at}")
    click.echo()

    for cell in latest.cells:
        point = store.points.get(cell.point_id)
        point_name = point.name if point else cell.point_id
        bar = "█" * int(cell.score * 20) + "░" * (20 - int(cell.score * 20))
        click.echo(f"{point_name:<25} {bar} {cell.score:.2f} [{cell.status.value}]")
        if cell.reason:
            click.echo(f"{' '*25}  💡 {cell.reason}")
        day_mark = "☀️" if cell.has_day_coverage else "❌"
        night_mark = "🌙" if cell.has_night_coverage else "❌"
        click.echo(f"{' '*25}  采样: 白天{day_mark} 晚间{night_mark}")


@cli.command()
@click.argument('order_id')
@click.option('--approve/--reject', required=True, help='通过或不通过')
@click.option('--note', required=True, help='复核意见')
@click.option('--reviewer', default='街道规划员', help='复核人')
def review(order_id, approve, note, reviewer):
    """街道规划员复核派单

    ORDER_ID: 派单ID
    """
    order, heatmap = service.review_order(order_id, approve, reviewer, note)
    result = "通过" if approve else "不通过"
    click.echo(f"✅ 复核完成 - {result}")
    click.echo(f"   派单: {order.id}")
    click.echo(f"   新状态: {order.status.value}")
    click.echo(f"   复核意见: {order.missing_reason}")
    click.echo(f"   热力图版本: v{heatmap.version}")


@cli.command()
def list_points():
    """列出所有街道点"""
    if not store.points:
        click.echo("暂无街道点数据")
        return

    click.echo(f"{'ID':<8} {'名称':<25} {'区域':<10} {'坐标'}")
    click.echo("-" * 70)
    for p in store.points.values():
        click.echo(f"{p.id:<8} {p.name:<25} {p.district:<10} ({p.lat:.4f}, {p.lng:.4f})")


@cli.command()
def audit_logs():
    """查看所有审计日志"""
    if not store.audit_logs:
        click.echo("暂无审计日志")
        return

    click.echo(f"{'时间':<20} {'操作人':<15} {'动作':<10} {'派单ID':<10} 原因")
    click.echo("-" * 80)
    for log in sorted(store.audit_logs, key=lambda x: x.timestamp, reverse=True):
        click.echo(f"{str(log.timestamp)[:19]:<20} {log.operator:<15} {log.action.value:<10} {log.order_id or '-':<10} {log.reason or ''}")


if __name__ == '__main__':
    cli()
